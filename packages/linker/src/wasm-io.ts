import fs from 'node:fs';
import path from 'node:path';
import type { WasmModuleInfo, WasmExport, WasmImport, WasmImportFuncType } from '@wasm-apps/types';
import { readLEB128Value, countLEB128 } from './wasm-leb128.js';

const KIND_NAMES: Record<number, WasmImport['kind']> = {
  0: 'function',
  1: 'table',
  2: 'memory',
  3: 'global',
};

function decodeKind(kind: number): WasmImport['kind'] {
  return KIND_NAMES[kind] || 'unknown';
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
  for (let i = 0; i < count; i++) {
    const typeByte = data[pos++];
    types.push(VAL_TYPE_NAMES[typeByte] || 'i32');
  }
  return { types, offset: pos };
}

export function parseWasmModule(filePath: string): WasmModuleInfo {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  let offset = 8;
  const imports: WasmImport[] = [];
  const exports: WasmExport[] = [];
  const typeSignatures: Array<{ params: string[]; results: string[] }> = [];
  const importFuncTypes: WasmImportFuncType[] = [];
  let funcImportIdx = 0;

  while (offset < buffer.length) {
    if (offset + 1 > buffer.length) break;
    const sectionId = buffer[offset++];
    if (offset + 1 > buffer.length) break;
    const sectionSize = readLEB128Value(buffer, offset);
    offset += countLEB128(buffer, offset);
    const sectionEnd = offset + sectionSize;

    if (sectionId === 1) {
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        if (buffer[offset++] !== 0x60) break;
        const paramCount = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const { types: params, offset: newOffset1 } = readValTypes(buffer, offset, paramCount);
        offset = newOffset1;
        const resultCount = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const { types: results, offset: newOffset2 } = readValTypes(buffer, offset, resultCount);
        offset = newOffset2;
        typeSignatures.push({ params, results });
      }
    } else if (sectionId === 2) {
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        const moduleLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const module = buffer.toString('utf-8', offset, offset + moduleLen);
        offset += moduleLen;

        const nameLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const name = buffer.toString('utf-8', offset, offset + nameLen);
        offset += nameLen;

        const kind = buffer[offset++];

        if (kind === 0) {
          const typeIdx = readLEB128Value(buffer, offset);
          offset += countLEB128(buffer, offset);
          const sig = typeSignatures[typeIdx];
          if (sig) {
            importFuncTypes.push({
              module,
              name,
              params: sig.params,
              results: sig.results,
            });
          }
          funcImportIdx++;
        } else if (kind === 1) {
          offset += countLEB128(buffer, offset);
          offset += countLEB128(buffer, offset);
        } else if (kind === 2) {
          offset += countLEB128(buffer, offset);
        } else if (kind === 3) {
          offset += countLEB128(buffer, offset);
          buffer[offset++];
        }

        imports.push({ module, name, kind: decodeKind(kind) });
      }
    } else if (sectionId === 7) {
      const count = readLEB128Value(buffer, offset);
      offset += countLEB128(buffer, offset);
      for (let i = 0; i < count; i++) {
        const nameLen = readLEB128Value(buffer, offset);
        offset += countLEB128(buffer, offset);
        const name = buffer.toString('utf-8', offset, offset + nameLen);
        offset += nameLen;

        const kind = buffer[offset++];
        offset += countLEB128(buffer, offset);

        exports.push({ name, kind: decodeKind(kind) });
      }
    }

    offset = sectionEnd;
  }

  return { fileName, buffer, imports, exports, importFuncTypes: importFuncTypes.length > 0 ? importFuncTypes : undefined };
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
