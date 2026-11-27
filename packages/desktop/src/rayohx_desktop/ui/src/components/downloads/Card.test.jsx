import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Card, { StateBadge } from './Card.jsx';

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
const EXISTS = {
  ...FAILED,
  id: 'j5',
  retryable: true,
  error: 'The output file already exists: x.ts',
  error_code: 'output_exists',
};

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

/**
 * Answers `request` (for example `POST /api/v1/downloads/j1/pause`) and fails anything else.
 * @param {string} request
 * @param {(init: RequestInit) => Promise<unknown>} handler
 */
function mockApi(request, handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((/** @type {string} */ url, /** @type {RequestInit} */ init = {}) => {
      const key = `${init.method ?? 'GET'} ${url}`;
      return key === request ? handler(init) : json({ detail: `unmocked ${key}` }, 500);
    }),
  );
}

/**
 * The body of the first request a mocked handler received.
 * @param {import('vitest').Mock} handler
 */
function sentBody(handler) {
  return /** @type {[RequestInit?][]} */ (handler.mock.calls)[0]?.[0]?.body;
}

/** @param {import('./Card.jsx').Job} job */
function renderCard(job) {
  const act = vi.fn((/** @type {() => Promise<unknown>} */ task) => task());
  const view = render(
    <StrictMode>
      <ul>
        <Card job={job} act={act} />
      </ul>
    </StrictMode>,
  );
  return { act, ...view };
}

describe('Card', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the address of a download that has no output file yet', () => {
    renderCard(RUNNING);
    const name = screen.getByText('https://x/m.m3u8');
    expect(name).toHaveAttribute('title', 'https://x/m.m3u8');
  });

  it('shows the output file once there is one, keeping the address as its title', () => {
    renderCard(DONE);
    expect(screen.getByText('/d/video.mp4')).toHaveAttribute('title', 'https://x/d.m3u8');
  });

  it('shows the quality and the state', () => {
    renderCard({ ...RUNNING, quality: '720p' });
    expect(screen.getByText('720p')).toBeInTheDocument();
    expect(screen.getByText('downloading')).toBeInTheDocument();
  });

  it('leaves out the quality when there is none', () => {
    renderCard(RUNNING);
    expect(screen.queryByText('720p')).not.toBeInTheDocument();
  });

  it('shows progress for a running download', () => {
    renderCard(RUNNING);
    expect(screen.getByRole('progressbar', { name: 'Download progress' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
  });

  it('shows an unfilled bar for a paused download with no progress yet', () => {
    renderCard(PAUSED);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('shows the size and no progress once finished', () => {
    renderCard(DONE);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a failure message', () => {
    renderCard(FAILED);
    expect(screen.getByText('Segment missing.')).toBeInTheDocument();
  });

  it.each([
    ['downloading', RUNNING, ['Pause j1', 'Cancel j1'], ['Resume j1', 'Retry j1', 'Remove j1']],
    ['paused', PAUSED, ['Resume j2', 'Cancel j2'], ['Pause j2', 'Retry j2', 'Remove j2']],
    ['completed', DONE, ['Remove j3'], ['Pause j3', 'Resume j3', 'Retry j3', 'Cancel j3']],
    ['failed', FAILED, ['Remove j4'], ['Retry j4', 'Cancel j4']],
    [
      'failed and retryable',
      { ...FAILED, retryable: true },
      ['Retry j4', 'Remove j4'],
      ['Pause j4', 'Cancel j4'],
    ],
  ])('offers the right buttons for a %s download', (_, job, shown, hidden) => {
    renderCard(job);
    for (const name of shown) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    for (const name of hidden) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it.each([
    ['Pause j1', RUNNING, 'POST /api/v1/downloads/j1/pause'],
    ['Resume j2', PAUSED, 'POST /api/v1/downloads/j2/resume'],
    ['Cancel j1', RUNNING, 'POST /api/v1/downloads/j1/cancel'],
    ['Retry j4', { ...FAILED, retryable: true }, 'POST /api/v1/downloads/j4/retry'],
    ['Remove j3', DONE, 'DELETE /api/v1/downloads/j3'],
  ])('%s sends the matching request through act', async (label, job, request) => {
    const handler = vi.fn(() => json(null, 204));
    mockApi(request, handler);
    const user = userEvent.setup();
    const { act } = renderCard(job);
    await user.click(screen.getByRole('button', { name: label }));
    expect(act).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(handler).toHaveBeenCalled());
  });

  it('retries without overwriting unless asked to', async () => {
    const handler = vi.fn(() => json({}));
    mockApi('POST /api/v1/downloads/j4/retry', handler);
    const user = userEvent.setup();
    renderCard({ ...FAILED, retryable: true });
    await user.click(screen.getByRole('button', { name: 'Retry j4' }));
    await waitFor(() => expect(handler).toHaveBeenCalled());
    expect(sentBody(handler)).toBeUndefined();
  });

  it('offers to overwrite only when the output file already exists', async () => {
    const handler = vi.fn(() => json({}));
    mockApi('POST /api/v1/downloads/j5/retry', handler);
    const user = userEvent.setup();
    renderCard(EXISTS);
    await user.click(screen.getByRole('button', { name: 'Overwrite' }));
    await waitFor(() => expect(handler).toHaveBeenCalled());
    expect(JSON.parse(String(sentBody(handler)))).toEqual({ overwrite: true });
  });

  it('does not offer to overwrite for other failures or when it cannot be retried', () => {
    const { unmount } = renderCard({ ...FAILED, retryable: true });
    expect(screen.queryByRole('button', { name: 'Overwrite' })).not.toBeInTheDocument();
    unmount();
    renderCard({ ...EXISTS, retryable: false });
    expect(screen.queryByRole('button', { name: 'Overwrite' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    for (const job of [RUNNING, PAUSED, DONE, EXISTS]) {
      const { container, unmount } = renderCard(job);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});

describe('StateBadge', () => {
  it.each(['queued', 'downloading', 'paused', 'failed', 'cancelled', 'completed'])(
    'shows the %s state',
    (state) => {
      render(<StateBadge state={state} />);
      expect(screen.getByText(state)).toBeInTheDocument();
    },
  );
});

describe('Card log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows and hides what the engine reported', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ time: 1, type: 'download_started', state: 'x' }]),
        }),
      ),
    );
    const user = userEvent.setup();
    render(<Card job={{ ...DONE, has_log: true }} act={() => {}} />);
    expect(screen.queryByRole('list', { name: 'Engine log' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show log' }));
    expect(await screen.findByRole('list', { name: 'Engine log' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide log' }));
    expect(screen.queryByRole('list', { name: 'Engine log' })).not.toBeInTheDocument();
  });
});
