import { describe, it, expect } from 'vitest';
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
});
