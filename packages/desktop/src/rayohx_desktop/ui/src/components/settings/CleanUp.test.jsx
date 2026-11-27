import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CleanUp from './CleanUp.jsx';

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

/** @param {() => Promise<unknown>} handler Answers `POST /api/v1/clean`; anything else fails. */
function mockClean(handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((/** @type {string} */ url, /** @type {RequestInit} */ init = {}) =>
      `${init.method ?? 'GET'} ${url}` === 'POST /api/v1/clean'
        ? handler()
        : json({ detail: 'unmocked' }, 500),
    ),
  );
}

/** @param {{ mock: { calls: unknown[][] } }} fetch The body of the first request it received. */
const sentBody = (fetch) =>
  JSON.parse(String(/** @type {RequestInit} */ (fetch.mock.calls[0][1]).body));

function renderCleanUp() {
  return render(
    <StrictMode>
      <CleanUp />
    </StrictMode>,
  );
}

describe('CleanUp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains what removing leftovers does', () => {
    renderCleanUp();
    expect(screen.getByRole('region', { name: 'Clean up' })).toBeInTheDocument();
    expect(screen.getByText(/Running downloads are never touched/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('previews what a clean up would remove', async () => {
    mockClean(() =>
      json({ dry_run: true, folders: ['a', 'b'], freed_bytes: 2048, skipped_in_use: 1 }),
    );
    const user = userEvent.setup();
    renderCleanUp();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Would remove 2 folder(s), 2.0 KB. 1 in use were skipped.',
    );
    expect(sentBody(/** @type {any} */ (fetch))).toEqual({ dry_run: true });
  });

  it('removes leftovers and says what was removed', async () => {
    mockClean(() => json({ dry_run: false, folders: ['a'], freed_bytes: 1024, skipped_in_use: 0 }));
    const user = userEvent.setup();
    renderCleanUp();
    await user.click(screen.getByRole('button', { name: 'Remove leftovers' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Removed 1 folder(s), 1.0 KB.');
    expect(sentBody(/** @type {any} */ (fetch))).toEqual({ dry_run: false });
  });

  it('reports when there is nothing to clean', async () => {
    mockClean(() => json({ dry_run: false, folders: [], freed_bytes: 0, skipped_in_use: 0 }));
    const user = userEvent.setup();
    renderCleanUp();
    await user.click(screen.getByRole('button', { name: 'Remove leftovers' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Nothing to clean.');
  });

  it('shows an error when the clean up fails, then clears it on the next success', async () => {
    let fail = true;
    mockClean(() =>
      fail
        ? json({ detail: 'Clean up failed.' }, 500)
        : json({ dry_run: true, folders: [], freed_bytes: 0, skipped_in_use: 0 }),
    );
    const user = userEvent.setup();
    renderCleanUp();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Clean up failed.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    mockClean(() => json({ dry_run: true, folders: ['a'], freed_bytes: 10, skipped_in_use: 0 }));
    const user = userEvent.setup();
    const { container } = renderCleanUp();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByRole('status');
    expect(await axe(container)).toHaveNoViolations();
  });
});
