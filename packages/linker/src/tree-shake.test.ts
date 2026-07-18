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

function largeBody(): number[] {
  const body: number[] = [0x01, 0x01, 0x7f];
  body.push(0x41, 0x2a);
  body.push(0x1a);
  body.push(0x0b);
  return body;
}

const sharedTypes = typeSection([[0, 0]]);

function isWasmValid(wasm: Uint8Array | Buffer): boolean {
  try {
    new WebAssembly.Module(wasm);
    return true;
  } catch {
    return false;
  }
}

describe('treeShakeWasm', () => {
  it('retorna buffer cuando no hay secciones de código', () => {
    const wasm = buildWasm([sharedTypes, funcSection([0]), exportSection([{ name: 'main', kind: 0, index: 0 }]), codeSection([simpleBody([])])]);
    const result = treeShakeWasm(wasm);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('maneja wasm sin sección de export', () => {
    const wasm = buildWasm([sharedTypes, funcSection([0]), codeSection([simpleBody([])])]);
    const result = treeShakeWasm(wasm);
    expect(Buffer.from(result)).toEqual(Buffer.from(wasm));
  });

  it('maneja wasm vacío', () => {
    const result = treeShakeWasm(new Uint8Array([]));
    expect(Buffer.from(result)).toEqual(Buffer.from(new Uint8Array([])));
  });

  it('procesa wasm con múltiples secciones', () => {
    const wasm = buildWasm([
      sharedTypes,
      funcSection([0, 0]),
      exportSection([{ name: 'main', kind: 0, index: 0 }]),
      codeSection([simpleBody([1]), simpleBody([])]),
    ]);
    const result = treeShakeWasm(wasm);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserva header WASM', () => {
    const wasm = buildWasm([sharedTypes, funcSection([0]), codeSection([simpleBody([])])]);
    const result = treeShakeWasm(wasm);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0x61);
    expect(result[2]).toBe(0x73);
    expect(result[3]).toBe(0x6d);
  });
});
