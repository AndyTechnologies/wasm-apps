import { logger } from '@wasm-apps/types';
import { readLEB128, countLEB128, encodeLEB128 } from './wasm-leb128.js';

interface WasmSection {
  id: number;
  content: Uint8Array;
}

interface ParsedSections {
  sections: WasmSection[];
  rawWasm: Uint8Array;
}

function parseSections(wasm: Uint8Array): ParsedSections {
  let offset = 8;
  const sections: WasmSection[] = [];
  while (offset < wasm.length) {
    const sectionId = wasm[offset++];
    const { value: sectionSize, size: lebSize } = readLEB128(wasm, offset);
    offset += lebSize;
    const sectionEnd = offset + sectionSize;
    sections.push({ id: sectionId, content: wasm.slice(offset, sectionEnd) });
    offset = sectionEnd;
  }
  return { sections, rawWasm: wasm };
}

function countImportedFunctions(importSection: WasmSection): number {
  let pos = 0;
  let numImported = 0;
  const { value: importCount } = readLEB128(importSection.content, pos);
  pos += countLEB128(importSection.content, pos);
  for (let i = 0; i < importCount; i++) {
    const modSize = readLEB128(importSection.content, pos);
    pos += modSize.size + modSize.value;
    const nameSize = readLEB128(importSection.content, pos);
    pos += nameSize.size + nameSize.value;
    const kind = importSection.content[pos++];
    if (kind === 0) {
      numImported++;
      pos += countLEB128(importSection.content, pos);
    }
  }
  return numImported;
}

function collectExportedFunctionIndices(exportSection: WasmSection, numImportedFuncs: number, totalLocalFuncs: number): Set<number> {
  const referenced = new Set<number>();
  let pos = 0;
  const { value: exportCount } = readLEB128(exportSection.content, pos);
  pos += countLEB128(exportSection.content, pos);
  for (let i = 0; i < exportCount; i++) {
    const nameSize = readLEB128(exportSection.content, pos);
    pos += nameSize.size + nameSize.value;
    const kind = exportSection.content[pos++];
    const { value: funcIdx } = readLEB128(exportSection.content, pos);
    pos += countLEB128(exportSection.content, pos);
    if (kind === 0) {
      const localIdx = funcIdx - numImportedFuncs;
      if (localIdx >= 0 && localIdx < totalLocalFuncs) {
        referenced.add(localIdx);
      }
    }
  }
  return referenced;
}

function getStartFunctionIndex(startSection: WasmSection | undefined, numImportedFuncs: number, totalLocalFuncs: number): number | undefined {
  if (!startSection) return undefined;
  const { value: startFuncIdx } = readLEB128(startSection.content, 0);
  const localIdx = startFuncIdx - numImportedFuncs;
  if (localIdx >= 0 && localIdx < totalLocalFuncs) {
    return localIdx;
  }
  return undefined;
}

function scanCallReferences(codeSection: WasmSection, numImportedFuncs: number, totalLocalFuncs: number): Set<number> {
  const referenced = new Set<number>();
  let pos = 0;
  const { value: bodyCount } = readLEB128(codeSection.content, pos);
  pos += countLEB128(codeSection.content, pos);

  for (let bodyIdx = 0; bodyIdx < bodyCount; bodyIdx++) {
    const { value: bodySize } = readLEB128(codeSection.content, pos);
    pos += countLEB128(codeSection.content, pos);
    const bodyEnd = pos + bodySize;

    const { value: localsCount } = readLEB128(codeSection.content, pos);
    pos += countLEB128(codeSection.content, pos);
    for (let l = 0; l < localsCount; l++) {
      pos += countLEB128(codeSection.content, pos);
      pos++;
    }

    while (pos < bodyEnd) {
      const opcode = codeSection.content[pos++];

      if (opcode === 0x10) {
        const { value: funcIdx } = readLEB128(codeSection.content, pos);
        pos += countLEB128(codeSection.content, pos);
        const localIdx = funcIdx - numImportedFuncs;
        if (localIdx >= 0 && localIdx < totalLocalFuncs) referenced.add(localIdx);
      } else if (opcode === 0x11) {
        pos += countLEB128(codeSection.content, pos);
        pos++;
      } else if (opcode === 0x12) {
        const { value: funcIdx } = readLEB128(codeSection.content, pos);
        pos += countLEB128(codeSection.content, pos);
        const localIdx = funcIdx - numImportedFuncs;
        if (localIdx >= 0 && localIdx < totalLocalFuncs) referenced.add(localIdx);
      } else if (opcode >= 0x1a && opcode <= 0x1f) {
        const { value: numTargets } = readLEB128(codeSection.content, pos);
        pos += countLEB128(codeSection.content, pos);
        for (let t = 0; t <= numTargets; t++) {
          pos += countLEB128(codeSection.content, pos);
        }
      } else if (opcode === 0xfc) {
        const { value: subop } = readLEB128(codeSection.content, pos);
        pos += countLEB128(codeSection.content, pos);
        if (subop === 8 || subop === 9) {
          pos += 2;
        } else if (subop >= 10 && subop <= 12) {
          pos += 2;
        } else if (subop === 13 || subop === 14) {
          pos++;
        }
      } else if (opcode === 0xfd) {
        pos += countLEB128(codeSection.content, pos);
      }
    }

    pos = bodyEnd;
  }

  return referenced;
}

