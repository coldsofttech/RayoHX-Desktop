import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFormStyles } from './styles.js';

describe('useFormStyles', () => {
  it('gives a class name for each style the new stream form shares', () => {
    const { result } = renderHook(() => useFormStyles());
    expect(Object.keys(result.current).sort()).toEqual([
      'address',
      'card',
      'end',
      'heading',
      'name',
      'row',
      'segments',
      'stack',
    ]);
    for (const name of Object.values(result.current)) {
      expect(typeof name).toBe('string');
      expect(name).not.toBe('');
    }
  });

  it('gives the same classes on every render', () => {
    const { result, rerender } = renderHook(() => useFormStyles());
    const first = { ...result.current };
    rerender();
    expect(result.current).toEqual(first);
  });
});
