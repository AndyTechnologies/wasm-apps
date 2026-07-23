import fs from 'node:fs';
import path from 'node:path';
import type { WasmModuleInfo, WasmExport, WasmImport, WasmImportFuncType } from '@wasm-apps/types';
import { LinkerError } from '@wasm-apps/types';
import { readLEB128, readLEB128Value, countLEB128 } from './wasm-leb128.js';

function assertBounds(buffer: Buffer, offset: number, needed: number, description: string): void {
  if (offset + needed > buffer.length) {
    throw new LinkerError(`WASM parse error at offset ${offset}: ${description} — need ${needed} byte(s), buffer length ${buffer.length}`);
  }
}

const KIND_NAMES: Record<number, WasmImport['kind']> = {
  0: 'function',
  1: 'table',
  2: 'memory',
  3: 'global',
};

function decodeKind(kind: number): WasmImport['kind'] {
  const name = KIND_NAMES[kind];
  if (name === undefined) {
    throw new LinkerError(`Invalid WASM import/export kind: ${kind} — expected 0 (function), 1 (table), 2 (memory), or 3 (global)`);
  }
  return name;
}

const VAL_TYPE_NAMES: Record<number, string> = {
  0x7f: 'i32',
  0x7e: 'i64',
  0x7d: 'f32',
  0x7c: 'f64',
};

function readValTypes(data: Buffer, offset: number, count: number): { types: string[]; offset: number } {
  const types: string[] = [];
  let pos = offset;
  assertBounds(data, pos, count, `readValTypes(count=${count})`);
  for (let i = 0; i < count; i++) {
    const typeByte = data[pos++];
    types.push(VAL_TYPE_NAMES[typeByte] || 'i32');
  }
  return { types, offset: pos };
}

