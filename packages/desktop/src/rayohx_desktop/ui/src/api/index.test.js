import { describe, expect, it } from 'vitest';

import * as api from './index.js';

describe('api', () => {
  it('offers the errors and each group of calls', () => {
    expect(Object.keys(api).sort()).toEqual([
      'ApiError',
      'bridge',
      'clean',
      'downloads',
      'errorMessage',
      'inspect',
      'settings',
    ]);
  });

  it('keeps the calls under their groups', () => {
    expect(Object.keys(api.downloads).sort()).toEqual([
      'clear',
      'control',
      'list',
      'log',
      'remove',
      'retry',
      'start',
    ]);
    expect(Object.keys(api.settings).sort()).toEqual(['get', 'save', 'saveDefaults']);
    expect(Object.keys(api.inspect)).toEqual(['run']);
    expect(Object.keys(api.clean)).toEqual(['run']);
    expect(Object.keys(api.bridge).sort()).toEqual([
      'chooseFile',
      'chooseFolder',
      'openDownloadsFolder',
    ]);
  });
});
