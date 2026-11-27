import { afterEach, describe, expect, it, vi } from 'vitest';

import { inspect } from './inspect.js';

describe('inspect', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the request to the inspect route', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ playlist: {} }) });
    vi.stubGlobal('fetch', fetch);
    await inspect.run({ url: 'https://x/m.m3u8', network: { headers: { Referer: 'r' } } });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/inspect');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      url: 'https://x/m.m3u8',
      network: { headers: { Referer: 'r' } },
    });
  });

  it('raises the problem detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 422,
        ok: false,
        json: () => Promise.resolve({ detail: 'Not a playlist.' }),
      }),
    );
    await expect(inspect.run({ url: 'x' })).rejects.toThrow('Not a playlist.');
  });
});
