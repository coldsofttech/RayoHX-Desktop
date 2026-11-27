import { call } from './client.js';

export const inspect = {
  /** @param {Record<string, unknown>} request */
  run: (request) => call('/inspect', { method: 'POST', body: request }),
};
