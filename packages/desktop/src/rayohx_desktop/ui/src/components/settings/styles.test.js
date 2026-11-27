import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCardStyles } from './styles.js';

describe('useCardStyles', () => {
  it('gives a class name for each style the settings cards share', () => {
    const { result } = renderHook(() => useCardStyles());
    expect(Object.keys(result.current).sort()).toEqual(['card', 'heading', 'row', 'split']);
    for (const name of Object.values(result.current)) {
      expect(typeof name).toBe('string');
      expect(name).not.toBe('');
    }
  });

  it('gives the same classes on every render', () => {
    const { result, rerender } = renderHook(() => useCardStyles());
    const first = { ...result.current };
    rerender();
    expect(result.current).toEqual(first);
  });
});
