import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OutputFields from './OutputFields.jsx';

/** @param {Partial<import('react').ComponentProps<typeof OutputFields>>} [props] */
function renderOutput(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <OutputFields values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('OutputFields', () => {
  it('shows the output options', () => {
    renderOutput();
    expect(screen.getByRole('combobox', { name: 'Format' })).toBeInTheDocument();
    expect(screen.getByLabelText('Folder (inside the download folder)')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Remux with' })).toBeInTheDocument();
  });

  it('puts the tick boxes together', () => {
    renderOutput();
    expect(
      screen.getByRole('checkbox', { name: 'Replace files that already exist' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Check the finished file' })).toBeInTheDocument();
  });

  it('ticks the options that are on unless told otherwise', () => {
    renderOutput();
    expect(
      screen.getByRole('checkbox', { name: 'Replace files that already exist' }),
    ).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Check the finished file' })).toBeChecked();
  });

  it('fills fields from the values', () => {
    renderOutput({
      values: {
        'output.directory': 'shows',
        'output.format': 'mp4',
        'output.validate': false,
      },
    });
    expect(screen.getByLabelText('Folder (inside the download folder)')).toHaveValue('shows');
    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveValue('mp4');
    expect(screen.getByRole('checkbox', { name: 'Check the finished file' })).not.toBeChecked();
  });

  it('reports a change with the output id', async () => {
    const user = userEvent.setup();
    const { onChange } = renderOutput();
    await user.type(screen.getByLabelText('Folder (inside the download folder)'), 's');
    expect(onChange).toHaveBeenCalledWith('output.directory', 's');
    await user.click(screen.getByRole('checkbox', { name: 'Replace files that already exist' }));
    expect(onChange).toHaveBeenCalledWith('output.overwrite', true);
  });

  describe('FFmpeg path', () => {
    it('is not offered by default', () => {
      renderOutput();
      expect(screen.queryByLabelText('FFmpeg path')).not.toBeInTheDocument();
    });

    it('is not offered when FFmpeg is the remuxer but local paths are not allowed', () => {
      renderOutput({ values: { 'output.remux_backend': 'ffmpeg' } });
      expect(screen.queryByLabelText('FFmpeg path')).not.toBeInTheDocument();
    });

    it('is not offered when local paths are allowed but FFmpeg is not the remuxer', () => {
      renderOutput({ allowLocalPaths: true, values: { 'output.remux_backend': 'native' } });
      expect(screen.queryByLabelText('FFmpeg path')).not.toBeInTheDocument();
    });

    it('is offered when FFmpeg is the remuxer and local paths are allowed', () => {
      renderOutput({ allowLocalPaths: true, values: { 'output.remux_backend': 'ffmpeg' } });
      expect(screen.getByLabelText('FFmpeg path')).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderOutput({
      allowLocalPaths: true,
      values: { 'output.remux_backend': 'ffmpeg' },
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