export function parseWasmBuffer(buffer: Buffer, fileName: string): WasmModuleInfo {
  // Validate WASM header: magic bytes + version
  if (buffer.length < 8) {
    throw new LinkerError(`WASM file too short: ${buffer.length} byte(s), need at least 8 for header`);
  }
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x6d736100 /* \0asm */) {
    throw new LinkerError(`Invalid WASM magic bytes: 0x${magic.toString(16)} — expected \\0asm in ${fileName}`);
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 1) {
    throw new LinkerError(`Unsupported WASM version: ${version} — expected version 1 in ${fileName}`);
  }

  let offset = 8;
  const imports: WasmImport[] = [];
  const exports: WasmExport[] = [];
  const typeSignatures: Array<{ params: string[]; results: string[] }> = [];
  const importFuncTypes: WasmImportFuncType[] = [];

  while (offset < buffer.length) {
    assertBounds(buffer, offset, 1, 'section ID');
    const sectionId = buffer[offset++];
    assertBounds(buffer, offset, 1, 'section size LEB128 start');
    const { value: sectionSize, size: sizeLen } = readLEB128(buffer, offset);
    if (sectionSize > buffer.length - offset) {
      throw new LinkerError(`WASM section declares ${sectionSize} bytes but only ${buffer.length - offset} remain at offset ${offset}`);
    }
    offset += sizeLen;
    const sectionEnd = offset + sectionSize;

    if (sectionId === 1) {
      assertBounds(buffer, offset, 1, 'type section count');
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        assertBounds(buffer, offset, 1, `type section entry ${i} form byte`);
        if (buffer[offset++] !== 0x60) {
          throw new LinkerError(`Invalid functype form at offset ${offset - 1}: expected 0x60`);
        }
        assertBounds(buffer, offset, 1, `type section entry ${i} param count`);
        const paramCount = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const { types: params, offset: newOffset1 } = readValTypes(buffer, offset, paramCount);
        offset = newOffset1;
        assertBounds(buffer, offset, 1, `type section entry ${i} result count`);
        const resultCount = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const { types: results, offset: newOffset2 } = readValTypes(buffer, offset, resultCount);
        offset = newOffset2;
        typeSignatures.push({ params, results });
      }
    } else if (sectionId === 2) {
      assertBounds(buffer, offset, 1, 'import section count');
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        assertBounds(buffer, offset, 1, `import ${i} module length`);
        const moduleLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        if (offset + moduleLen > buffer.length) {
          throw new LinkerError(`Import ${i} module name extends past buffer at offset ${offset}`);
        }
        const module = buffer.toString('utf-8', offset, offset + moduleLen);
        offset += moduleLen;

        assertBounds(buffer, offset, 1, `import ${i} name length`);
        const nameLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        if (offset + nameLen > buffer.length) {
          throw new LinkerError(`Import ${i} name extends past buffer at offset ${offset}`);
        }
        const name = buffer.toString('utf-8', offset, offset + nameLen);
        offset += nameLen;

        assertBounds(buffer, offset, 1, `import ${i} kind`);
        const kind = buffer[offset++];

        if (kind === 0) {
          assertBounds(buffer, offset, 1, `import ${i} type index`);
          const typeIdx = readLEB128Value(buffer, offset);
          offset += countLEB128(buffer, offset);
          if (typeIdx >= typeSignatures.length) {
            throw new LinkerError(`Import ${i} type index ${typeIdx} out of range: ${typeSignatures.length} type signatures defined`);
          }
          importFuncTypes.push({
            module,
            name,
            params: typeSignatures[typeIdx].params,
            results: typeSignatures[typeIdx].results,
          });
        } else if (kind === 1) {
          assertBounds(buffer, offset, 1, `import ${i} table reserved byte`);
          offset += 1;
          assertBounds(buffer, offset, 1, `import ${i} table flags`);
          const tblFlags = buffer[offset++];
          offset += countLEB128(buffer, offset);
          if (tblFlags & 1) {
            offset += countLEB128(buffer, offset);
          }
        } else if (kind === 2) {
          assertBounds(buffer, offset, 1, `import ${i} memory flags`);
          const memFlags = buffer[offset++];
          offset += countLEB128(buffer, offset);
          if (memFlags & 1) {
            offset += countLEB128(buffer, offset);
          }
        } else if (kind === 3) {
          assertBounds(buffer, offset, 2, `import ${i} global reserved bytes`);
          offset += 1;
          offset++;
        }

        imports.push({ module, name, kind: decodeKind(kind) });
      }
    } else if (sectionId === 7) {
      assertBounds(buffer, offset, 1, 'export section count');
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        assertBounds(buffer, offset, 1, `export ${i} name length`);
        const nameLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        if (offset + nameLen > buffer.length) {
          throw new LinkerError(`Export ${i} name extends past buffer at offset ${offset}`);
        }
        const name = buffer.toString('utf-8', offset, offset + nameLen);
        offset += nameLen;

        assertBounds(buffer, offset, 1, `export ${i} kind`);
        const kind = buffer[offset++];
        offset += countLEB128(buffer, offset);

        exports.push({ name, kind: decodeKind(kind) });
      }
    }

    offset = sectionEnd;
  }

  return { fileName, buffer, imports, exports, importFuncTypes: importFuncTypes.length > 0 ? importFuncTypes : undefined };
}

export function parseWasmModule(filePath: string): WasmModuleInfo {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  return parseWasmBuffer(buffer, fileName);
}

export function mergeImportExportKinds(imports: WasmImport[], exports: WasmExport[], moduleMap: Map<string, WasmModuleInfo>): WasmImport[] {
  return imports.map((imp) => {
    if (imp.kind !== ('unknown' as WasmImport['kind'])) return imp;

    for (const [, mod] of moduleMap) {
      const matchingExport = mod.exports.find((e) => e.name === imp.name && e.kind !== ('unknown' as WasmExport['kind']));
      if (matchingExport) {
        return { ...imp, kind: matchingExport.kind };
      }
    }

    return imp;
  });
}
