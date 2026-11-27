import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SectionFields from './SectionFields.jsx';

/** @param {Partial<import('react').ComponentProps<typeof SectionFields>> & { section: string }} props */
function renderSection(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <SectionFields values={{}} onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('SectionFields', () => {
  it('shows the fields of the named section', () => {
    renderSection({ section: 'engine' });
    expect(screen.getByLabelText('Parallel segments')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Resume partial downloads' })).toBeChecked();
  });

  it('shows nothing for a section that does not exist', () => {
    const { container } = renderSection({ section: 'nope' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('reports a change with the section id', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSection({ section: 'engine' });
    await user.type(screen.getByLabelText('Parallel segments'), '8');
    expect(onChange).toHaveBeenCalledWith('engine.concurrency', '8');
  });

  it('fills fields from the values', () => {
    renderSection({ section: 'engine', values: { 'engine.concurrency': '6' } });
    expect(screen.getByLabelText('Parallel segments')).toHaveValue(6);
  });

  it('leaves out fields that need local paths unless they are allowed', () => {
    const { unmount } = renderSection({ section: 'engine' });
    expect(screen.queryByText('Allow file: key addresses')).not.toBeInTheDocument();
    unmount();
    renderSection({ section: 'engine', allowLocalPaths: true });
    expect(screen.getByText('Allow file: key addresses')).toBeInTheDocument();
  });

  it('splits a section that names groups into tabs', async () => {
    const user = userEvent.setup();
    renderSection({ section: 'network' });
    for (const name of ['Request', 'Proxy', 'Connection', 'Security']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('combobox', { name: 'User agent' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByLabelText('Retries')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'User agent' })).not.toBeInTheDocument();
  });

  it('hides local-path fields inside a group unless they are allowed', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSection({ section: 'network' });
    expect(screen.queryByLabelText('Cookie file (cookies.txt)')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Security' }));
    expect(screen.queryByLabelText('CA bundle')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hosts that may get credentials')).toBeInTheDocument();
    unmount();
    renderSection({ section: 'network', allowLocalPaths: true });
    expect(screen.getByLabelText('Cookie file (cookies.txt)')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Security' }));
    expect(screen.getByLabelText('CA bundle')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSection({ section: 'network' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
