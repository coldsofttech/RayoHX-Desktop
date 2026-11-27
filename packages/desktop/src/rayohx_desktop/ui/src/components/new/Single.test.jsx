import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Single from './Single.jsx';

/**
 * Keeps the address the way the form does, so typing builds it up.
 * @param {Partial<import('react').ComponentProps<typeof Single>> & { start?: string }} props
 */
function Harness({ start = '', onUrl = () => {}, onSubmit = () => {}, ...props }) {
  const [url, setUrl] = useState(start);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Single
        url={url}
        onUrl={(next) => {
          setUrl(next);
          onUrl(next);
        }}
        busy={false}
        ready={Boolean(url)}
        connectionOpen={false}
        onConnection={() => {}}
        {...props}
      />
    </form>
  );
}

/** @param {Parameters<typeof Harness>[0]} [props] */
const renderSingle = (props) =>
  render(
    <StrictMode>
      <Harness {...props} />
    </StrictMode>,
  );

describe('Single', () => {
  it('asks for one required playlist address', () => {
    renderSingle();
    const field = screen.getByLabelText('Playlist address');
    expect(field).toHaveAttribute('type', 'url');
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('placeholder', 'https://cdn.example.com/vod/master.m3u8');
  });

  it('shows the address it is given', () => {
    renderSingle({ start: 'https://x/m.m3u8' });
    expect(screen.getByLabelText('Playlist address')).toHaveValue('https://x/m.m3u8');
  });

  it('reports what is typed', async () => {
    const onUrl = vi.fn();
    const user = userEvent.setup();
    renderSingle({ onUrl });
    await user.type(screen.getByLabelText('Playlist address'), 'abc');
    expect(onUrl).toHaveBeenLastCalledWith('abc');
  });

  it('enables Inspect once there is an address, and submits from it', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderSingle({ onSubmit });
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
    await user.type(screen.getByLabelText('Playlist address'), 'https://x/m.m3u8');
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables Inspect while busy', () => {
    renderSingle({ start: 'https://x/m.m3u8', busy: true });
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  });

  it('toggles the connection options', async () => {
    const onConnection = vi.fn();
    const user = userEvent.setup();
    renderSingle({ onConnection, connectionOpen: true });
    const button = screen.getByRole('button', { name: 'Connection' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);
    expect(onConnection).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSingle({ start: 'https://x/m.m3u8' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
