import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Control from './Control.jsx';

/** @param {Partial<import('react').ComponentProps<typeof Control>>} [props] */
function renderControl(props = {}) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <Control
        field={{ key: 'referer', label: 'Referer', type: 'text' }}
        value={undefined}
        onChange={onChange}
        {...props}
      />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('Control', () => {
  describe('text and numbers', () => {
    it('shows a text field with its value and hint', () => {
      renderControl({
        field: { key: 'referer', label: 'Referer', type: 'text', hint: 'Where from.' },
        value: 'https://x/',
      });
      expect(screen.getByLabelText('Referer')).toHaveValue('https://x/');
      expect(screen.getByLabelText('Referer')).toHaveAttribute('type', 'text');
      expect(screen.getByText('Where from.')).toBeInTheDocument();
    });

    it('reports typed text', async () => {
      const user = userEvent.setup();
      const { onChange } = renderControl();
      await user.type(screen.getByLabelText('Referer'), 'r');
      expect(onChange).toHaveBeenCalledWith('r');
    });

    it('shows a number field', () => {
      renderControl({ field: { key: 'retries', label: 'Retries', type: 'number' }, value: '5' });
      expect(screen.getByLabelText('Retries')).toHaveAttribute('type', 'number');
      expect(screen.getByLabelText('Retries')).toHaveValue(5);
    });

    it('hides a secret', () => {
      renderControl({ field: { key: 'p', label: 'Password', type: 'secret' }, value: 'hunter2' });
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('shows an empty field for no value', () => {
      renderControl();
      expect(screen.getByLabelText('Referer')).toHaveValue('');
    });

    it('can be disabled', () => {
      renderControl({ disabled: true });
      expect(screen.getByLabelText('Referer')).toBeDisabled();
    });
  });

  describe('tick boxes', () => {
    const field = { key: 'overwrite', label: 'Replace files', type: 'bool' };

    it('shows the value', () => {
      renderControl({ field, value: true });
      expect(screen.getByRole('checkbox', { name: 'Replace files' })).toBeChecked();
    });

    it('is unticked with no value and no fallback', () => {
      renderControl({ field });
      expect(screen.getByRole('checkbox', { name: 'Replace files' })).not.toBeChecked();
    });

    it('uses the fallback when there is no value', () => {
      renderControl({ field: { ...field, fallback: true } });
      expect(screen.getByRole('checkbox', { name: 'Replace files' })).toBeChecked();
    });

    it('reports a boolean', async () => {
      const user = userEvent.setup();
      const { onChange } = renderControl({ field });
      await user.click(screen.getByRole('checkbox', { name: 'Replace files' }));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('ignores choices', () => {
      renderControl({ field, choices: [{ value: 'a', label: 'A' }] });
      expect(screen.getByRole('checkbox', { name: 'Replace files' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('select', () => {
    const field = {
      key: 'format',
      label: 'Format',
      type: 'select',
      options: ['auto', 'mp4', 'ts'],
    };

    it('shows the chosen option and offers all of them', async () => {
      const user = userEvent.setup();
      renderControl({ field, value: 'mp4' });
      const box = screen.getByRole('combobox', { name: 'Format' });
      expect(box).toHaveValue('mp4');
      await user.click(box);
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'auto',
        'mp4',
        'ts',
      ]);
    });

    it('reports the option that was picked', async () => {
      const user = userEvent.setup();
      const { onChange } = renderControl({ field });
      await user.click(screen.getByRole('combobox', { name: 'Format' }));
      await user.click(screen.getByRole('option', { name: 'ts' }));
      expect(onChange).toHaveBeenCalledWith('ts');
    });
  });

  it('shows several lines in a text area', async () => {
    const user = userEvent.setup();
    const { onChange } = renderControl({
      field: { key: 'headers', label: 'Headers', type: 'lines', hint: 'One per line.' },
      value: 'A: 1',
    });
    expect(screen.getByLabelText('Headers')).toHaveValue('A: 1');
    expect(screen.getByLabelText('Headers').tagName).toBe('TEXTAREA');
    await user.type(screen.getByLabelText('Headers'), 'x');
    expect(onChange).toHaveBeenCalledWith('A: 1x');
  });

  it('offers a Browse button for a field that names file types', () => {
    renderControl({
      field: { key: 'cookie_file', label: 'Cookie file', type: 'text', types: ['All (*.*)'] },
    });
    expect(screen.getByRole('button', { name: 'Browse for Cookie file' })).toBeInTheDocument();
  });

  it('shows presets as a dropdown', () => {
    renderControl({
      field: {
        key: 'user_agent',
        label: 'User agent',
        type: 'preset',
        presets: [{ label: 'Chrome', value: 'UA' }],
      },
      value: 'UA',
    });
    expect(screen.getByRole('combobox', { name: 'User agent' })).toHaveValue('Chrome');
  });

  it('shows a proxy as a scheme and a host', () => {
    renderControl({
      field: { key: 'proxy.url', label: 'Proxy', type: 'proxy' },
      value: 'socks5://h:1',
    });
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toHaveValue('socks5');
    expect(screen.getByLabelText('Proxy host')).toHaveValue('h:1');
  });

  describe('choices from the stream', () => {
    const choices = [
      { value: '1', label: '#1 · 720p' },
      { value: '2', label: '#2 · 1080p' },
    ];

    it('turns a field into a dropdown showing the label of the chosen value', () => {
      renderControl({ choices, value: '2' });
      expect(screen.getByRole('combobox', { name: 'Referer' })).toHaveValue('#2 · 1080p');
    });

    it('offers any choice by default and reports the one picked', async () => {
      const user = userEvent.setup();
      const { onChange } = renderControl({ choices });
      const box = screen.getByRole('combobox', { name: 'Referer' });
      expect(box).toHaveTextContent('Any');
      await user.click(box);
      await user.click(screen.getByRole('option', { name: '#1 · 720p' }));
      expect(onChange).toHaveBeenCalledWith('1');
    });

    it('lets a list field take several choices, kept as comma separated text', async () => {
      const user = userEvent.setup();
      const { onChange } = renderControl({
        field: { key: 'audio_names', label: 'Audio track names', type: 'list' },
        choices: [
          { value: 'English', label: 'English' },
          { value: 'French', label: 'French' },
        ],
        value: 'English',
      });
      const box = screen.getByRole('combobox', { name: 'Audio track names' });
      expect(box).toHaveValue('English');
      await user.click(box);
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'French' }));
      expect(onChange).toHaveBeenCalledWith('English,French');
    });

    it('can be disabled', () => {
      renderControl({ choices, disabled: true });
      expect(screen.getByRole('combobox', { name: 'Referer' })).toBeDisabled();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderControl({ value: 'x' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Control with a saved default', () => {
  it('shows a saved text default as the placeholder', () => {
    renderControl({ inherited: '7', field: { key: 'retries', label: 'Retries', type: 'number' } });
    expect(screen.getByLabelText('Retries')).toHaveAttribute('placeholder', '7');
    expect(screen.getByLabelText('Retries')).toHaveValue(null);
  });

  it('shows a saved tick box and choice until one is picked', () => {
    renderControl({
      inherited: true,
      field: { key: 'overwrite', label: 'Replace', type: 'bool' },
    });
    expect(screen.getByRole('checkbox', { name: 'Replace' })).toBeChecked();
  });

  it('prefers what was typed over the saved default', () => {
    renderControl({
      inherited: true,
      value: false,
      field: { key: 'overwrite', label: 'Replace', type: 'bool' },
    });
    expect(screen.getByRole('checkbox', { name: 'Replace' })).not.toBeChecked();
  });

  it('shows a saved choice in a select', () => {
    renderControl({
      inherited: 'mp4',
      field: { key: 'format', label: 'Format', type: 'select', options: ['auto', 'mp4'] },
    });
    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveValue('mp4');
  });
});
