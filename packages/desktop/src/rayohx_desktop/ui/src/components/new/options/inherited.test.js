import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Inherited, useInherited } from './inherited.js';

describe('useInherited', () => {
  it('is empty when nothing provides the saved defaults', () => {
    const { result } = renderHook(() => useInherited());
    expect(result.current).toEqual({});
  });

  it('gives the saved defaults from the nearest provider', () => {
    const defaults = { 'connection.retries': 5 };
    const { result } = renderHook(() => useInherited(), {
      wrapper: ({ children }) => createElement(Inherited.Provider, { value: defaults }, children),
    });
    expect(result.current).toBe(defaults);
  });
});
