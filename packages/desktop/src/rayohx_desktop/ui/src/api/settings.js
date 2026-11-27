import { call } from './client.js';

export const settings = {
  get: () => call('/settings'),
  /** @param {Record<string, unknown>} changes */
  save: (changes) => call('/settings', { method: 'PATCH', body: changes }),
  /**
   * Replaces the saved default options, which every new download starts from.
   * @param {Record<string, unknown>} defaults
   */
  saveDefaults: (defaults) => call('/settings/defaults', { method: 'PUT', body: defaults }),
};
