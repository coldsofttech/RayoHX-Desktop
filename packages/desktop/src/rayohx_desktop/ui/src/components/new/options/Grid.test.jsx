import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Grid from './Grid.jsx';

const FIELDS = [
  { key: 'referer', label: 'Referer', type: 'text' },
  { key: 'retries', label: 'Retries', type: 'number' },
  { key: 'headers', label: 'Headers', type: 'lines' },
  { key: 'insecure', label: 'Skip checks', type: 'bool' },
];

/** @param {Partial<import('react').ComponentProps<typeof Grid>>} [props] */
function renderGrid(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <Grid fields={FIELDS} prefix="network" values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('Grid', () => {
  it('shows one control for each field', () => {
    renderGrid();
    expect(screen.getByLabelText('Referer')).toBeInTheDocument();
    expect(screen.getByLabelText('Retries')).toBeInTheDocument();
    expect(screen.getByLabelText('Headers')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip checks' })).toBeInTheDocument();
  });

  it('shows nothing for no fields', () => {
    const { container } = renderGrid({ fields: [] });
    expect(container.firstElementChild?.children).toHaveLength(0);
  });

  it('fills each control from the value stored under its prefixed id', () => {
    renderGrid({
      values: {
        'network.referer': 'https://x/',
        'network.insecure': true,
        'other.referer': 'not this one',
      },
    });
    expect(screen.getByLabelText('Referer')).toHaveValue('https://x/');
    expect(screen.getByRole('checkbox', { name: 'Skip checks' })).toBeChecked();
  });

  it('reports a change with the prefixed id', async () => {
    const user = userEvent.setup();
    const { onChange } = renderGrid();
    await user.type(screen.getByLabelText('Referer'), 'r');
    expect(onChange).toHaveBeenCalledWith('network.referer', 'r');
    await user.click(screen.getByRole('checkbox', { name: 'Skip checks' }));
    expect(onChange).toHaveBeenCalledWith('network.insecure', true);
  });

  it('turns a field into a dropdown when the stream has choices for it', async () => {
    const user = userEvent.setup();
    const { onChange } = renderGrid({
      choices: { 'network.retries': [{ value: '3', label: 'Three' }] },
    });
    await user.click(screen.getByRole('combobox', { name: 'Retries' }));
    await user.click(screen.getByRole('option', { name: 'Three' }));
    expect(onChange).toHaveBeenCalledWith('network.retries', '3');
    expect(screen.getByLabelText('Referer').tagName).toBe('INPUT');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderGrid();
    expect(await axe(container)).toHaveNoViolations();
  });
});
