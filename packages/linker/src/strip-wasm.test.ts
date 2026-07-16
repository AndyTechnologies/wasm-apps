import { describe, it, expect } from 'vitest';
import { stripWasm } from './strip-wasm.js';

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

function buildSection(sectionId: number, content: number[]): number[] {
  const sizeBytes = encodeLEB128(content.length);
  return [sectionId, ...sizeBytes, ...content];
}

function buildCustomSection(name: string, extra: number[] = []): number[] {
  const nameBytes = [...new TextEncoder().encode(name)];
  const nameLen = encodeLEB128(nameBytes.length);
  const content = [...nameLen, ...nameBytes, ...extra];
  return buildSection(0, content);
}

function buildMinimalWasm(sections: number[][]): Buffer {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const all = [...header, ...sections.flat()];
  return Buffer.from(all);
}

describe('stripWasm', () => {
  it('removes name custom section', () => {
    const codeSection = buildSection(10, [0x00, 0x01, 0x02]);
    const nameSection = buildCustomSection('name');
    const wasm = buildMinimalWasm([nameSection, codeSection]);
    const result = stripWasm(wasm);
    expect(result.length).toBeLessThan(wasm.length);
  });

  it('removes producers custom section', () => {
    const codeSection = buildSection(10, [0x00, 0x01, 0x02]);
    const producersSection = buildCustomSection('producers');
    const wasm = buildMinimalWasm([producersSection, codeSection]);
    const result = stripWasm(wasm);
    expect(result.length).toBeLessThan(wasm.length);
  });

  it('preserves non-custom sections', () => {
    const nameSection = buildCustomSection('name', [0x01, 0x02]);
    const typeSection = buildSection(1, [0x01, 0x02]);
    const codeSection = buildSection(10, [0x00, 0x01, 0x02]);
    const wasm = buildMinimalWasm([typeSection, nameSection, codeSection]);
    const result = stripWasm(wasm);
    expect(result).not.toEqual(wasm);
    expect(result.length).toBeLessThan(wasm.length);
  });

  it('returns same bytes if no stripable sections', () => {
    const typeSection = buildSection(1, [0x01]);
    const codeSection = buildSection(10, [0x00, 0x03]);
    const wasm = buildMinimalWasm([typeSection, codeSection]);
    const expected = Buffer.from(wasm);
    const result = stripWasm(wasm);
    expect([...result]).toEqual([...expected]);
  });

  it('handles wasm without custom sections', () => {
    const codeSection = buildSection(10, [0x00, 0x01]);
    const wasm = buildMinimalWasm([codeSection]);
    const result = stripWasm(wasm);
    expect(result).toEqual(wasm);
  });

  it('strips sourceMappingURL section', () => {
    const codeSection = buildSection(10, [0x00, 0x01]);
    const smSection = buildCustomSection('sourceMappingURL');
    const wasm = buildMinimalWasm([smSection, codeSection]);
    const result = stripWasm(wasm);
    expect(result.length).toBeLessThan(wasm.length);
  });
});
