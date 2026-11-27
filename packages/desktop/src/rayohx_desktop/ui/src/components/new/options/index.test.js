import { describe, expect, it } from 'vitest';
import * as options from './index.js';

describe('options', () => {
  it('offers the three sets of fields the form uses', () => {
    expect(Object.keys(options).sort()).toEqual([
      'OutputFields',
      'SectionFields',
      'SelectionFields',
    ]);
  });

  it('exports each one as a component', () => {
    for (const component of Object.values(options)) {
      expect(typeof component).toBe('function');
    }
  });
});
