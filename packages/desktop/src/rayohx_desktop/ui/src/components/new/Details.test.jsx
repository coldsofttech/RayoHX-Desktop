import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { streamChoices } from '../../options.js';
import Details from './Details.jsx';

const MASTER = {
  type: 'master',
  variants: [
    { index: 1, name: null, resolution: '1280x720', bandwidth: 2000000, codecs: ['avc1'] },
    { index: 2, name: 'Audio only', resolution: null, bandwidth: 128000, codecs: [] },
  ],
  audio_tracks: [{ group: 'a', name: 'English', language: 'en' }],
  subtitle_tracks: [{ group: 's', name: 'French', language: 'fr' }],
};
const MEDIA = { type: 'media', segments: 12, duration: 59.6 };

/** @param {Partial<import('react').ComponentProps<typeof Details>>} [overrides] */
function renderDetails(overrides) {
  const props = {
    playlist: MEDIA,
    mode: 'url',
    panel: 'quick',
    onPanel: vi.fn(),
    tab: 'output',
    onTab: vi.fn(),
    choices: undefined,
    values: {},
    onChange: vi.fn(),
    allowLocalPaths: false,
    quality: 'best',
    onQuality: vi.fn(),
    filename: '',
    onFilename: vi.fn(),
    needsSelection: false,
    busy: false,
    onStart: vi.fn(),
    ...overrides,
  };
  const view = render(
    <StrictMode>
      <Details {...props} />
    </StrictMode>,
  );
  return { props, ...view };
}

describe('Details', () => {
  it('summarises a single stream', () => {
    renderDetails();
    expect(screen.getByRole('region', { name: 'Stream details' })).toBeInTheDocument();
    expect(screen.getByText(/12 segments, 60 s/)).toBeInTheDocument();
  });

  it('counts the streams of a master playlist', () => {
    renderDetails({ playlist: MASTER, choices: streamChoices(MASTER) });
    expect(screen.getByText('2 streams available')).toBeInTheDocument();
  });

  describe('Quick', () => {
    it('shows the quality and none of the Advanced tabs', () => {
      renderDetails({ quality: '720p' });
      expect(screen.getByLabelText('Quality')).toHaveValue('720p');
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('reports a changed quality', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails();
      await user.click(screen.getByLabelText('Quality'));
      await user.click(screen.getByRole('option', { name: '360p' }));
      expect(props.onQuality).toHaveBeenCalledWith('360p');
    });

    it('marks Quick as the chosen way and switches to Advanced', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails();
      expect(screen.getByRole('button', { name: 'Quick' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await user.click(screen.getByRole('button', { name: 'Advanced' }));
      expect(props.onPanel).toHaveBeenCalledWith('advanced');
    });
  });

  describe('Advanced', () => {
    it('marks Advanced as the chosen way and switches back to Quick', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails({ panel: 'advanced' });
      expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Quick' }));
      expect(props.onPanel).toHaveBeenCalledWith('quick');
    });

    it('offers the Stream tab only when the stream has choices', () => {
      const { unmount } = renderDetails({ panel: 'advanced' });
      expect(screen.queryByRole('tab', { name: 'Stream' })).not.toBeInTheDocument();
      for (const name of ['Output', 'Storage', 'Engine']) {
        expect(screen.getByRole('tab', { name })).toBeInTheDocument();
      }
      unmount();
      renderDetails({
        playlist: MASTER,
        panel: 'advanced',
        tab: 'stream',
        choices: streamChoices(MASTER),
      });
      expect(screen.getByRole('tab', { name: 'Stream' })).toBeInTheDocument();
    });

    it('reports the tab that was picked', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails({ panel: 'advanced' });
      await user.click(screen.getByRole('tab', { name: 'Storage' }));
      expect(props.onTab).toHaveBeenCalledWith('storage');
    });

    it('shows what the stream offers on the Stream tab', async () => {
      const user = userEvent.setup();
      renderDetails({
        playlist: MASTER,
        panel: 'advanced',
        tab: 'stream',
        choices: streamChoices(MASTER),
      });
      await user.click(screen.getByRole('combobox', { name: 'Stream' }));
      expect(screen.getByRole('option', { name: '#1 · 1280x720 · 2000 kbps' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Audio track names' })).toBeInTheDocument();
    });

    it('leaves out the track fields when the stream has no tracks', () => {
      const bare = { ...MASTER, audio_tracks: [], subtitle_tracks: [] };
      renderDetails({
        playlist: bare,
        panel: 'advanced',
        tab: 'stream',
        choices: streamChoices(bare),
      });
      expect(screen.queryByLabelText('Audio track names')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Subtitle track names')).not.toBeInTheDocument();
    });

    it('shows the file name and the output options on the Output tab', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails({ panel: 'advanced', tab: 'output' });
      await user.type(screen.getByLabelText('File name'), 'c');
      expect(props.onFilename).toHaveBeenCalledWith('c');
      await user.type(screen.getByLabelText('Folder (inside the download folder)'), 'x');
      expect(props.onChange).toHaveBeenCalledWith('output.directory', 'x');
    });

    it('leaves out the file name for several addresses', () => {
      renderDetails({ mode: 'many', panel: 'advanced', tab: 'output' });
      expect(screen.queryByLabelText('File name')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Folder (inside the download folder)')).toBeInTheDocument();
    });

    it('shows the storage and engine options on their tabs', () => {
      const { unmount } = renderDetails({ panel: 'advanced', tab: 'storage' });
      expect(screen.getByRole('combobox', { name: 'Strategy' })).toBeInTheDocument();
      unmount();
      renderDetails({ panel: 'advanced', tab: 'engine' });
      expect(screen.getByLabelText('Parallel segments')).toBeInTheDocument();
    });

    it('offers file options only when local paths are allowed', () => {
      const { unmount } = renderDetails({ panel: 'advanced', tab: 'engine' });
      expect(screen.queryByText('Allow file: key addresses')).not.toBeInTheDocument();
      unmount();
      renderDetails({ panel: 'advanced', tab: 'engine', allowLocalPaths: true });
      expect(screen.getByText('Allow file: key addresses')).toBeInTheDocument();
    });
  });

  describe('Download', () => {
    it('starts the download', async () => {
      const user = userEvent.setup();
      const { props } = renderDetails();
      await user.click(screen.getByRole('button', { name: 'Download' }));
      expect(props.onStart).toHaveBeenCalledTimes(1);
    });

    it('is disabled while busy', () => {
      renderDetails({ busy: true });
      expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    });

    it('asks for a stream first when none is chosen', () => {
      renderDetails({ panel: 'advanced', needsSelection: true });
      expect(
        screen.getByText('Choose a stream or a size on the Stream tab, or switch to Quick.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    });

    it('does not nag when a choice is made', () => {
      renderDetails({ panel: 'advanced' });
      expect(screen.queryByText(/Choose a stream or a size/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled();
    });
  });

  it('has no accessibility violations', async () => {
    const { container, unmount } = renderDetails();
    expect(await axe(container)).toHaveNoViolations();
    unmount();
    const advanced = renderDetails({
      playlist: MASTER,
      panel: 'advanced',
      tab: 'stream',
      choices: streamChoices(MASTER),
    });
    expect(await axe(advanced.container)).toHaveNoViolations();
  });
});
