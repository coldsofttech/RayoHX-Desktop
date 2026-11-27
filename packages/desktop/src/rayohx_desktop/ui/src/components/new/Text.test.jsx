import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Text from './Text.jsx';

/**
 * Keeps the text and base address the way the form does, so typing builds them up.
 * @param {Partial<import('react').ComponentProps<typeof Text>> & { text?: string, base?: string }} props
 */
function Harness({ text: startText = '', base: startBase = '', onText, onBase, ...props }) {
  const [text, setText] = useState(startText);
  const [base, setBase] = useState(startBase);
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <Text
        text={text}
        onText={(next) => {
          setText(next);
          onText?.(next);
        }}
        base={base}
        onBase={(next) => {
          setBase(next);
          onBase?.(next);
        }}
        busy={false}
        ready={Boolean(text && base)}
        connectionOpen={false}
        onConnection={() => {}}
        {...props}
      />
    </form>
  );
}

/** @param {Parameters<typeof Harness>[0]} [props] */
const renderText = (props) =>
  render(
    <StrictMode>
      <Harness {...props} />
    </StrictMode>,
  );

describe('Text', () => {
  it('asks for the playlist text and the address it is resolved against', () => {
    renderText();
    expect(screen.getByLabelText('Playlist text')).toBeInTheDocument();
    expect(screen.getByLabelText('Base address')).toHaveAttribute('type', 'url');
    expect(screen.getByText('The contents of an .m3u8 file you already have.')).toBeInTheDocument();
    expect(
      screen.getByText('Relative addresses in the playlist are resolved against it.'),
    ).toBeInTheDocument();
  });

  it('shows the values it is given', () => {
    renderText({ text: '#EXTM3U', base: 'https://x/' });
    expect(screen.getByLabelText('Playlist text')).toHaveValue('#EXTM3U');
    expect(screen.getByLabelText('Base address')).toHaveValue('https://x/');
  });

  it('reports what is typed in each field', async () => {
    const onText = vi.fn();
    const onBase = vi.fn();
    const user = userEvent.setup();
    renderText({ onText, onBase });
    await user.type(screen.getByLabelText('Playlist text'), '#EXTM3U');
    await user.type(screen.getByLabelText('Base address'), 'https://x/');
    expect(onText).toHaveBeenLastCalledWith('#EXTM3U');
    expect(onBase).toHaveBeenLastCalledWith('https://x/');
  });

  it('enables Inspect only when both fields are filled', async () => {
    const user = userEvent.setup();
    renderText();
    const inspect = screen.getByRole('button', { name: 'Inspect' });
    expect(inspect).toBeDisabled();
    await user.type(screen.getByLabelText('Playlist text'), '#EXTM3U');
    expect(inspect).toBeDisabled();
    await user.type(screen.getByLabelText('Base address'), 'https://x/');
    expect(inspect).toBeEnabled();
  });

  it('disables Inspect while busy', () => {
    renderText({ text: '#EXTM3U', base: 'https://x/', busy: true });
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  });

  it('toggles the connection options', async () => {
    const onConnection = vi.fn();
    const user = userEvent.setup();
    renderText({ onConnection, connectionOpen: true });
    const button = screen.getByRole('button', { name: 'Connection' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);
    expect(onConnection).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderText({ text: '#EXTM3U', base: 'https://x/' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
