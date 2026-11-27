import { afterEach, describe, expect, it, vi } from 'vitest';

import { settings } from './settings.js';

const stubFetch = () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ theme: 'dark' }) });
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the settings', async () => {
    const fetch = stubFetch();
    expect(await settings.get()).toEqual({ theme: 'dark' });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/settings');
    expect(init.method).toBe('GET');
  });

  it('saves only the changes', async () => {
    const fetch = stubFetch();
    await settings.save({ theme: 'light' });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/settings');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ theme: 'light' });
  });
});

describe('saveDefaults', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replaces the saved default options', async () => {
    const fetch = stubFetch();
    await settings.saveDefaults({ selection: { quality: '720p' } });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/settings/defaults');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ selection: { quality: '720p' } });
  });
});
