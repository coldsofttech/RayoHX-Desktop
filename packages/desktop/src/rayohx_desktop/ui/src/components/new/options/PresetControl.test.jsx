import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PresetControl from './PresetControl.jsx';

const FIELD = {
  key: 'user_agent',
  label: 'User agent',
  type: 'preset',
  presets: [
    { label: 'Chrome (Windows)', value: 'UA-CHROME' },
    { label: 'Firefox (Windows)', value: 'UA-FIREFOX' },
  ],
};

/**
 * Keeps the value the way the form does, so the Custom text field can be typed into.
 * @param {{ start?: string, onChange?: (next: string) => void, disabled?: boolean }} props
 */
function Harness({ start = '', onChange = () => {}, disabled }) {
  const [value, setValue] = useState(start);
  return (
    <PresetControl
      field={FIELD}
      value={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/** @param {Parameters<typeof Harness>[0]} [props] */
const renderPreset = (props) =>
  render(
    <StrictMode>
      <Harness {...props} />
    </StrictMode>,
  );

describe('PresetControl', () => {
  it('shows nothing chosen, with a Default placeholder, when there is no value', () => {
    renderPreset();
    const box = screen.getByRole('combobox', { name: 'User agent' });
    expect(box).toHaveValue('');
    expect(box).toHaveTextContent('Default');
    expect(screen.queryByLabelText('User agent text')).not.toBeInTheDocument();
  });

  it('shows the name of a known value', () => {
    renderPreset({ start: 'UA-FIREFOX' });
    expect(screen.getByRole('combobox', { name: 'User agent' })).toHaveValue('Firefox (Windows)');
    expect(screen.queryByLabelText('User agent text')).not.toBeInTheDocument();
  });

  it('offers every preset and Custom', async () => {
    const user = userEvent.setup();
    renderPreset();
    await user.click(screen.getByRole('combobox', { name: 'User agent' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Chrome (Windows)',
      'Firefox (Windows)',
      'Custom',
    ]);
  });

  it('reports the value of the preset that was picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPreset({ onChange });
    await user.click(screen.getByRole('combobox', { name: 'User agent' }));
    await user.click(screen.getByRole('option', { name: 'Chrome (Windows)' }));
    expect(onChange).toHaveBeenCalledWith('UA-CHROME');
    expect(screen.queryByLabelText('User agent text')).not.toBeInTheDocument();
  });

  it('shows Custom and a text field for a value that is not a preset', () => {
    renderPreset({ start: 'MyBrowser/1.0' });
    expect(screen.getByRole('combobox', { name: 'User agent' })).toHaveValue('Custom');
    expect(screen.getByLabelText('User agent text')).toHaveValue('MyBrowser/1.0');
  });

  it('opens a text field when Custom is picked and reports what is typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPreset({ start: 'UA-CHROME', onChange });
    await user.click(screen.getByRole('combobox', { name: 'User agent' }));
    await user.click(screen.getByRole('option', { name: 'Custom' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    const text = screen.getByLabelText('User agent text');
    expect(text).toHaveValue('');
    await user.type(text, 'Mine');
    expect(onChange).toHaveBeenLastCalledWith('Mine');
  });

  it('closes the text field again when a preset is picked', async () => {
    const user = userEvent.setup();
    renderPreset({ start: 'MyBrowser/1.0' });
    await user.click(screen.getByRole('combobox', { name: 'User agent' }));
    await user.click(screen.getByRole('option', { name: 'Firefox (Windows)' }));
    expect(screen.queryByLabelText('User agent text')).not.toBeInTheDocument();
  });

  it('can be disabled', () => {
    renderPreset({ start: 'MyBrowser/1.0', disabled: true });
    expect(screen.getByRole('combobox', { name: 'User agent' })).toBeDisabled();
    expect(screen.getByLabelText('User agent text')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPreset({ start: 'MyBrowser/1.0' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
