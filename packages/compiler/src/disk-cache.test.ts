import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';
import { computeKey } from './disk-cache.js';

describe('computeKey', () => {
  const opts: Partial<Pick<CompileOptions, 'isDev' | 'sourceMap' | 'optimizeLevel' | 'shrinkLevel' | 'runtime'>> = {
    isDev: true,
    sourceMap: true,
    runtime: 'incremental' as const,
    optimizeLevel: 3,
  };

  it('retorna clave consistente para la misma entrada', () => {
    const a = computeKey('hello', opts);
    const b = computeKey('hello', opts);
    expect(a).toBe(b);
  });

  it('retorna clave diferente para source diferente', () => {
    const a = computeKey('hello', opts);
    const b = computeKey('world', opts);
    expect(a).not.toBe(b);
  });

  it('retorna clave diferente para opciones diferentes', () => {
    const a = computeKey('test', opts);
    const b = computeKey('test', { ...opts, runtime: 'minimal' });
    expect(a).not.toBe(b);
  });

  it('usa valores por defecto cuando opts está vacío', () => {
    const key = computeKey('test', {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('incluye sourceCode en el cálculo', () => {
    const a = computeKey('src1', opts);
    const b = computeKey('src2', opts);
    expect(a).not.toBe(b);
  });

  it('usa sourceHash en vez de sourceCode raw — key difiere del formato old-style', () => {
    const src = 'function test() { return 42; }';
    // Compute what the OLD-style key would be (sourceCode embedded as raw text, same aliases handling)
    const oldCanonical = JSON.stringify({
      sourceCode: src,
      isDev: opts.isDev ?? true,
      sourceMap: opts.sourceMap ?? true,
      optimizeLevel: opts.optimizeLevel ?? 3,
      shrinkLevel: opts.shrinkLevel ?? 0,
      runtime: opts.runtime ?? 'incremental',
      aliases: '',
    });
    const oldKey = crypto.createHash('sha256').update(oldCanonical).digest('hex');
    const newKey = computeKey(src, opts);
    // With old implementation, newKey === oldKey (same canonical JSON).
    // With new implementation, sourceCode is replaced by sourceHash → keys differ.
    expect(newKey).not.toBe(oldKey);
    // The new key is still deterministic
    expect(computeKey(src, opts)).toBe(newKey);
  });

  it('source tamaño grande no afecta formato de key', () => {
    const longSource = 'x'.repeat(100000);
    const key = computeKey(longSource, opts);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('incluye aliases en el cálculo correctamente', () => {
    const src = 'test';
    const withAlias = computeKey(src, { ...opts, aliases: [{ find: 'old-pkg', replacement: 'new-pkg' }] });
    const withoutAlias = computeKey(src, opts);
    expect(withAlias).not.toBe(withoutAlias);
    // Determinismo con aliases
    const again = computeKey(src, { ...opts, aliases: [{ find: 'old-pkg', replacement: 'new-pkg' }] });
    expect(withAlias).toBe(again);
  });
});
