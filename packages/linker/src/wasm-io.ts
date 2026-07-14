import fs from 'fs';
import { WasmModuleInfo, WasmExport, WasmImport, WasmImportFuncType } from '@wasm-apps/types';

export async function readWasmModules(filePaths: string[]): Promise<WasmModuleInfo[]> {
  const modules: WasmModuleInfo[] = [];
  for (const filePath of filePaths) {
    const buffer = fs.readFileSync(filePath);
    const wasmModule = new WebAssembly.Module(buffer);
    const imports = WebAssembly.Module.imports(wasmModule).map(imp => ({
      module: imp.module,
      name: imp.name,
      kind: imp.kind as WasmImport['kind'],
    }));
    const exports = WebAssembly.Module.exports(wasmModule).map(exp => ({
      name: exp.name,
      kind: exp.kind as WasmExport['kind'],
    }));

    modules.push({ fileName: filePath, buffer, imports, exports });
  }
  return modules;
}

function decodeLEB128(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (true) {
    const byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) break;
  }
  return [result, pos - offset];
}

const VALTYPE_NAMES: Record<number, string> = {
  0x7F: 'i32',
  0x7E: 'i64',
  0x7D: 'f32',
  0x7C: 'f64',
};

export function parseImportFuncTypes(buffer: Buffer): WasmImportFuncType[] {
  const bytes = new Uint8Array(buffer);
  let pos = 8;
  const funcTypes: Array<{ params: string[]; results: string[] }> = [];
  const result: WasmImportFuncType[] = [];

  while (pos < bytes.length) {
    const sectionId = bytes[pos++];
    const [sectionSize, sLen] = decodeLEB128(bytes, pos);
    pos += sLen;
    const sectionEnd = pos + sectionSize;

    if (sectionId === 1) {
      const [count, cLen] = decodeLEB128(bytes, pos);
      pos += cLen;
      for (let i = 0; i < count; i++) {
        if (bytes[pos++] !== 0x60) break;
        const [paramCount, pcLen] = decodeLEB128(bytes, pos);
        pos += pcLen;
        const params: string[] = [];
        for (let j = 0; j < paramCount; j++) {
          params.push(VALTYPE_NAMES[bytes[pos++]] || 'unknown');
        }
        const [resultCount, rcLen] = decodeLEB128(bytes, pos);
        pos += rcLen;
        const results: string[] = [];
        for (let j = 0; j < resultCount; j++) {
          results.push(VALTYPE_NAMES[bytes[pos++]] || 'unknown');
        }
        funcTypes.push({ params, results });
      }
    } else if (sectionId === 2) {
      const [count, cLen] = decodeLEB128(bytes, pos);
      pos += cLen;
      for (let i = 0; i < count; i++) {
        const [modLen, mlLen] = decodeLEB128(bytes, pos);
        pos += mlLen;
        const module = new TextDecoder().decode(bytes.slice(pos, pos + modLen));
        pos += modLen;
        const [nameLen, nlLen] = decodeLEB128(bytes, pos);
        pos += nlLen;
        const name = new TextDecoder().decode(bytes.slice(pos, pos + nameLen));
        pos += nameLen;
        const kind = bytes[pos++];
        if (kind === 0) {
          const [typeIdx, tiLen] = decodeLEB128(bytes, pos);
          pos += tiLen;
          const ft = funcTypes[typeIdx];
          if (ft) {
            result.push({ module, name, params: ft.params, results: ft.results });
          }
        } else if (kind === 1 || kind === 2) {
          pos += 2;
        } else if (kind === 3) {
          pos += 2;
        }
      }
    }

    pos = sectionEnd;
  }

  return result;
}