function findUnreferencedFunctions(totalLocalFuncs: number, referencedLocals: Set<number>): number[] {
  const unreferenced: number[] = [];
  for (let i = 0; i < totalLocalFuncs; i++) {
    if (!referencedLocals.has(i)) unreferenced.push(i);
  }
  return unreferenced;
}

function stubbedCodeSection(codeSection: WasmSection, unreferenced: number[]): WasmSection {
  let pos = 0;
  const { value: bodyCount } = readLEB128(codeSection.content, pos);
  pos += countLEB128(codeSection.content, pos);

  const newBytes: number[] = [];
  newBytes.push(...encodeLEB128(bodyCount));

  let localFuncIdx = 0;
  for (let bodyIdx = 0; bodyIdx < bodyCount; bodyIdx++) {
    const sizeStart = pos;
    const bodySize = readLEB128(codeSection.content, pos);
    pos += bodySize.size;
    const bodyEnd = pos + bodySize.value;

    if (unreferenced.includes(localFuncIdx)) {
      // Reemplazar cuerpo no usado con un stub mínimo: 0 locals, unreachable, end
      // No reindexamos porque requeriría remapear todas las referencias
      // (call opcodes, export indices, start section) en todo el módulo.
      const stubBody = new Uint8Array([0x00, 0x00, 0x1b, 0x0b]);
      newBytes.push(...encodeLEB128(stubBody.length), ...stubBody);
    } else {
      for (let k = sizeStart; k < bodyEnd; k++) {
        newBytes.push(codeSection.content[k]);
      }
    }

    localFuncIdx++;
    pos = bodyEnd;
  }

  return { id: codeSection.id, content: Uint8Array.from(newBytes) };
}

function reconstructBinary(sections: WasmSection[], rawWasm: Uint8Array): Buffer {
  const parts: Uint8Array[] = [rawWasm.slice(0, 8)];
  for (const section of sections) {
    parts.push(Uint8Array.from([section.id]));
    const sizeBytes = encodeLEB128(section.content.length);
    parts.push(Uint8Array.from(sizeBytes));
    parts.push(section.content);
  }
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return Buffer.from(result);
}

export function treeShake(wasmBuffer: Buffer): Buffer {
  const { sections, rawWasm } = parseSections(wasmBuffer);

  const codeSection = sections.find((s) => s.id === 10);
  const functionSection = sections.find((s) => s.id === 3);

  if (!codeSection || !functionSection) {
    logger.detail('No code or function section found; skipping tree-shake');
    return Buffer.from(rawWasm);
  }

  const importSection = sections.find((s) => s.id === 2);
  const numImportedFuncs = importSection ? countImportedFunctions(importSection) : 0;

  let pos = 0;
  const { value: funcCount } = readLEB128(functionSection.content, pos);

  const referencedLocals = new Set<number>();

  const exportSection = sections.find((s) => s.id === 7);
  if (exportSection) {
    const exported = collectExportedFunctionIndices(exportSection, numImportedFuncs, funcCount);
    for (const idx of exported) referencedLocals.add(idx);
  }

  const called = scanCallReferences(codeSection, numImportedFuncs, funcCount);
  for (const idx of called) referencedLocals.add(idx);

  const startSection = sections.find((s) => s.id === 8);
  const startFuncIdx = getStartFunctionIndex(startSection, numImportedFuncs, funcCount);
  if (startFuncIdx !== undefined) {
    referencedLocals.add(startFuncIdx);
  } else {
    referencedLocals.add(0);
  }

  const unreferenced = findUnreferencedFunctions(funcCount, referencedLocals);
  if (unreferenced.length === 0) return Buffer.from(rawWasm);

  const updatedSections = sections.map((s) => (s.id === 10 ? stubbedCodeSection(s, unreferenced) : s));

  return reconstructBinary(updatedSections, rawWasm);
}

/** @deprecated Usa treeShake en su lugar. */
export const treeShakeWasm = treeShake;
