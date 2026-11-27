import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Fields from './Fields.jsx';

const PLAIN = [
  { key: 'format', label: 'Format', type: 'text' },
  { key: 'directory', label: 'Folder', type: 'text' },
];
const GROUPED = [
  { key: 'base', label: 'Base', type: 'text' },
  { key: 'referer', label: 'Referer', type: 'text', group: 'Request' },
  { key: 'origin', label: 'Origin', type: 'text', group: 'Request' },
  { key: 'retries', label: 'Retries', type: 'number', group: 'Connection' },
  { key: 'ca', label: 'CA bundle', type: 'text', group: 'Security' },
];

/** @param {Partial<import('react').ComponentProps<typeof Fields>>} [props] */
function renderFields(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <Fields fields={PLAIN} prefix="output" values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('Fields', () => {
  it('shows every field and no tabs when none names a group', () => {
    renderFields();
    expect(screen.getByLabelText('Format')).toBeInTheDocument();
    expect(screen.getByLabelText('Folder')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows nothing for no fields', () => {
    renderFields({ fields: [] });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('adds a tab for each group, in order, and opens the first', () => {
    renderFields({ fields: GROUPED });
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    for (const name of ['Request', 'Connection', 'Security']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'false');
  });

  it('always shows fields without a group, and only the open group', () => {
    renderFields({ fields: GROUPED });
    expect(screen.getByLabelText('Base')).toBeInTheDocument();
    expect(screen.getByLabelText('Referer')).toBeInTheDocument();
    expect(screen.getByLabelText('Origin')).toBeInTheDocument();
    expect(screen.queryByLabelText('Retries')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('CA bundle')).not.toBeInTheDocument();
  });

  it('switches groups from the tabs', async () => {
    const user = userEvent.setup();
    renderFields({ fields: GROUPED });
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByRole('tab', { name: 'Connection' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Retries')).toBeInTheDocument();
    expect(screen.queryByLabelText('Referer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Base')).toBeInTheDocument();
  });

  it('falls back to the first group when the open one disappears', () => {
    const { rerender } = renderFields({ fields: GROUPED });
    const withoutRequest = GROUPED.filter((field) => field.group !== 'Request');
    rerender(
      <StrictMode>
        <Fields fields={withoutRequest} prefix="output" values={{}} onChange={() => {}} />
      </StrictMode>,
    );
    expect(screen.getByRole('tab', { name: 'Connection' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Retries')).toBeInTheDocument();
  });

  it('reports changes with the prefixed id and fills fields from the values', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFields({
      fields: GROUPED,
      prefix: 'network',
      values: { 'network.referer': 'https://x/' },
    });
    expect(screen.getByLabelText('Referer')).toHaveValue('https://x/');
    await user.type(screen.getByLabelText('Base'), 'b');
    expect(onChange).toHaveBeenCalledWith('network.base', 'b');
  });

  it('passes the stream choices down', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFields({
      choices: { 'output.format': [{ value: 'mp4', label: 'MP4' }] },
    });
    await user.click(screen.getByRole('combobox', { name: 'Format' }));
    await user.click(screen.getByRole('option', { name: 'MP4' }));
    expect(onChange).toHaveBeenCalledWith('output.format', 'mp4');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderFields({ fields: GROUPED });
    expect(await axe(container)).toHaveNoViolations();
  });
});
