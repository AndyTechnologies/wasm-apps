import { describe, it, expect } from 'vitest';
import { mergeImportExportKinds, parseWasmBuffer } from './wasm-io.js';
import { LinkerError } from '@wasm-apps/types';
import type { WasmModuleInfo, WasmImport, WasmExport } from '@wasm-apps/types';

/** Helper: build a WASM binary with the given sections after a valid header. */
function buildWasm(...sections: number[][]): Buffer {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const bytes = header.concat(...sections);
  return Buffer.from(bytes);
}

/** Helper: type section with 1 functype (params, results) → () */
function typeSectionOne(): number[] {
  return [0x01, 0x04, 0x01, 0x60, 0x00, 0x00];
}

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

describe('parseWasmBuffer OOB safety', () => {
  const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  it('throws LinkerError when import count byte is beyond buffer', () => {
    // Type section + import section with size=0 (empty content)
    // → count read at offset would read past buffer
    const buffer = buildWasm(
      typeSectionOne(),
      [0x02, 0x00], // import section ID + size=0
    );
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when export count byte is beyond buffer', () => {
    // Type section + export section with size=0 (empty content)
    // → count read at offset would read past buffer
    const buffer = buildWasm(
      typeSectionOne(),
      [0x07, 0x00], // export section ID + size=0
    );
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when import kind=1 reserved byte is truncated', () => {
    // Import with kind=1 (table) but missing the reserved byte after kind
    // type section + import section truncated right after kind byte
    const bytes: number[] = [
      ...WASM_HEADER,
      0x01,
      0x04,
      0x01,
      0x60,
      0x00,
      0x00, // type: ()→()
      0x02,
      0x0a,
      0x01, // import: count=1
      0x03,
      0x65,
      0x6e,
      0x76, // module="env"
      0x03,
      0x6c,
      0x6f,
      0x67, // name="log"
      0x01, // kind=1 (table)
      // missing: reserved byte after kind
    ];
    const buffer = Buffer.from(bytes);
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when import kind=3 reserved bytes are truncated', () => {
    // Import with kind=3 (global) but missing the 2 reserved bytes after kind
    const bytes: number[] = [
      ...WASM_HEADER,
      0x01,
      0x04,
      0x01,
      0x60,
      0x00,
      0x00, // type: ()→()
      0x02,
      0x0b,
      0x01, // import: count=1
      0x03,
      0x65,
      0x6e,
      0x76, // module="env"
      0x03,
      0x6c,
      0x6f,
      0x67, // name="log"
      0x03, // kind=3 (global)
      0x01, // value type byte present
      // missing: mutability byte
    ];
    const buffer = Buffer.from(bytes);
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when type section param count is truncated', () => {
    // Type section with functype byte but param count byte missing
    const bytes: number[] = [
      ...WASM_HEADER,
      0x01,
      0x02, // type section: size=2
      0x01, // count=1
      0x60, // functype — buffer ends, no paramCount
    ];
    const buffer = Buffer.from(bytes);
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when type section result count is truncated', () => {
    // Type section with params declared but result count byte missing
    const bytes: number[] = [
      ...WASM_HEADER,
      0x01,
      0x04, // type section: size=4
      0x01, // count=1
      0x60, // functype
      0x01, // paramCount=1
      0x7f, // param type=i32 — buffer ends, no resultCount
    ];
    const buffer = Buffer.from(bytes);
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });
});

describe('parseWasmBuffer', () => {
  const WASM_HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  it('parses minimal valid WASM with no sections', () => {
    const buffer = Buffer.from(WASM_HEADER);
    const result = parseWasmBuffer(buffer, 'empty.wasm');
    expect(result.fileName).toBe('empty.wasm');
    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
    expect(result.importFuncTypes).toBeUndefined();
  });

  it('throws LinkerError when section size exceeds buffer', () => {
    // Header + type section id=1 with size=100 but only 2 more bytes exist
    const buffer = Buffer.from([...WASM_HEADER, 0x01, 0x64]);
    expect(() => parseWasmBuffer(buffer, 'bad.wasm')).toThrow(LinkerError);
  });

  it('throws LinkerError when typeIdx exceeds type signatures', () => {
    // Header + type section (1 entry of 0 params/0 results) + import section
    // referencing typeIdx=5 (OOB — only 1 type entry exists)
    const bytes = [
      ...WASM_HEADER,
      0x01,
      0x04,
      0x01,
      0x60,
      0x00,
      0x00, // type section: size=4, 1 functype (→,)
      0x02,
      0x0b,
      0x01,
      0x03,
      0x65,
      0x6e,
      0x76, // import section: count=1, module="env"
      0x03,
      0x6c,
      0x6f,
      0x67,
      0x00,
      0x05, // name="log", kind=func, typeIdx=5 (OOB!)
    ];
    const buffer = Buffer.from(bytes);
    expect(() => parseWasmBuffer(buffer, 'oob.wasm')).toThrow(LinkerError);
  });

  it('parses valid type+import sections with correct typeIdx', () => {
    const bytes = [
      ...WASM_HEADER,
      0x01,
      0x04,
      0x01,
      0x60,
      0x00,
      0x00, // type section: size=4, 1 functype (→,)
      0x02,
      0x0b,
      0x01,
      0x03,
      0x65,
      0x6e,
      0x76, // import section: count=1, module="env"
      0x03,
      0x6c,
      0x6f,
      0x67,
      0x00,
      0x00, // name="log", kind=func, typeIdx=0 (valid!)
    ];
    const buffer = Buffer.from(bytes);
    const result = parseWasmBuffer(buffer, 'valid.wasm');
    expect(result.importFuncTypes).toBeDefined();
    expect(result.importFuncTypes).toHaveLength(1);
    expect(result.importFuncTypes![0]).toEqual({
      module: 'env',
      name: 'log',
      params: [],
      results: [],
    });
  });
});
