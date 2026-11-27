// The only place the page talks to Python: the rayohx_api routes under /api/v1.
const BASE = '/api/v1';

export class ApiError extends Error {}

/**
 * The text to show for anything a failed call threw.
 * @param {unknown} problem
 * @returns {string}
 */
export const errorMessage = (problem) =>
  problem instanceof Error ? problem.message : 'Something went wrong.';

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail ?? data.title ?? `Request failed (${response.status})`;
    throw new ApiError(typeof detail === 'string' ? detail : 'The request was not valid.');
  }
  return data;
}
