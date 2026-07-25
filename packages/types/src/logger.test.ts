import { describe, it, expect } from 'vitest';
import { formatBytes } from './logger.js';

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes without decimal', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats KB with one decimal', () => {
    const result = formatBytes(1536);
    expect(result).toMatch(/1\.5 KB/);
  });

  it('formats MB', () => {
    const result = formatBytes(1048576 * 5);
    expect(result).toMatch(/5\.0 MB/);
  });
});
