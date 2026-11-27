import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Quality from './Quality.jsx';

/** @param {string} [value] */
function renderQuality(value = 'best') {
  const onChange = vi.fn();
  const view = render(
    <StrictMode>
      <Quality value={value} onChange={onChange} />
    </StrictMode>,
  );
  return { onChange, ...view };
}

describe('Quality', () => {
  it('shows the chosen quality under its label', () => {
    renderQuality('720p');
    expect(screen.getByLabelText('Quality')).toHaveValue('720p');
  });

  it('offers every quality', async () => {
    const user = userEvent.setup();
    renderQuality();
    await user.click(screen.getByLabelText('Quality'));
    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['best', '1080p', '720p', '480p', '360p', 'worst']);
  });

  it('reports the quality that was picked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderQuality();
    await user.click(screen.getByLabelText('Quality'));
    await user.click(screen.getByRole('option', { name: '480p' }));
    expect(onChange).toHaveBeenCalledWith('480p');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderQuality();
    expect(await axe(container)).toHaveNoViolations();
  });
});
