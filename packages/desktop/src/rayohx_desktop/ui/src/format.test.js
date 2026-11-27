import { describe, expect, it } from 'vitest';

import { ACTIVE, bitrate, bytes, duration, speed } from './format';

describe('format', () => {
  it('shows a dash when there is no value', () => {
    expect([bytes(null), speed(0), duration(undefined), bitrate(0)]).toEqual(['–', '–', '–', '–']);
  });

  it('formats sizes with the nearest unit', () => {
    expect(bytes(512)).toBe('512 B');
    expect(bytes(1536)).toBe('1.5 KB');
    expect(bytes(5 * 1024 ** 3)).toBe('5.0 GB');
    expect(bytes(2 * 1024 ** 5)).toBe('2048.0 TB');
  });

  it('formats speed, duration and bitrate', () => {
    expect(speed(2048)).toBe('2.0 KB/s');
    expect(duration(65)).toBe('1:05');
    expect(duration(3725)).toBe('1:02:05');
    expect(bitrate(2_500_000)).toBe('2.5 Mbps');
  });

  it('treats paused and running states as active', () => {
    expect(ACTIVE).toContain('paused');
    expect(ACTIVE).not.toContain('completed');
  });
});
