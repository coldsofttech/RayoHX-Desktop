import { afterEach, describe, expect, it, vi } from 'vitest';

import { clean } from './clean.js';

describe('clean', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the request to the clean route', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ removed: [] }) });
    vi.stubGlobal('fetch', fetch);
    expect(await clean.run({ dry_run: true })).toEqual({ removed: [] });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/clean');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ dry_run: true });
  });
});
