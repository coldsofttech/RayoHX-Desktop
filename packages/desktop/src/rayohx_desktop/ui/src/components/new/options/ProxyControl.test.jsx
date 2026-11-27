import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProxyControl from './ProxyControl.jsx';

const FIELD = { key: 'proxy.url', label: 'Proxy', type: 'proxy' };

/** @param {Partial<import('react').ComponentProps<typeof ProxyControl>>} [props] */
function renderProxy(props) {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <ProxyControl field={FIELD} value="" onChange={onChange} {...props} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('ProxyControl', () => {
  it('starts with http and an empty host', () => {
    renderProxy();
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toHaveValue('http');
    expect(screen.getByLabelText('Proxy host')).toHaveValue('');
    expect(
      screen.getByText('Host and port, for example proxy.example.com:8080.'),
    ).toBeInTheDocument();
  });

  it('splits the address into its scheme and host', () => {
    renderProxy({ value: 'socks5://proxy.example.com:1080' });
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toHaveValue('socks5');
    expect(screen.getByLabelText('Proxy host')).toHaveValue('proxy.example.com:1080');
  });

  it('shows no value as empty', () => {
    renderProxy({ value: undefined });
    expect(screen.getByLabelText('Proxy host')).toHaveValue('');
  });

  it('offers the schemes a proxy can use', async () => {
    const user = userEvent.setup();
    renderProxy();
    await user.click(screen.getByRole('combobox', { name: 'Proxy type' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'http',
      'https',
      'socks5',
      'socks5h',
    ]);
  });

  it('puts the scheme in front of a typed host', async () => {
    const user = userEvent.setup();
    const { onChange } = renderProxy();
    await user.type(screen.getByLabelText('Proxy host'), 'h');
    expect(onChange).toHaveBeenCalledWith('http://h');
  });

  it('keeps the scheme it was given when the host changes', async () => {
    const user = userEvent.setup();
    const { onChange } = renderProxy({ value: 'socks5://h' });
    await user.type(screen.getByLabelText('Proxy host'), '1');
    expect(onChange).toHaveBeenCalledWith('socks5://h1');
  });

  it('reports an empty address once the host is cleared', async () => {
    const user = userEvent.setup();
    const { onChange } = renderProxy({ value: 'http://h' });
    await user.clear(screen.getByLabelText('Proxy host'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('changes the scheme of an address that has a host', async () => {
    const user = userEvent.setup();
    const { onChange } = renderProxy({ value: 'http://proxy:8080' });
    await user.click(screen.getByRole('combobox', { name: 'Proxy type' }));
    await user.click(screen.getByRole('option', { name: 'socks5h' }));
    expect(onChange).toHaveBeenCalledWith('socks5h://proxy:8080');
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toHaveValue('socks5h');
  });

  it('only remembers the scheme while there is no host yet', async () => {
    const user = userEvent.setup();
    const { onChange } = renderProxy();
    await user.click(screen.getByRole('combobox', { name: 'Proxy type' }));
    await user.click(screen.getByRole('option', { name: 'https' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toHaveValue('https');
    await user.type(screen.getByLabelText('Proxy host'), 'h');
    expect(onChange).toHaveBeenCalledWith('https://h');
  });

  it('can be disabled', () => {
    renderProxy({ disabled: true });
    expect(screen.getByRole('combobox', { name: 'Proxy type' })).toBeDisabled();
    expect(screen.getByLabelText('Proxy host')).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderProxy({ value: 'http://h' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
