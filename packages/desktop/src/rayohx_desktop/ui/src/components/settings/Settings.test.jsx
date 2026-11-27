import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from './Settings.jsx';

const SETTINGS = {
  download_dir: '/d',
  max_active_downloads: 2,
  allow_local_paths: true,
  defaults: {},
  limits: { min_concurrency: 1, max_concurrency: 64 },
  version: '0.1.0',
};

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

/** @param {Record<string, (init: RequestInit) => Promise<unknown>>} routes */
function mockApi(routes) {
  const handlers = new Map(Object.entries(routes));
  vi.stubGlobal(
    'fetch',
    vi.fn((/** @type {string} */ url, /** @type {RequestInit} */ init = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      const handler = handlers.get(key);
      return handler ? handler(init) : json({ detail: `unmocked ${key}` }, 500);
    }),
  );
}

/**
 * A recorded route: ``json(body)`` for every call, typed so the request can be read back.
 * @param {unknown} body
 */
const route = (body) =>
  vi.fn(/** @type {(init: RequestInit) => Promise<unknown>} */ (() => json(body)));

/** @param {{ mock: { calls: RequestInit[][] } }} handler The request body of its first call. */
const sentBody = (handler) => JSON.parse(String(handler.mock.calls[0][0].body));

/** @param {{ onChanged?: (settings: unknown) => void }} [props] */
function renderSettings(props) {
  return render(
    <StrictMode>
      <Settings {...props} />
    </StrictMode>,
  );
}

describe('Settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the folder and the version', async () => {
    mockApi({ 'GET /api/v1/settings': () => json(SETTINGS) });
    renderSettings();
    expect(await screen.findByText('/d')).toBeInTheDocument();
    expect(screen.getByText(/Version 0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Default options' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    mockApi({ 'GET /api/v1/settings': () => json(SETTINGS) });
    const { container } = renderSettings();
    await screen.findByText('/d');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows an error when the settings cannot be loaded', async () => {
    mockApi({ 'GET /api/v1/settings': () => json({ detail: 'Server down.' }, 500) });
    renderSettings();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down.');
    expect(screen.queryByText('Defaults')).not.toBeInTheDocument();
  });

  it('shows saved defaults without logins and saves edits', async () => {
    const saved = { network: { retries: 2 }, selection: { quality: '720p' } };
    const put = route({ ...SETTINGS, defaults: saved });
    mockApi({
      'GET /api/v1/settings': () =>
        json({
          ...SETTINGS,
          defaults: { network: { retries: 7 }, selection: { quality: '720p' } },
        }),
      'PUT /api/v1/settings/defaults': put,
    });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderSettings({ onChanged });
    await user.click(await screen.findByRole('button', { name: /Network/ }));
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    const retries = screen.getByLabelText('Retries');
    expect(retries).toHaveValue(7);
    await user.clear(retries);
    await user.type(retries, '2');
    await user.click(screen.getByRole('tab', { name: 'Proxy' }));
    expect(screen.queryByLabelText('Proxy password')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save defaults' }));
    expect(await screen.findByText('Default options saved.')).toBeInTheDocument();
    expect(sentBody(put)).toEqual(saved);
    expect(onChanged).toHaveBeenCalledWith({ ...SETTINGS, defaults: saved });
  });

  it('shows an error when saving the defaults fails', async () => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'PUT /api/v1/settings/defaults': () => json({ detail: 'Bad combination.' }, 422),
    });
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Save defaults' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad combination.');
    expect(screen.queryByText('Default options saved.')).not.toBeInTheDocument();
  });

  it('shows the clean up and about cards under the settings', async () => {
    mockApi({ 'GET /api/v1/settings': () => json(SETTINGS) });
    renderSettings();
    await screen.findByText('/d');
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Clean up' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'About' })).toBeInTheDocument();
  });

  it('saves the folder picked in the window', async () => {
    const patch = route({ ...SETTINGS, download_dir: '/new' });
    const pick = route({ result: '/new' });
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'POST /api/bridge/choose_folder': pick,
      'PATCH /api/v1/settings': patch,
    });
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    expect(await screen.findByText('/new')).toBeInTheDocument();
    expect(sentBody(pick)).toEqual({ directory: '/d' });
    expect(sentBody(patch)).toEqual({ download_dir: '/new' });
  });

  it('keeps the folder when the dialog is closed', async () => {
    const patch = route(SETTINGS);
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'POST /api/bridge/choose_folder': () => json({ result: null }),
      'PATCH /api/v1/settings': patch,
    });
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toBeEnabled());
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByText('/d')).toBeInTheDocument();
  });

  it('shows an error when the folder picker is not available', async () => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'POST /api/bridge/choose_folder': () => json({ available: false, reason: 'No window.' }),
    });
    const user = userEvent.setup();
    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No window.');
  });
});
