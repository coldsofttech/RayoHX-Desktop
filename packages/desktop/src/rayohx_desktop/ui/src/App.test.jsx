import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const SETTINGS = {
  download_dir: '/d',
  max_active_downloads: 2,
  allow_local_paths: false,
  concurrency: 4,
  quality: 'best',
  overwrite: false,
  limits: { min_concurrency: 1, max_concurrency: 64 },
  version: '0.1.0',
};
const PLAYLIST = {
  type: 'master',
  url: 'https://x/m.m3u8',
  variants: [
    { index: 1, name: null, resolution: '1280x720', bandwidth: 2000000, codecs: ['avc1'] },
  ],
  audio_tracks: [{ group: 'a', name: 'English', language: 'en' }],
  subtitle_tracks: [],
  video_tracks: [],
};

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

/** @typedef {Record<string, (init: any) => Promise<unknown>>} Routes */

/** The stubbed global ``fetch``, with its recorded calls. */
const fetchMock = () => /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (fetch));

/** @param {Routes} routes */
function mockApi(routes) {
  const handlers = new Map(Object.entries(routes));
  vi.stubGlobal(
    'fetch',
    vi.fn((/** @type {string} */ url, /** @type {any} */ init = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      const handler = handlers.get(key);
      return handler ? handler(init) : json({ detail: `unmocked ${key}` }, 500);
    }),
  );
}

describe('App', () => {
  beforeEach(() => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'GET /api/v1/downloads': () => json({ items: [] }),
      'POST /api/v1/inspect': () => json({ playlist: PLAYLIST }),
      'POST /api/v1/downloads': () => json({ id: 'abc' }, 202),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the new download form', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'RayoHX' })).toBeInTheDocument();
    expect(screen.getByLabelText('Playlist address')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
    expect(await axe(container)).toHaveNoViolations();
  });

  it('inspects a stream and starts the download', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Playlist address'), 'https://x/m.m3u8');
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByText('1 streams available')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('combobox', { name: 'Audio track names' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => {
      const call = fetchMock().mock.calls.find(
        ([, init]) => init?.method === 'POST' && init.body.includes('"audio_names"'),
      );
      expect(JSON.parse(call?.[1].body).selection.audio_names).toEqual(['English']);
    });
    expect(await screen.findByRole('heading', { name: 'Downloads' })).toBeInTheDocument();
  });

  it('shows an error from the API', async () => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'POST /api/v1/inspect': () => json({ detail: 'Not an HLS playlist.' }, 422),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Playlist address'), 'https://x/bad');
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not an HLS playlist.');
  });

  it('lists downloads and offers controls', async () => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'GET /api/v1/downloads': () =>
        json({
          items: [
            {
              id: 'j1',
              url: 'https://x/m.m3u8',
              state: 'downloading',
              progress: { fraction: 0.5, speed: 1048576, eta_seconds: 30 },
            },
          ],
        }),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /Downloads/ }));
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause j1' })).toBeInTheDocument();
  });
});

describe('advanced options', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only the options that were filled in, scaled to the API units', async () => {
    mockApi({
      'GET /api/v1/settings': () => json(SETTINGS),
      'POST /api/v1/downloads': () => json({ items: [] }, 202),
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    await user.type(
      screen.getByLabelText(/Playlist addresses/),
      'https://a/x.m3u8\n# skip\nhttps://b/x.m3u8',
    );
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    await user.type(screen.getByLabelText('Headers'), 'X-Token: abc');
    expect(screen.queryByLabelText('Cookie file (cookies.txt)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    await user.type(screen.getByLabelText('Speed limit (KB/s)'), '2');
    await user.type(screen.getByLabelText('Retries'), '5');
    await user.click(screen.getByRole('button', { name: 'Download all' }));
    const isPost = (/** @type {any[]} */ [, i]) => i?.method === 'POST';
    await waitFor(() => expect(fetchMock().mock.calls.some(isPost)).toBe(true));
    const body = JSON.parse(fetchMock().mock.calls.find(isPost)?.[1].body);
    expect(body.urls).toEqual(['https://a/x.m3u8', 'https://b/x.m3u8']);
    expect(body.network).toEqual({ rate_limit: 2048, headers: { 'X-Token': 'abc' }, retries: 5 });
  });

  it('shows file options only when the API allows local paths', async () => {
    mockApi({ 'GET /api/v1/settings': () => json({ ...SETTINGS, allow_local_paths: true }) });
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    expect(await screen.findByLabelText('Cookie file (cookies.txt)')).toBeInTheDocument();
  });
});
