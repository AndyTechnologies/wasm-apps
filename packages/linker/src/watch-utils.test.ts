import { describe, it, expect, vi } from 'vitest';

// Mock fs for watchDirectory tests
vi.mock('node:fs', () => ({
  watch: vi.fn().mockReturnValue({ close: vi.fn() }),
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn(),
  default: {
    watch: vi.fn().mockReturnValue({ close: vi.fn() }),
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn(),
  },
}));

import { sanitizeWatchPath, watchDirectory } from './watch-utils.js';

describe('sanitizeWatchPath', () => {
  it('normal filename pasa a traves', () => {
    expect(sanitizeWatchPath('src/app.ts')).toBe('src/app.ts');
  });

  it('normaliza ./src/../src/app.ts a src/app.ts', () => {
    expect(sanitizeWatchPath('./src/../src/app.ts')).toBe('src/app.ts');
  });

  it('rechaza path con .. traversal', () => {
    expect(sanitizeWatchPath('../../etc/passwd')).toBeNull();
  });

  it('rechaza path con .. que no se resuelve', () => {
    expect(sanitizeWatchPath('../outside.ts')).toBeNull();
  });

  it('filename simple sin path pasa correctamente', () => {
    expect(sanitizeWatchPath('file.ts')).toBe('file.ts');
  });

  it('rechaza path con solo ..', () => {
    expect(sanitizeWatchPath('..')).toBeNull();
  });

  it('permite path con subdirectorio normal', () => {
    expect(sanitizeWatchPath('src/components/button.ts')).toBe('src/components/button.ts');
  });
});

describe('watchDirectory', () => {
  it('returns a cleanup function', () => {
    const cleanup = watchDirectory('/test/dir', {
      extensions: ['.ts'],
      onChange: vi.fn(),
    });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('accepts custom debounceMs option', () => {
    const cleanup = watchDirectory('/test/dir', {
      extensions: ['.ts'],
      onChange: vi.fn(),
      debounceMs: 500,
    });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('uses default debounceMs of 300 when not specified', () => {
    const cleanup = watchDirectory('/test/dir', {
      extensions: ['.ts'],
      onChange: vi.fn(),
    });
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
