import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, call, errorMessage } from './client.js';

/**
 * @param {number} status
 * @param {unknown} [body]
 */
const reply = (status, body) =>
  vi.fn().mockResolvedValue({ status, ok: status < 400, json: () => Promise.resolve(body) });

describe('call', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends no body on a plain GET', async () => {
    const fetch = reply(200, { items: [] });
    vi.stubGlobal('fetch', fetch);
    expect(await call('/downloads')).toEqual({ items: [] });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe('/api/v1/downloads');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('sends a JSON body', async () => {
    const fetch = reply(200, {});
    vi.stubGlobal('fetch', fetch);
    await call('/x', { method: 'POST', body: { a: 1 } });
    const init = fetch.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it('returns null for 204', async () => {
    vi.stubGlobal('fetch', reply(204));
    expect(await call('/x', { method: 'DELETE' })).toBeNull();
  });

  it('raises the problem detail', async () => {
    vi.stubGlobal('fetch', reply(422, { detail: 'Not a playlist.' }));
    await expect(call('/x')).rejects.toThrow('Not a playlist.');
    await expect(call('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to the problem title', async () => {
    vi.stubGlobal('fetch', reply(500, { title: 'Server trouble' }));
    await expect(call('/x')).rejects.toThrow('Server trouble');
  });

  it('falls back when the detail is not text', async () => {
    vi.stubGlobal('fetch', reply(422, { detail: [{ msg: 'bad' }] }));
    await expect(call('/x')).rejects.toThrow('The request was not valid.');
  });

  it('falls back when the error has no usable body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ status: 500, ok: false, json: () => Promise.reject(new Error('x')) }),
    );
    await expect(call('/x')).rejects.toThrow('Request failed (500)');
  });
});

describe('errorMessage', () => {
  it('shows the message of an error', () => {
    expect(errorMessage(new Error('Broken.'))).toBe('Broken.');
  });

  it('hides anything else behind a generic message', () => {
    expect(errorMessage('boom')).toBe('Something went wrong.');
    expect(errorMessage(undefined)).toBe('Something went wrong.');
  });
});
