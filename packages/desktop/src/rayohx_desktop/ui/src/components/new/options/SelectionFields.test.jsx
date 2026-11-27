import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { streamChoices } from '../../../options.js';
import SelectionFields from './SelectionFields.jsx';

const MASTER = {
  variants: [
    { index: 1, name: null, resolution: '1280x720', bandwidth: 2000000 },
    { index: 2, name: 'Audio only', resolution: null, bandwidth: 128000 },
  ],
  audio_tracks: [{ name: 'English' }],
  subtitle_tracks: [{ name: 'French' }],
};
const CHOICES = streamChoices(MASTER);

/** @param {Partial<import('react').ComponentProps<typeof SelectionFields>>} [props] */
function renderSelection(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <SelectionFields values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('SelectionFields', () => {
  it('shows the stream filters', () => {
    renderSelection();
    for (const label of [
      'Stream',
      'Size',
      'Highest height',
      'Bitrate (kbps)',
      'Highest bitrate (kbps)',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('combobox', { name: 'Codec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Range' })).toBeInTheDocument();
  });

  it('leaves out the track fields when the stream has no tracks', () => {
    renderSelection();
    expect(screen.queryByLabelText('Audio track names')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subtitle track names')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Video only/ })).not.toBeInTheDocument();
  });

  it('shows the track fields once the stream has tracks', () => {
    renderSelection({ choices: CHOICES });
    expect(screen.getByRole('combobox', { name: 'Audio track names' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Subtitle track names' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Video only/ })).toBeInTheDocument();
  });

  it('shows only the track fields the stream has', () => {
    renderSelection({ choices: streamChoices({ ...MASTER, subtitle_tracks: [] }) });
    expect(screen.getByRole('combobox', { name: 'Audio track names' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Subtitle track names')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Video only/ })).toBeInTheDocument();
  });

  it('offers what the stream has as choices', async () => {
    const user = userEvent.setup();
    renderSelection({ choices: CHOICES });
    await user.click(screen.getByRole('combobox', { name: 'Stream' }));
    expect(screen.getByRole('option', { name: '#1 · 1280x720 · 2000 kbps' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '#2 · Audio only · 128 kbps' })).toBeInTheDocument();
  });

  it('reports a change with the selection id', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelection();
    await user.type(screen.getByLabelText('Size'), '7');
    expect(onChange).toHaveBeenCalledWith('selection.resolution', '7');
  });

  it('fills fields from the values', () => {
    renderSelection({ values: { 'selection.resolution': '1280x720' } });
    expect(screen.getByLabelText('Size')).toHaveValue('1280x720');
  });

  it('switches the filters off while a single stream is picked', () => {
    renderSelection({ choices: CHOICES, values: { 'selection.variant': '1' } });
    expect(screen.getByRole('combobox', { name: 'Stream' })).toBeEnabled();
    for (const label of ['Size', 'Highest height', 'Bitrate (kbps)', 'Highest bitrate (kbps)']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole('combobox', { name: 'Codec' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Range' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Audio track names' })).toBeEnabled();
  });

  it('keeps the filters on while no stream is picked', () => {
    renderSelection({ choices: CHOICES });
    expect(screen.getByLabelText('Size')).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Codec' })).toBeEnabled();
  });

  it('switches the track names off for video only', () => {
    renderSelection({ choices: CHOICES, values: { 'selection.video_only': true } });
    expect(screen.getByRole('combobox', { name: 'Audio track names' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Subtitle track names' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Video only/ })).toBeEnabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSelection({ choices: CHOICES });
    expect(await axe(container)).toHaveNoViolations();
  });
});
