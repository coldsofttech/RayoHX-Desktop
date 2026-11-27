import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Multi from './Multi.jsx';

/**
 * Keeps the addresses the way the form does, so typing builds them up.
 * @param {Partial<import('react').ComponentProps<typeof Multi>> & { start?: string }} props
 */
function Harness({ start = '', onUrls = () => {}, ...props }) {
  const [urls, setUrls] = useState(start);
  return (
    <Multi
      urls={urls}
      onUrls={(next) => {
        setUrls(next);
        onUrls(next);
      }}
      quality="best"
      onQuality={() => {}}
      busy={false}
      ready={Boolean(urls)}
      connectionOpen={false}
      onConnection={() => {}}
      onStart={() => {}}
      {...props}
    />
  );
}

/** @param {Parameters<typeof Harness>[0]} [props] */
const renderMulti = (props) =>
  render(
    <StrictMode>
      <Harness {...props} />
    </StrictMode>,
  );

describe('Multi', () => {
  it('asks for one address per line and explains the comments', () => {
    renderMulti();
    expect(screen.getByLabelText('Playlist addresses')).toBeInTheDocument();
    expect(
      screen.getByText('One per line. Lines starting with # are ignored.'),
    ).toBeInTheDocument();
  });

  it('reports what is typed', async () => {
    const onUrls = vi.fn();
    const user = userEvent.setup();
    renderMulti({ onUrls });
    await user.type(screen.getByLabelText('Playlist addresses'), 'a{Enter}b');
    expect(onUrls).toHaveBeenLastCalledWith('a\nb');
  });

  it('shows the quality that applies to every address and reports a change', async () => {
    const onQuality = vi.fn();
    const user = userEvent.setup();
    renderMulti({ quality: '720p', onQuality });
    expect(screen.getByLabelText('Quality')).toHaveValue('720p');
    await user.click(screen.getByLabelText('Quality'));
    await user.click(screen.getByRole('option', { name: '1080p' }));
    expect(onQuality).toHaveBeenCalledWith('1080p');
  });

  it('has no Inspect button, because a batch is not inspected', () => {
    renderMulti({ start: 'https://a/1.m3u8' });
    expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();
  });

  it('starts every address from Download all', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    renderMulti({ start: 'https://a/1.m3u8', onStart });
    await user.click(screen.getByRole('button', { name: 'Download all' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('disables Download all until there is an address', () => {
    renderMulti();
    expect(screen.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });

  it('disables Download all and shows a spinner while busy', () => {
    renderMulti({ start: 'https://a/1.m3u8', busy: true });
    expect(screen.getByRole('button', { name: 'Download all' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('toggles the connection options', async () => {
    const onConnection = vi.fn();
    const user = userEvent.setup();
    renderMulti({ onConnection });
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    expect(onConnection).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderMulti({ start: 'https://a/1.m3u8' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
