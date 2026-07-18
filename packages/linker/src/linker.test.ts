import { describe, it, expect } from 'vitest';
import type { WasmModuleInfo } from '@wasm-apps/types';
import { resolveDependencies } from './linker.js';

function makeModule(name: string, exports: string[], imports: Array<{ module: string; name: string }> = [], extra?: Partial<WasmModuleInfo>): WasmModuleInfo {
  return {
    fileName: name + '.wasm',
    buffer: Buffer.from([]),
    exports: exports.map((e) => ({ name: e, kind: 'function' as const })),
    imports: imports.map((i) => ({ module: i.module, name: i.name, kind: 'function' as const })),
    ...extra,
  };
}

describe('resolveDependencies', () => {
  it('ordena módulos sin dependencias', () => {
    const a = makeModule('a', ['foo']);
    const b = makeModule('b', ['bar']);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order).toHaveLength(2);
  });

  it('ordena topológicamente módulos dependientes', () => {
    const a = makeModule('a', ['helper'], []);
    const b = makeModule('b', ['main'], [{ module: 'a', name: 'helper' }]);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order[0].module.fileName).toBe(a.fileName);
    expect(result.order[1].module.fileName).toBe(b.fileName);
  });

  it('maneja orden inverso de entrada', () => {
    const a = makeModule('a', ['helper'], []);
    const b = makeModule('b', ['main'], [{ module: 'a', name: 'helper' }]);
    const result = resolveDependencies([b, a], 'file-name');
    expect(result.order[0].module.fileName).toBe(a.fileName);
    expect(result.order[1].module.fileName).toBe(b.fileName);
  });

  it('ignora imports WASI', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'wasi_snapshot_preview1', name: 'fd_write' }]);
    const result = resolveDependencies([mod], 'file-name');
    expect(result.order).toHaveLength(1);
  });

  it('ignora imports wasi_unstable', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'wasi_unstable', name: 'fd_write' }]);
    const result = resolveDependencies([mod], 'file-name');
    expect(result.order).toHaveLength(1);
  });

  it('ignora imports de funciones host del registro', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'env', name: 'abort' }]);
    const result = resolveDependencies([mod], 'file-name');
    expect(result.order).toHaveLength(1);
  });

  it('detecta dependencias circulares', () => {
    const a = makeModule('a', ['foo'], [{ module: 'b', name: 'bar' }]);
    const b = makeModule('b', ['bar'], [{ module: 'a', name: 'foo' }]);
    expect(() => resolveDependencies([a, b], 'file-name')).toThrow('Dependency cycle');
  });

  it('ignora imports no resueltos (sin error)', () => {
    const a = makeModule('a', ['foo'], []);
    const b = makeModule('b', ['bar'], [{ module: 'nonexistent', name: 'missing' }]);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order).toHaveLength(2);
  });

  it('maneja dependencias multi-nivel', () => {
    const a = makeModule('a', ['level1'], []);
    const b = makeModule('b', ['level2'], [{ module: 'a', name: 'level1' }]);
    const c = makeModule('c', ['level3'], [{ module: 'b', name: 'level2' }]);
    const result = resolveDependencies([c, b, a], 'file-name');
    expect(result.order[0].module.fileName).toBe(a.fileName);
    expect(result.order[1].module.fileName).toBe(b.fileName);
    expect(result.order[2].module.fileName).toBe(c.fileName);
  });

  it('usa file-name strategy para desambiguación', () => {
    const a = makeModule('moduleA', ['sameName'], []);
    const b = makeModule('moduleB', ['sameName'], []);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order).toHaveLength(2);
  });

  it('construye exportMap correctamente', () => {
    const a = makeModule('a', ['helper']);
    const result = resolveDependencies([a], 'file-name');
    expect(result.exportMap.has('a.helper')).toBe(true);
    expect(result.exportMap.get('a.helper')!.instance).toBe('a');
  });

  it('asigna índices secuenciales', () => {
    const a = makeModule('a', ['x']);
    const b = makeModule('b', ['y']);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order[0].index).toBe(0);
    expect(result.order[1].index).toBe(1);
  });

  it('lanza error si no hay módulos', () => {
    expect(() => resolveDependencies([], 'file-name')).toThrow('No modules');
  });
});
