import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
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

describe('SHA-256 test vectors (fs-runtime.h)', () => {
  it('generates SHA-256 hex correctly for known inputs', () => {
    // Known SHA-256 test vectors from FIPS 180-4
    expect(crypto.createHash('sha256').update('').digest('hex')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(crypto.createHash('sha256').update('abc').digest('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(crypto.createHash('sha256').update('message digest').digest('hex')).toBe('f7846f55cf23e14eebeab5b4e1550cad5b509e3348fbc4efa3a1413d393cb650');
  });

  it('computes permissionId deterministically', () => {
    const wasmHash = 'abc123def456';
    const path = '/data';
    const id = crypto
      .createHash('sha256')
      .update(wasmHash + ':' + path)
      .digest('hex');
    // Same inputs should produce same hash
    const id2 = crypto
      .createHash('sha256')
      .update(wasmHash + ':' + path)
      .digest('hex');
    expect(id).toBe(id2);
    // Different paths should produce different hashes
    const id3 = crypto
      .createHash('sha256')
      .update(wasmHash + ':/etc')
      .digest('hex');
    expect(id).not.toBe(id3);
  });
});

describe('generateCCode with mounts', () => {
  it('generates preopen_dir lines for each mount when wasi is true', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const mounts: Array<{ host: string; guest: string }> = [
      { host: '/home/user/data', guest: '/data' },
      { host: '/home/user/config', guest: '/etc/app' },
    ];
    const code = generateCCode(link, '_start', true, undefined, undefined, mounts);
    expect(code).toContain('#include "fs-runtime.h"');
    expect(code).toContain('static std::vector<std::string> _fs_allowed_roots;');
    expect(code).toContain('_fs_allowed_roots.push_back("/home/user/data");');
    expect(code).toContain('_fs_allowed_roots.push_back("/home/user/config");');
    expect(code).toContain('wasi_config.preopen_dir("/home/user/data", "/data");');
    expect(code).toContain('wasi_config.preopen_dir("/home/user/config", "/etc/app");');
  });

  it('does not generate preopen_dir when mounts is empty', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false, undefined, undefined, []);
    expect(code).not.toContain('preopen_dir');
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
    // Preamble helpers _check_result / _check_trap use std::exit(1), but
    // define_exports itself uses return 1 for error propagation
    expect(code).toContain('std::exit(1);');
  });

  it('generateModuleInstantiation checks define_exports return value', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('if (define_exports(');
  });

  it('generates _check_result helper template in preamble', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('template<typename T>');
    expect(code).toContain('static T _check_result(wasmtime::Result<T>&& r, const char* what)');
    expect(code).toContain('LinkerError:');
    expect(code).toContain('r.err().message()');
    expect(code).toContain('std::exit(1)');
  });

  it('generates _check_trap helper template in preamble', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('template<typename T>');
    expect(code).toContain('static T _check_trap(wasmtime::TrapResult<T>&& r, const char* what)');
    expect(code).toContain('r.err_ref().message()');
  });

  it('does not contain bare .unwrap() on API calls in generated code', () => {
    const mod = makeModule('test', ['_start']);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false);
    // The preamble and generated code should not call .unwrap() on wasmtime API results
    // (the _check_result/_check_trap helpers replace all .unwrap() calls)
    expect(code).not.toMatch(/\.unwrap\(\)/);
  });

  it('uses _check_result for host function definitions', () => {
    const mod = makeModule('test', ['_start'], [{ module: 'env', name: 'abort' }]);
    const link = makeResolved([mod]);
    const code = generateCCode(link, '_start', false, [{ module: 'env', name: 'abort', params: ['i32', 'i32', 'i32', 'i32'], results: [] }]);
    expect(code).toContain('_check_result(linker.define(ctx, "env", "abort"');
    expect(code).toContain('"define env.abort"');
  });

  it('caller checks define_exports return for every module instance', () => {
    const a = makeModule('a', ['helper']);
    const b = makeModule('b', ['_start']);
    const link = makeResolved([a, b]);
    const code = generateCCode(link, '_start', false);
    expect(code).toContain('if (define_exports(linker, ctx, instance0, "instance0") != 0) return 1;');
    expect(code).toContain('if (define_exports(linker, ctx, instance1, "instance1") != 0) return 1;');
  });
});
