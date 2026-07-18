import { describe, it, expect } from 'vitest';
import { mergeImportExportKinds } from './wasm-io.js';
import type { WasmModuleInfo, WasmImport, WasmExport } from '@wasm-apps/types';

describe('mergeImportExportKinds', () => {
  it('retorna imports sin cambios si no hay unknown', () => {
    const imports: WasmImport[] = [{ module: 'env', name: 'log', kind: 'function' }];
    const exports: WasmExport[] = [];
    const moduleMap = new Map<string, WasmModuleInfo>();
    const result = mergeImportExportKinds(imports, exports, moduleMap);
    expect(result).toEqual(imports);
  });

  it('resuelve kind unknown usando exports de otros módulos', () => {
    const imports: WasmImport[] = [{ module: 'math', name: 'add', kind: 'unknown' as WasmImport['kind'] }];
    const exports: WasmExport[] = [];
    const otherModule: WasmModuleInfo = {
      fileName: 'math.wasm',
      buffer: Buffer.from([]),
      imports: [],
      exports: [{ name: 'add', kind: 'function' }],
    };
    const moduleMap = new Map<string, WasmModuleInfo>([['math.wasm', otherModule]]);
    const result = mergeImportExportKinds(imports, exports, moduleMap);
    expect(result[0].kind).toBe('function');
  });

  it('retorna import sin cambios si no encuentra matching export', () => {
    const imports: WasmImport[] = [{ module: 'env', name: 'unknown_func', kind: 'unknown' as WasmImport['kind'] }];
    const exports: WasmExport[] = [];
    const moduleMap = new Map<string, WasmModuleInfo>();
    const result = mergeImportExportKinds(imports, exports, moduleMap);
    expect(result[0].kind).toBe('unknown');
  });
});
