import { ApiError } from './client.js';

/**
 * Run a native action in the window. Resolves with the action's result.
 * @param {string} action
 * @param {unknown} body
 * @param {string} unavailable What to say when the window cannot do it.
 * @returns {Promise<any>}
 */
async function invoke(action, body, unavailable) {
  const response = await fetch(`/api/bridge/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.available === false) {
    throw new ApiError(data.reason ?? unavailable);
  }
  return data.result;
}

// The native actions Cornea Shell offers the page, under /api/bridge.
export const bridge = {
  /**
   * Ask the window for a folder. Resolves with its path, or null when the dialog was closed.
   * @param {string} [directory] Where the dialog starts.
   * @returns {Promise<string | null>}
   */
  chooseFolder: async (directory) =>
    (await invoke('choose_folder', { directory }, 'The folder picker is not available here.')) ??
    null,

  /**
   * Ask the window for a file. Resolves with its path, or null when the dialog was closed.
   * @param {string[]} [fileTypes] Filters such as 'Text (*.txt)'.
   * @returns {Promise<string | null>}
   */
  chooseFile: async (fileTypes = []) =>
    (
      await invoke(
        'choose_file',
        { file_types: fileTypes },
        'The file picker is not available here.',
      )
    )?.[0] ?? null,

  /** Ask the window to show the download folder in Explorer. */
  openDownloadsFolder: async () => {
    await invoke('open_downloads', {}, 'The folder cannot be opened here.');
  },
};
