import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';
import About from './About.jsx';

/** @param {string} [version] */
function renderAbout(version = '0.1.0') {
  return render(
    <StrictMode>
      <About version={version} />
    </StrictMode>,
  );
}

describe('About', () => {
  it('says what the app is and where its data stays', () => {
    renderAbout();
    expect(screen.getByRole('region', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText(/fast, private downloader for HLS streams/)).toBeInTheDocument();
    expect(screen.getByText(/stay on this computer/)).toBeInTheDocument();
  });

  it('shows the version it is given', () => {
    renderAbout('2.3.4');
    expect(screen.getByText('Version 2.3.4')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderAbout();
    expect(await axe(container)).toHaveNoViolations();
  });
});
