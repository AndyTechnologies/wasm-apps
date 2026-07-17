import { describe, it, expect } from 'vitest';
import { treeShakeWasm } from './tree-shake.js';

function encodeU32(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}

function buildWasm(sections: Array<{ id: number; content: number[] }>): Uint8Array {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const all: number[] = [...header];
  for (const sec of sections) {
    const sizeBytes = encodeU32(sec.content.length);
    all.push(sec.id, ...sizeBytes, ...sec.content);
  }
  return new Uint8Array(all);
}

function typeSection(types: number[][]): { id: number; content: number[] } {
  const content: number[] = [];
  content.push(...encodeU32(types.length));
  for (const t of types) {
    content.push(0x60);
    content.push(...encodeU32(t[0]));
    content.push(...encodeU32(t[1]));
  }
  return { id: 1, content };
}

function funcSection(typeIndices: number[]): { id: number; content: number[] } {
  const content: number[] = [];
  content.push(...encodeU32(typeIndices.length));
  for (const idx of typeIndices) {
    content.push(...encodeU32(idx));
  }
  return { id: 3, content };
}

function exportSection(exports: Array<{ name: string; kind: number; index: number }>): { id: number; content: number[] } {
  const content: number[] = [];
  content.push(...encodeU32(exports.length));
  for (const exp of exports) {
    const nameBytes = [...new TextEncoder().encode(exp.name)];
    content.push(...encodeU32(nameBytes.length), ...nameBytes);
    content.push(exp.kind);
    content.push(...encodeU32(exp.index));
  }
  return { id: 7, content };
}

function codeSection(bodies: number[][]): { id: number; content: number[] } {
  const content: number[] = [];
  content.push(...encodeU32(bodies.length));
  for (const body of bodies) {
    const bodySize = body.length;
    content.push(...encodeU32(bodySize), ...body);
  }
  return { id: 10, content };
}

function simpleBody(calls: number[]): number[] {
  const body: number[] = [0x00];
  for (const callee of calls) {
    body.push(0x10);
    body.push(...encodeU32(callee));
  }
  body.push(0x0b);
  return body;
}

function bodyWithBlock(calls: number[]): number[] {
  const body: number[] = [0x00];
  body.push(0x02, 0x40); // block (empty result type)
  for (const callee of calls) {
    body.push(0x10);
    body.push(...encodeU32(callee));
  }
  body.push(0x0b);
  body.push(0x0b);
  return body;
}

function largeBody(): number[] {
  const body: number[] = [0x01, 0x01, 0x7f]; // 1 local i32
  body.push(0x41, 0x2a); // i32.const 42
  body.push(0x1a);       // drop
  body.push(0x0b);
  return body;
}

const sharedTypes = typeSection([[0, 0]]);

describe('treeShakeWasm', () => {
  it('returns original wasm when no functions can be removed', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result).toBe(wasm);
  });

  it('replaces unreachable function bodies with minimal stubs', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([]), largeBody()]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result.length).toBeLessThan(wasm.length);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('keeps functions called from exports', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([1]), largeBody()]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result).toBe(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('keeps functions called transitively', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([1]), simpleBody([2]), largeBody()]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result).toBe(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('replaces only unreachable bodies in complex graph', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0, 0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([1]), largeBody(), largeBody(), largeBody()]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result.length).toBeLessThan(wasm.length);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('handles wasm without export section', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0]),
      codeSection([simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result).toBe(wasm);
  });

  it('handles empty wasm', () => {
    const result = treeShakeWasm(new Uint8Array([]));
    expect(result).toEqual(new Uint8Array([]));
  });

  it('produces valid WebAssembly module when removing unreachable funcs', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([]), simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('preserves valid wasm for fully reachable graph', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([1]), simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('handles block/if/loop structures without corrupting bytecode', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([bodyWithBlock([]), simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('handles start section correctly', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      { id: 8, content: [0x02] },
      codeSection([simpleBody([]), simpleBody([]), simpleBody([0])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(() => new WebAssembly.Module(result)).not.toThrow();
  });

  it('preserves all export indices', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0, 0]),
      exportSection([
        { name: 'main', kind: 0, index: 0 },
        { name: 'other', kind: 0, index: 2 },
      ]),
      codeSection([simpleBody([]), largeBody(), simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    const mod = new WebAssembly.Module(result);
    const exports = WebAssembly.Module.exports(mod);
    expect(exports).toHaveLength(2);
    expect(exports[0].name).toBe('main');
    expect(exports[1].name).toBe('other');
  });
});
