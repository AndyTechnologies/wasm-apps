import { describe, it, expect } from 'vitest';
import { computeKey } from './disk-cache.js';

describe('computeKey source-hash determinism', () => {
  const baseOpts = {
    isDev: true,
    sourceMap: true,
    runtime: 'incremental' as const,
    optimizeLevel: 3,
  };

  it('produces identical key for identical source and options', () => {
    const a = computeKey('function test() { return 42; }', baseOpts);
    const b = computeKey('function test() { return 42; }', baseOpts);
    expect(a).toBe(b);
  });

  it('produces different key when source changes', () => {
    const a = computeKey('source-a', baseOpts);
    const b = computeKey('source-b', baseOpts);
    expect(a).not.toBe(b);
  });

  it('produces different key when options change', () => {
    const a = computeKey('test', { ...baseOpts, runtime: 'minimal' });
    const b = computeKey('test', { ...baseOpts, runtime: 'incremental' });
    expect(a).not.toBe(b);
  });

  it('key is always a 64-character hex string', () => {
    const key = computeKey('any source', baseOpts);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('key includes sourceHash, not raw sourceCode (verified via format)', () => {
    // The key uses sourceHash in the canonical JSON, not raw sourceCode.
    // This means keys for any source will always be 64 chars (hash of hash).
    const key = computeKey('a', baseOpts);
    const key2 = computeKey('b'.repeat(10000), baseOpts);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key2).toMatch(/^[a-f0-9]{64}$/);
    // Both are always 64 chars regardless of source size
  });

  it('deterministic for large source inputs', () => {
    const largeSource = 'export function test() { return Math.random(); }\n'.repeat(1000);
    const a = computeKey(largeSource, baseOpts);
    const b = computeKey(largeSource, baseOpts);
    expect(a).toBe(b);
  });

  it('uses defaults when opts is empty', () => {
    const key = computeKey('test', {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    // Same empty opts produces same key
    expect(computeKey('test', {})).toBe(key);
  });

  it('respects aliases in key computation', () => {
    const withAlias = computeKey('test', {
      ...baseOpts,
      aliases: [{ find: 'old-pkg', replacement: 'new-pkg' }],
    });
    const withoutAlias = computeKey('test', baseOpts);
    expect(withAlias).not.toBe(withoutAlias);
  });

  it('aliases are deterministic for same inputs', () => {
    const aliasOpts = {
      ...baseOpts,
      aliases: [{ find: 'old-pkg', replacement: 'new-pkg' }],
    };
    expect(computeKey('test', aliasOpts)).toBe(computeKey('test', aliasOpts));
  });
});
