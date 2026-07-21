import { describe, it, expect } from 'vitest';
import path from 'node:path';
import type { ResolvedLink, ResolvedModule, WasmModuleInfo } from '@wasm-apps/types';
import { generateCCode, findEntryModule, validateEntryExport } from './codegen.js';

function makeModule(name: string, exportsList: string[], importsList: Array<{ module: string; name: string; kind?: string }> = []): WasmModuleInfo {
  return {
    fileName: `/path/to/${name}.wasm`,
    buffer: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
    exports: exportsList.map((e) => ({ name: e, kind: 'function' as const })),
    imports: importsList.map((i) => ({ module: i.module, name: i.name, kind: (i.kind || 'function') as any })),
  };
}

function makeResolved(modules: WasmModuleInfo[]): ResolvedLink {
  return {
    order: modules.map((mod, idx) => ({ module: mod, index: idx, instanceName: `instance${idx}` })),
    exportMap: new Map(),
  };
}

describe('findEntryModule', () => {
  it('finds module containing entry point', () => {
    const a = makeModule('a', ['_start']);
    const link = makeResolved([a]);
    expect(findEntryModule(link, '_start')).toBe('instance0');
  });

  it('finds entry in later module', () => {
    const a = makeModule('a', ['helper']);
    const b = makeModule('b', ['_start']);
    const link = makeResolved([a, b]);
    expect(findEntryModule(link, '_start')).toBe('instance1');
  });

  it('throws if entry not found', () => {
    const a = makeModule('a', ['foo']);
    const link = makeResolved([a]);
    expect(() => findEntryModule(link, '_start')).toThrow('No se encontro');
  });
});

describe('validateEntryExport', () => {
  it('passes when entry exists', () => {
    const a = makeModule('a', ['_start']);
    const link = makeResolved([a]);
    expect(() => validateEntryExport(link, '_start')).not.toThrow();
  });

  it('throws when entry does not exist', () => {
    const a = makeModule('a', ['foo']);
    const link = makeResolved([a]);
    expect(() => validateEntryExport(link, '_start')).toThrow('No se encontro');
  });
});

describe('generateCCode', () => {
  it('generates valid C++ with minimal module', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('#include <wasmtime.hh>');
    expect(code).toContain('wasm_bytes_0');
    expect(code).toContain('mod0');
    expect(code).toContain('instance0');
    expect(code).toContain('entry_func.call(ctx, {})');
    expect(code).toContain('return 0;');
  });

  it('includes WASI config when wasi is true', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', true);
    expect(code).toContain('WasiConfig');
    expect(code).toContain('define_wasi');
  });

  it('does not include WASI config when wasi is false', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).not.toContain('WasiConfig');
  });

  it('skips WASI imports in code generation', () => {
    const mod = makeModule('test', ['_start'], [{ module: 'wasi_snapshot_preview1', name: 'fd_write' }]);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('return 0;');
  });

  it('handles multiple modules', () => {
    const a = makeModule('a', ['helper']);
    const b = makeModule('b', ['_start'], [{ module: 'a', name: 'helper' }]);
    const link = makeResolved([a, b]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('wasm_bytes_0');
    expect(code).toContain('wasm_bytes_1');
    expect(code).toContain('mod0');
    expect(code).toContain('mod1');
  });

  it('generates host function definitions for env imports', () => {
    const mod = makeModule('test', ['_start'], [{ module: 'env', name: 'abort' }]);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false, [{ module: 'env', name: 'abort', params: ['i32', 'i32', 'i32', 'i32'], results: [] }]);
    expect(code).toContain('env');
    expect(code).toContain('abort');
  });

  it('sanitizes export identifiers', () => {
    const mod = makeModule('test', ['some-func']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, 'some-func', false);
    expect(code).toContain('some_func');
  });

  it('generates memory read helpers', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('_readAsString');
    expect(code).toContain('_readAsStringNT');
  });

  it('define_exports is static int not static void', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('static int define_exports(');
    expect(code).not.toContain('static void define_exports(');
  });

  it('define_exports uses return 1 instead of std::exit(1)', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('return 1;');
    expect(code).not.toContain('std::exit(1)');
  });

  it('generateModuleInstantiation checks define_exports return value', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('if (!define_exports(');
  });

  it('caller checks define_exports return for every module instance', () => {
    const a = makeModule('a', ['helper']);
    const b = makeModule('b', ['_start']);
    const link = makeResolved([a, b]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('if (!define_exports(linker, ctx, instance0.unwrap(), "instance0")) return 1;');
    expect(code).toContain('if (!define_exports(linker, ctx, instance1.unwrap(), "instance1")) return 1;');
  });
});
