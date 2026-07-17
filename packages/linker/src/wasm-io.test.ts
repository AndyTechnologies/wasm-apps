import { describe, it, expect } from 'vitest';
import { parseImportFuncTypes } from './wasm-io.js';

function encodeLEB128(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function buildWasmWithTypes(sections: number[][]): Buffer {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const all = [...header, ...sections.flat()];
  return Buffer.from(all);
}

function typeSection(funcTypes: Array<{ params: number[]; results: number[] }>): number[] {
  const content: number[] = [];
  content.push(...encodeLEB128(funcTypes.length));
  for (const ft of funcTypes) {
    content.push(0x60); // functype
    content.push(...encodeLEB128(ft.params.length));
    content.push(...ft.params);
    content.push(...encodeLEB128(ft.results.length));
    content.push(...ft.results);
  }
  const sizeBytes = encodeLEB128(content.length);
  return [1, ...sizeBytes, ...content]; // section 1 = Type
}

function importSection(imports: Array<{ module: string; name: string; kind: number; typeIdx: number }>): number[] {
  const content: number[] = [];
  content.push(...encodeLEB128(imports.length));
  for (const imp of imports) {
    const modBytes = [...new TextEncoder().encode(imp.module)];
    content.push(...encodeLEB128(modBytes.length), ...modBytes);
    const nameBytes = [...new TextEncoder().encode(imp.name)];
    content.push(...encodeLEB128(nameBytes.length), ...nameBytes);
    content.push(imp.kind);
    if (imp.kind === 0) {
      content.push(...encodeLEB128(imp.typeIdx));
    } else {
      content.push(...encodeLEB128(0), ...encodeLEB128(0));
    }
  }
  const sizeBytes = encodeLEB128(content.length);
  return [2, ...sizeBytes, ...content]; // section 2 = Import
}

describe('parseImportFuncTypes', () => {
  it('parses a simple function import', () => {
    const types = typeSection([{ params: [0x7f], results: [0x7f] }]); // i32 -> i32
    const imports = importSection([{ module: 'env', name: 'add', kind: 0, typeIdx: 0 }]);
    const wasm = buildWasmWithTypes([types, imports]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ module: 'env', name: 'add', params: ['i32'], results: ['i32'] });
  });

  it('parses import with no params and no results', () => {
    const types = typeSection([{ params: [], results: [] }]);
    const imports = importSection([{ module: 'env', name: 'noop', kind: 0, typeIdx: 0 }]);
    const wasm = buildWasmWithTypes([types, imports]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ module: 'env', name: 'noop', params: [], results: [] });
  });

  it('parses multiple imports', () => {
    const types = typeSection([
      { params: [0x7f, 0x7e], results: [0x7d] },
      { params: [], results: [] },
    ]);
    const imports = importSection([
      { module: 'env', name: 'add', kind: 0, typeIdx: 0 },
      { module: 'wasi_snapshot_preview1', name: 'fd_write', kind: 0, typeIdx: 1 },
    ]);
    const wasm = buildWasmWithTypes([types, imports]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toHaveLength(2);
    expect(result[0].module).toBe('env');
    expect(result[0].name).toBe('add');
    expect(result[0].params).toEqual(['i32', 'i64']);
    expect(result[0].results).toEqual(['f32']);
    expect(result[1].module).toBe('wasi_snapshot_preview1');
  });

  it('parses f64 and i64 valtypes', () => {
    const types = typeSection([{ params: [0x7c], results: [0x7e] }]); // f64 -> i64
    const imports = importSection([{ module: 'env', name: 'convert', kind: 0, typeIdx: 0 }]);
    const wasm = buildWasmWithTypes([types, imports]);
    const result = parseImportFuncTypes(wasm);
    expect(result[0].params).toEqual(['f64']);
    expect(result[0].results).toEqual(['i64']);
  });

  it('returns empty array for wasm without import section', () => {
    const types = typeSection([{ params: [], results: [] }]);
    const wasm = buildWasmWithTypes([types]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toEqual([]);
  });

  it('handles global imports correctly (non-function)', () => {
    const types = typeSection([{ params: [], results: [] }]);
    const imports = importSection([{ module: 'env', name: 'global_val', kind: 3, typeIdx: 0 }]);
    const wasm = buildWasmWithTypes([types, imports]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for minimal valid wasm', () => {
    const wasm = buildWasmWithTypes([]);
    const result = parseImportFuncTypes(wasm);
    expect(result).toEqual([]);
  });
});
