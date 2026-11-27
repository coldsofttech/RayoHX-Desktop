import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Downloads from './Downloads.jsx';

const RUNNING = {
  id: 'j1',
  url: 'https://x/m.m3u8',
  state: 'downloading',
  progress: { fraction: 0.5, speed: 1048576, eta_seconds: 30 },
};
const PAUSED = { id: 'j2', url: 'https://x/p.m3u8', state: 'paused', progress: null };
const DONE = {
  id: 'j3',
  url: 'https://x/d.m3u8',
  output_path: '/d/video.mp4',
  state: 'completed',
  output_size_bytes: 2048,
};
const FAILED = { id: 'j4', url: 'https://x/f.m3u8', state: 'failed', error: 'Segment missing.' };

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

/** @param {{ onCount?: (active: number) => void }} [props] */
function renderDownloads(props) {
  return render(
    <StrictMode>
      <Downloads {...props} />
    </StrictMode>,
  );
}

describe('Downloads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an empty state', async () => {
    mockApi({ 'GET /api/v1/downloads': () => json({ items: [] }) });
    renderDownloads();
    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument();
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    mockApi({
      'GET /api/v1/downloads': () => json({ items: [RUNNING, PAUSED, DONE, FAILED] }),
    });
    const { container } = renderDownloads();
    await screen.findByText('50%');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows progress for a running download and reports the active count', async () => {
    mockApi({ 'GET /api/v1/downloads': () => json({ items: [RUNNING, PAUSED, DONE] }) });
    const onCount = vi.fn();
    renderDownloads({ onCount });
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(2));
  });

  it('opens the download folder from the window', async () => {
    mockApi({
      'GET /api/v1/downloads': () => json({ items: [] }),
      'POST /api/bridge/open_downloads': () => json({ result: { opened: true } }),
    });
    const user = userEvent.setup();
    renderDownloads();
    await user.click(await screen.findByRole('button', { name: 'Open folder' }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/bridge/open_downloads',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows an error when a control fails', async () => {
    mockApi({
      'GET /api/v1/downloads': () => json({ items: [RUNNING] }),
      'POST /api/v1/downloads/j1/pause': () => json({ detail: 'Cannot pause.' }, 409),
    });
    const user = userEvent.setup();
    renderDownloads();
    await user.click(await screen.findByRole('button', { name: 'Pause j1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot pause.');
  });

  it('shows an error when the list cannot be loaded', async () => {
    mockApi({ 'GET /api/v1/downloads': () => json({ detail: 'Server down.' }, 500) });
    renderDownloads();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down.');
  });

  it('sends a control from a card and refreshes the list', async () => {
    const pause = vi.fn(() => json(null, 204));
    const list = vi.fn(() => json({ items: [RUNNING] }));
    mockApi({ 'GET /api/v1/downloads': list, 'POST /api/v1/downloads/j1/pause': pause });
    const user = userEvent.setup();
    renderDownloads();
    await user.click(await screen.findByRole('button', { name: 'Pause j1' }));
    await waitFor(() => expect(pause).toHaveBeenCalled());
    const before = list.mock.calls.length;
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before));
  });

  it('keeps a failed control visible while the list refreshes', async () => {
    mockApi({
      'GET /api/v1/downloads': () => json({ items: [RUNNING] }),
      'POST /api/v1/downloads/j1/pause': () => json({ detail: 'Cannot pause.' }, 409),
    });
    const user = userEvent.setup();
    renderDownloads();
    await user.click(await screen.findByRole('button', { name: 'Pause j1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot pause.');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot pause.');
  });

  it('offers to clear the history only when something has finished', async () => {
    mockApi({ 'GET /api/v1/downloads': () => json({ items: [RUNNING, PAUSED] }) });
    renderDownloads();
    await screen.findByText('50%');
    expect(screen.queryByRole('button', { name: 'Clear history' })).not.toBeInTheDocument();
  });

  it('clears the history', async () => {
    const clear = vi.fn(() => json(null, 204));
    mockApi({
      'GET /api/v1/downloads': () => json({ items: [RUNNING, DONE, FAILED] }),
      'DELETE /api/v1/downloads': clear,
    });
    const user = userEvent.setup();
    renderDownloads();
    await user.click(await screen.findByRole('button', { name: 'Clear history' }));
    await waitFor(() => expect(clear).toHaveBeenCalled());
  });

  it('picks up new downloads as the list refreshes', async () => {
    let items = [RUNNING];
    mockApi({ 'GET /api/v1/downloads': () => json({ items }) });
    renderDownloads();
    await screen.findByText('https://x/m.m3u8');
    items = [RUNNING, DONE];
    expect(await screen.findByText('/d/video.mp4', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('shows one card for each download', async () => {
    mockApi({ 'GET /api/v1/downloads': () => json({ items: [RUNNING, PAUSED, DONE, FAILED] }) });
    renderDownloads();
    expect(await screen.findAllByRole('listitem')).toHaveLength(4);
  });

  it('stops refreshing once it is removed', async () => {
    const list = vi.fn(() => json({ items: [] }));
    mockApi({ 'GET /api/v1/downloads': list });
    const { unmount } = renderDownloads();
    await screen.findByText(/Nothing here yet/);
    unmount();
    const calls = list.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(list.mock.calls.length).toBe(calls);
  });
});
