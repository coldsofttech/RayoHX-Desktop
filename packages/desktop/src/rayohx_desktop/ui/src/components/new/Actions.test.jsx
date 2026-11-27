import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionButton, InspectActions } from './Actions.jsx';

/** @param {import('react').ReactNode} children */
function renderInForm(children) {
  const onSubmit = vi.fn((/** @type {import('react').FormEvent} */ event) =>
    event.preventDefault(),
  );
  const view = render(
    <StrictMode>
      <form onSubmit={onSubmit}>{children}</form>
    </StrictMode>,
  );
  return { onSubmit, ...view };
}

describe('ConnectionButton', () => {
  it('says whether the connection options are open', () => {
    const { unmount } = renderInForm(<ConnectionButton open={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Connection' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    unmount();
    renderInForm(<ConnectionButton open onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Connection' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('toggles without submitting the form', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const { onSubmit } = renderInForm(<ConnectionButton open={false} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: 'Connection' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('InspectActions', () => {
  /** @param {Partial<import('react').ComponentProps<typeof InspectActions>>} [props] */
  const actions = (props) => (
    <InspectActions busy={false} ready open={false} onToggle={() => {}} {...props} />
  );

  it('offers Connection and Inspect', () => {
    renderInForm(actions());
    expect(screen.getByRole('button', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeEnabled();
  });

  it('submits the form from Inspect', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderInForm(actions());
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables Inspect until there is something to inspect', () => {
    renderInForm(actions({ ready: false }));
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
  });

  it('disables Inspect and shows a spinner while busy', () => {
    renderInForm(actions({ busy: true }));
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows no spinner when idle', () => {
    renderInForm(actions());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('passes the toggle and open state to Connection', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderInForm(actions({ open: true, onToggle }));
    const button = screen.getByRole('button', { name: 'Connection' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInForm(actions());
    expect(await axe(container)).toHaveNoViolations();
  });
});
