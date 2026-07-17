import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { WasmModuleInfo } from '@wasm-apps/types';
import { resolveDependencies } from './linker.js';

function makeModule(name: string, exports: string[], imports: Array<{ module: string; name: string }> = [], extra?: Partial<WasmModuleInfo>): WasmModuleInfo {
  return {
    fileName: `/path/to/${name}.wasm`,
    buffer: Buffer.from([]),
    exports: exports.map(e => ({ name: e, kind: 'function' as const })),
    imports: imports.map(i => ({ module: i.module, name: i.name, kind: 'function' as const })),
    ...extra,
  };
}

describe('resolveDependencies', () => {
  it('sorts modules with no dependencies', () => {
    const a = makeModule('a', ['foo']);
    const b = makeModule('b', ['bar']);
    const result = resolveDependencies([a, b], 'name-only');
    expect(result.order).toHaveLength(2);
  });

  it('topologically sorts dependent modules', () => {
    const a = makeModule('a', ['helper'], []);
    const b = makeModule('b', ['main'], [{ module: 'a', name: 'helper' }]);
    const result = resolveDependencies([a, b], 'name-only');
    expect(result.order[0].module.fileName).toBe(a.fileName);
    expect(result.order[1].module.fileName).toBe(b.fileName);
  });

  it('handles reverse input order', () => {
    const a = makeModule('a', ['helper'], []);
    const b = makeModule('b', ['main'], [{ module: 'a', name: 'helper' }]);
    const result = resolveDependencies([b, a], 'file-name');
    expect(result.order[0].module.fileName).toBe(a.fileName);
    expect(result.order[1].module.fileName).toBe(b.fileName);
  });

  it('skips WASI imports', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'wasi_snapshot_preview1', name: 'fd_write' }]);
    const result = resolveDependencies([mod], 'name-only');
    expect(result.order).toHaveLength(1);
  });

  it('skips wasi_unstable imports', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'wasi_unstable', name: 'fd_write' }]);
    const result = resolveDependencies([mod], 'name-only');
    expect(result.order).toHaveLength(1);
  });

  it('skips host function imports from registry', () => {
    const mod = makeModule('m', ['_start'], [{ module: 'env', name: 'abort' }]);
    const result = resolveDependencies([mod], 'name-only');
    expect(result.order).toHaveLength(1);
  });

  it('throws on circular dependencies', () => {
    const a = makeModule('a', ['foo'], [{ module: 'b', name: 'bar' }]);
    const b = makeModule('b', ['bar'], [{ module: 'a', name: 'foo' }]);
    expect(() => resolveDependencies([a, b], 'name-only')).toThrow('circular');
  });

  it('throws on unresolved imports', () => {
    const a = makeModule('a', ['foo'], []);
    const b = makeModule('b', ['bar'], [{ module: 'nonexistent', name: 'missing' }]);
    expect(() => resolveDependencies([a, b], 'name-only')).toThrow('no resuelta');
  });

  it('throws on duplicate exports with name-only strategy', () => {
    const a = makeModule('a', ['duplicate']);
    const b = makeModule('b', ['duplicate']);
    expect(() => resolveDependencies([a, b], 'name-only')).toThrow('Conflicto');
  });

  it('handles multi-level dependencies', () => {
    const a = makeModule('a', ['level1'], []);
    const b = makeModule('b', ['level2'], [{ module: 'a', name: 'level1' }]);
    const c = makeModule('c', ['level3'], [{ module: 'b', name: 'level2' }]);
    const result = resolveDependencies([c, b, a], 'name-only');
    expect(result.order[0].module).toBe(a);
    expect(result.order[1].module).toBe(b);
    expect(result.order[2].module).toBe(c);
  });

  it('uses file-name strategy for disambiguation', () => {
    const a = makeModule('moduleA', ['sameName'], []);
    const b = makeModule('moduleB', ['sameName'], []);
    const result = resolveDependencies([a, b], 'file-name');
    expect(result.order).toHaveLength(2);
  });

  it('builds exportMap correctly', () => {
    const a = makeModule('a', ['helper']);
    const result = resolveDependencies([a], 'name-only');
    expect(result.exportMap.has('helper')).toBe(true);
    expect(result.exportMap.get('helper')!.instance).toBe('instance0');
  });

  it('assigns sequential indices', () => {
    const a = makeModule('a', ['x']);
    const b = makeModule('b', ['y']);
    const result = resolveDependencies([a, b], 'name-only');
    expect(result.order[0].index).toBe(0);
    expect(result.order[0].instanceName).toBe('instance0');
    expect(result.order[1].index).toBe(1);
    expect(result.order[1].instanceName).toBe('instance1');
  });
});
