import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Log from './Log.jsx';

/** @param {unknown} body @param {number} [status] */
const respond = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe('Log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists what the engine reported', async () => {
    const fetch = vi.fn((/** @type {string} */ url) =>
      respond(
        url === '/api/v1/downloads/abc/log'
          ? [
              { time: 1, type: 'download_started', state: 'downloading', message: 'Started' },
              {
                time: 2,
                type: 'segment_failed',
                state: 'downloading',
                segment: 4,
                message: 'Timed out',
              },
            ]
          : { detail: `unmocked ${url}` },
        url === '/api/v1/downloads/abc/log' ? 200 : 500,
      ),
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <StrictMode>
        <Log id="abc" />
      </StrictMode>,
    );
    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('download started: Started');
    expect(items[1]).toHaveTextContent('segment failed (segment 4): Timed out');
    expect(fetch).toHaveBeenCalledWith('/api/v1/downloads/abc/log', expect.anything());
  });

  it('shows nothing when the log cannot be read', async () => {
    const fetch = vi.fn(() => respond({ detail: 'No such download.' }, 404));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<Log id="gone" />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
