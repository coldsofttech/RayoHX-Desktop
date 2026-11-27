import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './client.js';
import { bridge } from './bridge.js';

/**
 * @param {unknown} [body]
 * @param {number} [status]
 */
const stubFetch = (body = {}, status = 200) => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ status, ok: status < 400, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

describe('bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('chooseFolder', () => {
    it('asks the window for a folder and returns its path', async () => {
      const fetch = stubFetch({ result: 'C:\\Videos' });
      expect(await bridge.chooseFolder('C:\\Start')).toBe('C:\\Videos');
      const [path, init] = fetch.mock.calls[0];
      expect(path).toBe('/api/bridge/choose_folder');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ directory: 'C:\\Start' });
    });

    it('returns null when the dialog was closed', async () => {
      stubFetch({ result: null });
      expect(await bridge.chooseFolder()).toBeNull();
    });

    it('says why the window cannot do it', async () => {
      stubFetch({ available: false, reason: 'No window.' });
      await expect(bridge.chooseFolder()).rejects.toThrow('No window.');
    });

    it('falls back when no reason comes back', async () => {
      stubFetch({}, 500);
      const failure = bridge.chooseFolder();
      await expect(failure).rejects.toThrow('The folder picker is not available here.');
      await expect(failure).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('chooseFile', () => {
    it('asks for the given file types and returns the first path', async () => {
      const fetch = stubFetch({ result: ['C:\\a.txt', 'C:\\b.txt'] });
      expect(await bridge.chooseFile(['Text (*.txt)'])).toBe('C:\\a.txt');
      const [path, init] = fetch.mock.calls[0];
      expect(path).toBe('/api/bridge/choose_file');
      expect(JSON.parse(init.body)).toEqual({ file_types: ['Text (*.txt)'] });
    });

    it('asks for any file by default', async () => {
      const fetch = stubFetch({ result: null });
      expect(await bridge.chooseFile()).toBeNull();
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ file_types: [] });
    });

    it('returns null for an empty choice', async () => {
      stubFetch({ result: [] });
      expect(await bridge.chooseFile()).toBeNull();
    });

    it('says why the window cannot do it', async () => {
      stubFetch({ available: false });
      await expect(bridge.chooseFile()).rejects.toThrow('The file picker is not available here.');
    });
  });

  describe('openDownloadsFolder', () => {
    it('asks the window to open the folder', async () => {
      const fetch = stubFetch();
      expect(await bridge.openDownloadsFolder()).toBeUndefined();
      const [path, init] = fetch.mock.calls[0];
      expect(path).toBe('/api/bridge/open_downloads');
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{}');
    });

    it('says why the folder cannot be opened', async () => {
      stubFetch({ available: false });
      await expect(bridge.openDownloadsFolder()).rejects.toThrow(
        'The folder cannot be opened here.',
      );
    });
  });
});
