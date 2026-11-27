import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddStream from './AddStream.jsx';

const MASTER = {
  type: 'master',
  url: 'https://x/m.m3u8',
  variants: [
    { index: 1, name: null, resolution: '1280x720', bandwidth: 2000000, codecs: ['avc1'] },
    { index: 2, name: 'Audio only', resolution: null, bandwidth: 128000, codecs: [] },
  ],
  audio_tracks: [
    { group: 'a', name: 'English', language: 'en' },
    { group: 'a', name: 'Commentary', language: null },
  ],
  subtitle_tracks: [{ group: 's', name: 'French', language: 'fr' }],
  video_tracks: [],
};
const MEDIA = { type: 'media', url: 'https://x/v.m3u8', segments: 12, duration: 59.6 };

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
 * What the form sent: the JSON body of the first request a mocked handler received.
 * @param {import('vitest').Mock} handler
 */
function sentJson(handler) {
  const body = /** @type {[RequestInit?][]} */ (handler.mock.calls)[0]?.[0]?.body;
  return JSON.parse(String(body));
}

/** @param {Partial<import('react').ComponentProps<typeof AddStream>>} [props] */
function renderForm(props) {
  return render(
    <StrictMode>
      <AddStream onStarted={() => {}} {...props} />
    </StrictMode>,
  );
}

/**
 * @param {ReturnType<typeof userEvent.setup>} user
 * @param {string} [address]
 */
async function inspectStream(user, address = 'https://x/m.m3u8') {
  await user.type(screen.getByLabelText('Playlist address'), address);
  await user.click(screen.getByRole('button', { name: 'Inspect' }));
}

