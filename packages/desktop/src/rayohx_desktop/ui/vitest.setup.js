import { afterEach, expect } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import * as axeMatchers from 'vitest-axe/matchers';
import '@testing-library/jest-dom/vitest';

expect.extend(axeMatchers);

// Render every test in StrictMode to surface unsafe effects.
configure({ reactStrictMode: true });

afterEach(() => cleanup());

// jsdom has no ResizeObserver, which Fluent's message bar and tabs use.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
