import { call } from './client.js';

export const downloads = {
  list: () => call('/downloads'),
  /** @param {Record<string, unknown>} request */
  start: (request) => call('/downloads', { method: 'POST', body: request }),
  /**
   * @param {string} id
   * @param {string} action
   */
  control: (id, action) => call(`/downloads/${id}/${action}`, { method: 'POST' }),
  /**
   * Starts a failed download again; `overwrite` replaces a file that is already there.
   * @param {string} id
   * @param {boolean} [overwrite]
   */
  retry: (id, overwrite = false) =>
    call(`/downloads/${id}/retry`, {
      method: 'POST',
      ...(overwrite ? { body: { overwrite } } : {}),
    }),
  /** @param {string} id */
  remove: (id) => call(`/downloads/${id}`, { method: 'DELETE' }),
  /**
   * What the engine reported for a download, most recent last.
   * @param {string} id
   */
  log: (id) => call(`/downloads/${id}/log`),
  clear: () => call('/downloads', { method: 'DELETE' }),
};
