import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SECTIONS } from '../../../options.js';
import Options from './Options.jsx';

/** @param {Partial<import('react').ComponentProps<typeof Options>>} [props] */
function renderOptions(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <Options values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

const header = (/** @type {string} */ name) => screen.getByRole('button', { name });

describe('Options', () => {
  it('shows a collapsed group for each section', () => {
    renderOptions();
    for (const section of SECTIONS) {
      expect(header(section.title)).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('leaves out the sections it is told to hide', () => {
    renderOptions({ hidden: ['network', 'storage'] });
    expect(screen.queryByRole('button', { name: 'Network' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Storage' })).not.toBeInTheDocument();
    expect(header('Output')).toBeInTheDocument();
    expect(header('Engine')).toBeInTheDocument();
  });

  it('opens a group to show its fields', async () => {
    const user = userEvent.setup();
    renderOptions();
    await user.click(header('Engine'));
    expect(header('Engine')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Parallel segments')).toBeInTheDocument();
  });

  it('lets several groups stay open and closes one again', async () => {
    const user = userEvent.setup();
    renderOptions();
    await user.click(header('Engine'));
    await user.click(header('Output'));
    expect(header('Engine')).toHaveAttribute('aria-expanded', 'true');
    expect(header('Output')).toHaveAttribute('aria-expanded', 'true');
    await user.click(header('Engine'));
    expect(header('Engine')).toHaveAttribute('aria-expanded', 'false');
    expect(header('Output')).toHaveAttribute('aria-expanded', 'true');
  });

  it('reports a change with the section and field id', async () => {
    const user = userEvent.setup();
    const { onChange } = renderOptions();
    await user.click(header('Engine'));
    await user.type(screen.getByLabelText('Parallel segments'), '4');
    expect(onChange).toHaveBeenCalledWith('engine.concurrency', '4');
  });

  it('fills fields from the values', async () => {
    const user = userEvent.setup();
    renderOptions({ values: { 'engine.concurrency': '6' } });
    await user.click(header('Engine'));
    expect(screen.getByLabelText('Parallel segments')).toHaveValue(6);
  });

  it('leaves out fields that need local paths unless they are allowed', async () => {
    const user = userEvent.setup();
    const { unmount } = renderOptions();
    await user.click(header('Engine'));
    expect(screen.queryByText('Allow file: key addresses')).not.toBeInTheDocument();
    unmount();
    renderOptions({ allowLocalPaths: true });
    await user.click(header('Engine'));
    expect(screen.getByText('Allow file: key addresses')).toBeInTheDocument();
  });

  it('starts with the stream selection open when the stream has choices', () => {
    renderOptions({
      choices: { 'selection.variant': [{ value: '1', label: '#1 · 1280x720' }] },
    });
    expect(header('Stream selection')).toHaveAttribute('aria-expanded', 'true');
    expect(header('Output')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('combobox', { name: 'Stream' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const user = userEvent.setup();
    const { container } = renderOptions();
    await user.click(header('Engine'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
