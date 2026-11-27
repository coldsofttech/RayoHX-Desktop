import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileControl from './FileControl.jsx';

const FIELD = {
  key: 'cookie_file',
  label: 'Cookie file (cookies.txt)',
  type: 'text',
  types: ['Cookie files (*.txt)', 'All files (*.*)'],
  hint: 'Netscape format.',
};

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

/** @param {(init: RequestInit) => Promise<unknown>} handler Answers `POST /api/bridge/choose_file`. */
function mockDialog(handler) {
  const choose = vi.fn(handler);
  vi.stubGlobal(
    'fetch',
    vi.fn((/** @type {string} */ url, /** @type {RequestInit} */ init = {}) =>
      `${init.method ?? 'GET'} ${url}` === 'POST /api/bridge/choose_file'
        ? choose(init)
        : json({ detail: 'unmocked' }, 500),
    ),
  );
  return choose;
}

/** @param {Partial<import('react').ComponentProps<typeof FileControl>>} [props] */
function renderControl(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <FileControl field={FIELD} value="" onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('FileControl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the path and the hint', () => {
    renderControl({ value: 'C:\\c.txt' });
    expect(screen.getByLabelText('Cookie file (cookies.txt)')).toHaveValue('C:\\c.txt');
    expect(screen.getByText('Netscape format.')).toBeInTheDocument();
  });

  it('shows an empty path for no value', () => {
    renderControl({ value: undefined });
    expect(screen.getByLabelText('Cookie file (cookies.txt)')).toHaveValue('');
  });

  it('reports a path typed by hand', async () => {
    const user = userEvent.setup();
    const { onChange } = renderControl();
    await user.type(screen.getByLabelText('Cookie file (cookies.txt)'), 'c');
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('asks the window for a file of the right types and reports the path', async () => {
    const choose = mockDialog(() => json({ result: ['C:\\picked.txt'] }));
    const user = userEvent.setup();
    const { onChange } = renderControl();
    await user.click(screen.getByRole('button', { name: 'Browse for Cookie file (cookies.txt)' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('C:\\picked.txt'));
    expect(JSON.parse(String(choose.mock.calls[0][0].body))).toEqual({
      file_types: ['Cookie files (*.txt)', 'All files (*.*)'],
    });
  });

  it('keeps the path when the dialog is closed', async () => {
    const choose = mockDialog(() => json({ result: null }));
    const user = userEvent.setup();
    const { onChange } = renderControl({ value: 'C:\\old.txt' });
    await user.click(screen.getByRole('button', { name: /Browse for/ }));
    await waitFor(() => expect(choose).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says why the window cannot pick a file', async () => {
    mockDialog(() => json({ available: false, reason: 'No window.' }));
    const user = userEvent.setup();
    const { onChange } = renderControl();
    await user.click(screen.getByRole('button', { name: /Browse for/ }));
    expect(await screen.findByText('No window.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the message on the next try', async () => {
    let calls = 0;
    mockDialog(() =>
      ++calls === 1 ? json({ available: false, reason: 'No window.' }) : json({ result: null }),
    );
    const user = userEvent.setup();
    renderControl();
    await user.click(screen.getByRole('button', { name: /Browse for/ }));
    expect(await screen.findByText('No window.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Browse for/ }));
    await waitFor(() => expect(screen.queryByText('No window.')).not.toBeInTheDocument());
  });

  it('can be disabled', () => {
    renderControl({ disabled: true });
    expect(screen.getByLabelText('Cookie file (cookies.txt)')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Browse for/ })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderControl({ value: 'C:\\c.txt' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