describe('AddStream', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('disables Inspect until an address is entered', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
    await user.type(screen.getByLabelText('Playlist address'), 'https://x/m.m3u8');
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeEnabled();
  });

  it('has no accessibility violations', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MASTER }) });
    const user = userEvent.setup();
    const { container } = renderForm();
    await inspectStream(user);
    await screen.findByText('2 streams available');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers Quick and Advanced only after a stream is inspected', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MASTER }) });
    const user = userEvent.setup();
    renderForm();
    expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
    await inspectStream(user);
    expect(await screen.findByText('2 streams available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
  });

  it('offers what the stream has as choices', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MASTER }) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user);
    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('combobox', { name: 'Stream' }));
    expect(screen.getByRole('option', { name: '#1 · 1280x720 · 2000 kbps' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '#2 · Audio only · 128 kbps' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Audio track names' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Commentary' })).toBeInTheDocument();
  });

  it('summarises a single stream', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MEDIA }) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user, 'https://x/v.m3u8');
    expect(await screen.findByText(/12 segments, 60 s/)).toBeInTheDocument();
  });

  it('shows an error when inspecting fails', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ detail: 'Not an HLS playlist.' }, 422) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user, 'https://x/bad');
    expect(await screen.findByRole('alert')).toHaveTextContent('Not an HLS playlist.');
    expect(screen.queryByRole('region', { name: 'Stream details' })).not.toBeInTheDocument();
  });

  it('starts a download with the Advanced choices and not the quality', async () => {
    const start = vi.fn(
      /** @type {(init: RequestInit) => Promise<unknown>} */ (() => json({ id: 'abc' }, 202)),
    );
    mockApi({
      'POST /api/v1/inspect': () => json({ playlist: MASTER }),
      'POST /api/v1/downloads': start,
    });
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onStarted, inherited: { 'selection.quality': '720p' } });
    await inspectStream(user);
    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('combobox', { name: 'Audio track names' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(sentJson(start)).toEqual({
      url: 'https://x/m.m3u8',
      selection: { audio_names: ['English'] },
    });
    expect(screen.getByLabelText('Playlist address')).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Stream details' })).not.toBeInTheDocument();
  });

  it('uses only the quality while Quick is open', async () => {
    const start = vi.fn(() => json({ id: 'abc' }, 202));
    mockApi({
      'POST /api/v1/inspect': () => json({ playlist: MASTER }),
      'POST /api/v1/downloads': start,
    });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user);
    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await user.click(screen.getByRole('combobox', { name: 'Audio track names' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'English' }));
    await user.click(screen.getByRole('button', { name: 'Quick' }));
    await user.click(screen.getByLabelText('Quality'));
    await user.click(await screen.findByRole('option', { name: '720p' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(sentJson(start).selection).toEqual({
      quality: '720p',
      video_only: true,
    });
  });

  it('shows the saved quality and leaves it to the defaults until one is picked', async () => {
    const start = vi.fn(() => json({ id: 'abc' }, 202));
    mockApi({
      'POST /api/v1/inspect': () => json({ playlist: MASTER }),
      'POST /api/v1/downloads': start,
    });
    const user = userEvent.setup();
    renderForm({ inherited: { 'selection.quality': '480p' } });
    await inspectStream(user);
    expect(await screen.findByLabelText('Quality')).toHaveValue('480p');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(start).toHaveBeenCalled());
    expect(sentJson(start).selection).toEqual({
      video_only: true,
    });
  });

  it('keeps the form and shows the error when starting fails', async () => {
    mockApi({
      'POST /api/v1/inspect': () => json({ playlist: MEDIA }),
      'POST /api/v1/downloads': () => json({ detail: 'Queue is full.' }, 429),
    });
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onStarted });
    await inspectStream(user, 'https://x/v.m3u8');
    await user.click(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Queue is full.');
    expect(onStarted).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Playlist address')).toHaveValue('https://x/v.m3u8');
  });

  it('starts every address from the batch tab and leaves out the file name', async () => {
    /** @type {any} */
    let body;
    mockApi({
      'POST /api/v1/downloads': (init) => {
        body = JSON.parse(String(init.body));
        return json({ id: '1' });
      },
    });
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onStarted });
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    expect(screen.queryByLabelText('File name')).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Playlist addresses'),
      'https://a/1.m3u8\n# skip\nhttps://b/2.m3u8',
    );
    await user.click(screen.getByRole('button', { name: 'Download all' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(body.urls).toEqual(['https://a/1.m3u8', 'https://b/2.m3u8']);
    expect(body).not.toHaveProperty('filename');
  });

  it('does not inspect a batch, so there is no Inspect button for it', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Why Advanced is not available' }),
    ).toBeInTheDocument();
  });

  it('sends pasted playlist text with its base address, file name and options', async () => {
    /** @type {any[]} */
    const bodies = [];
    mockApi({
      'POST /api/v1/inspect': () => json({ playlist: MEDIA }),
      'POST /api/v1/downloads': (init) => {
        bodies.push(JSON.parse(String(init.body)));
        return json({ id: '1' });
      },
    });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('tab', { name: 'Playlist text' }));
    const inspect = screen.getByRole('button', { name: 'Inspect' });
    expect(inspect).toBeDisabled();
    await user.type(screen.getByLabelText('Playlist text'), '#EXTM3U');
    expect(inspect).toBeDisabled();
    await user.type(screen.getByLabelText('Base address'), 'https://x/');
    expect(inspect).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    await user.type(screen.getByLabelText('Retries'), '5');
    await user.click(inspect);
    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    await user.type(screen.getByLabelText('File name'), 'clip');
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      playlist_text: '#EXTM3U',
      base_url: 'https://x/',
      filename: 'clip',
      network: { retries: 5 },
    });
  });

  it('hides local-path fields unless the server allows them', async () => {
    mockApi({});
    const user = userEvent.setup();
    const { unmount } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    expect(screen.getByLabelText('User agent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cookie file (cookies.txt)')).not.toBeInTheDocument();
    unmount();
    renderForm({ allowLocalPaths: true });
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    expect(screen.getByLabelText('Cookie file (cookies.txt)')).toBeInTheDocument();
  });

  it('opens and closes the connection options', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderForm();
    const button = screen.getByRole('button', { name: 'Connection' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tab', { name: 'Proxy' })).not.toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tab', { name: 'Proxy' })).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('tab', { name: 'Proxy' })).not.toBeInTheDocument();
  });

  it('explains why Advanced is missing only for several addresses', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderForm();
    const why = 'Why Advanced is not available';
    expect(screen.queryByRole('button', { name: why })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    expect(screen.getByRole('button', { name: why })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'One address' }));
    expect(screen.queryByRole('button', { name: why })).not.toBeInTheDocument();
  });

  it('forgets what was inspected when another tab is opened', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MEDIA }) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user, 'https://x/v.m3u8');
    expect(await screen.findByRole('region', { name: 'Stream details' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Playlist text' }));
    expect(screen.queryByRole('region', { name: 'Stream details' })).not.toBeInTheDocument();
  });

  it('clears an error when another tab is opened', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ detail: 'Not an HLS playlist.' }, 422) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user, 'https://x/bad');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts a batch with the quality picked for it', async () => {
    /** @type {any} */
    let body;
    mockApi({
      'POST /api/v1/downloads': (init) => {
        body = JSON.parse(String(init.body));
        return json({ id: '1' });
      },
    });
    const onStarted = vi.fn();
    const user = userEvent.setup();
    renderForm({ onStarted, inherited: { 'selection.quality': '1080p' } });
    await user.click(screen.getByRole('tab', { name: 'Several addresses' }));
    await user.type(screen.getByLabelText('Playlist addresses'), 'https://a/1.m3u8');
    await user.click(screen.getByLabelText('Quality'));
    await user.click(screen.getByRole('option', { name: '480p' }));
    await user.click(screen.getByRole('button', { name: 'Download all' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(body.selection).toEqual({ quality: '480p', video_only: true });
  });

  it('asks for a stream before downloading in Advanced when the stream has choices', async () => {
    mockApi({ 'POST /api/v1/inspect': () => json({ playlist: MASTER }) });
    const user = userEvent.setup();
    renderForm();
    await inspectStream(user);
    await user.click(await screen.findByRole('button', { name: 'Advanced' }));
    expect(screen.getByText(/Choose a stream or a size/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Quick' }));
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
  });
});
