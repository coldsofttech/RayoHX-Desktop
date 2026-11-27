import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOptionStyles } from './styles.js';

describe('useOptionStyles', () => {
  it('gives a class name for each style the option fields share', () => {
    const { result } = renderHook(() => useOptionStyles());
    expect(Object.keys(result.current).sort()).toEqual(['checks', 'file', 'grid', 'proxy', 'wide']);
    for (const name of Object.values(result.current)) {
      expect(typeof name).toBe('string');
      expect(name).not.toBe('');
    }
  });

  it('gives the same classes on every render', () => {
    const { result, rerender } = renderHook(() => useOptionStyles());
    const first = { ...result.current };
    rerender();
    expect(result.current).toEqual(first);
  });
});
