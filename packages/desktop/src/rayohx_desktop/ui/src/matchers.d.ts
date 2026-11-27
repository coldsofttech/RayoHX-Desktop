// Type-only: makes the jest-dom and vitest-axe matchers (toBeInTheDocument, toHaveNoViolations)
// known to the editor. They are registered at run time in vitest.setup.js.
import '@testing-library/jest-dom/vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
