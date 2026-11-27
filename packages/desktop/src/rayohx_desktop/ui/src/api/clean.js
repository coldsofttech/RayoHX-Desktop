import { call } from './client.js';

export const clean = {
  /** @param {Record<string, unknown>} request */
  run: (request) => call('/clean', { method: 'POST', body: request }),
};
