import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloads } from './downloads.js';

/** @param {number} [status] */
const stubFetch = (status = 200) => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ status, ok: status < 400, json: () => Promise.resolve({}) });
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('downloads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists the downloads', async () => {
    const fetch = stubFetch();
    await downloads.list();
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads');
    expect(init.method).toBe('GET');
  });

  it('starts a download', async () => {
    const fetch = stubFetch();
    await downloads.start({ url: 'https://x/m.m3u8' });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ url: 'https://x/m.m3u8' });
  });

  it('controls a download', async () => {
    const fetch = stubFetch();
    await downloads.control('a', 'pause');
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads/a/pause');
    expect(init.method).toBe('POST');
  });

  it('retries without a body unless told to overwrite', async () => {
    const fetch = stubFetch();
    await downloads.retry('a');
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/downloads/a/retry');
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
    await downloads.retry('a', true);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ overwrite: true });
  });

  it('removes one download', async () => {
    const fetch = stubFetch(204);
    expect(await downloads.remove('a')).toBeNull();
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads/a');
    expect(init.method).toBe('DELETE');
  });

  it('clears the history', async () => {
    const fetch = stubFetch(204);
    await downloads.clear();
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads');
    expect(init.method).toBe('DELETE');
  });
});

describe('downloads.log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads what the engine reported', async () => {
    const fetch = stubFetch();
    await downloads.log('abc');
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads/abc/log');
    expect(init.method).toBe('GET');
  });
});
