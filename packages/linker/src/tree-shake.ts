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

interface ParsedSection {
  id: number;
  start: number;
  contentStart: number;
  size: number;
  end: number;
}

interface ParsedCodeBody {
  localFuncIdx: number;
  bsLen: number;
  bodyStart: number;
  bodyEnd: number;
  calledFuncs: Set<number>;
}

function parseSections(wasm: Uint8Array): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let pos = 8;
  while (pos < wasm.length) {
    const sectionId = wasm[pos++];
    const [sectionSize, sLen] = decodeLEB128(wasm, pos);
    pos += sLen;
    sections.push({
      id: sectionId,
      start: pos - 1 - sLen,
      contentStart: pos,
      size: sectionSize,
      end: pos + sectionSize,
    });
    pos += sectionSize;
  }
  return sections;
}

function readSectionEntries(wasm: Uint8Array, sections: ParsedSection[], id: number): number {
  const sec = sections.find(s => s.id === id);
  if (!sec) return 0;
  const [count] = decodeLEB128(wasm, sec.contentStart);
  return count;
}

function parseCodeBodies(wasm: Uint8Array, sections: ParsedSection[], numLocalFuncs: number): ParsedCodeBody[] {
  const codeSec = sections.find(s => s.id === 10);
  if (!codeSec) return [];

  const bodies: ParsedCodeBody[] = [];
  let pos = codeSec.contentStart;
  const [count] = decodeLEB128(wasm, pos);
  pos += decodeLEB128(wasm, pos)[1];

  for (let i = 0; i < count && i < numLocalFuncs; i++) {
    const [bodySize, bsLen] = decodeLEB128(wasm, pos);
    const bodyStart = pos + bsLen;
    const bodyEnd = bodyStart + bodySize;

    let lPos = bodyStart;
    const [localsCount] = decodeLEB128(wasm, lPos);
    lPos += decodeLEB128(wasm, lPos)[1];
    for (let l = 0; l < localsCount; l++) {
      const [declCount, dcLen] = decodeLEB128(wasm, lPos);
      lPos += dcLen + 1;
    }

    const calledFuncs = new Set<number>();
    let ip = lPos;
    while (ip < bodyEnd) {
      const opcode = wasm[ip];
      if (opcode === 0x10) {
        const [funcIdx] = decodeLEB128(wasm, ip + 1);
        calledFuncs.add(funcIdx);
        ip += 1 + decodeLEB128(wasm, ip + 1)[1];
      } else if (opcode === 0x11) {
        ip += 1 + decodeLEB128(wasm, ip + 1)[1];
      } else {
        ip += 1;
      }
    }

    bodies.push({ localFuncIdx: i, bsLen, bodyStart, bodyEnd, calledFuncs });
    pos = bodyEnd;
  }

  return bodies;
}

function getExportedFuncIndices(wasm: Uint8Array, sections: ParsedSection[]): number[] {
  const exportSec = sections.find(s => s.id === 7);
  if (!exportSec) return [];

  const indices: number[] = [];
  let pos = exportSec.contentStart;
  const [count] = decodeLEB128(wasm, pos);
  pos += decodeLEB128(wasm, pos)[1];

  for (let i = 0; i < count; i++) {
    const [fieldLen, flLen] = decodeLEB128(wasm, pos);
    pos += flLen + fieldLen;
    const kind = wasm[pos++];
    if (kind === 0) {
      const [funcIdx] = decodeLEB128(wasm, pos);
      indices.push(funcIdx);
    }
    pos += decodeLEB128(wasm, pos)[1];
  }

  return indices;
}

function getFuncImportCount(wasm: Uint8Array, sections: ParsedSection[]): number {
  const importSec = sections.find(s => s.id === 2);
  if (!importSec) return 0;

  let count = 0;
  let pos = importSec.contentStart;
  const [numImports] = decodeLEB128(wasm, pos);
  pos += decodeLEB128(wasm, pos)[1];

  for (let i = 0; i < numImports; i++) {
    const [modLen, mlLen] = decodeLEB128(wasm, pos);
    pos += mlLen + modLen;
    const [nameLen, nlLen] = decodeLEB128(wasm, pos);
    pos += nlLen + nameLen;
    const kind = wasm[pos++];
    if (kind === 0) {
      count++;
      pos += decodeLEB128(wasm, pos)[1];
    } else if (kind === 1 || kind === 2) {
      pos += 2;
    } else {
      pos += 2;
    }
  }

  return count;
}

function buildCallGraph(bodies: ParsedCodeBody[], importCount: number, exportedFuncs: number[]): Set<number> {
  const reachable = new Set<number>();
  const queue: number[] = [];

  for (const idx of exportedFuncs) {
    if (!reachable.has(idx)) {
      reachable.add(idx);
      queue.push(idx);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current < importCount) continue;
    const localIdx = current - importCount;
    const body = bodies.find(b => b.localFuncIdx === localIdx);
    if (!body) continue;
    for (const callee of body.calledFuncs) {
      if (!reachable.has(callee)) {
        reachable.add(callee);
        queue.push(callee);
      }
    }
  }

  return reachable;
}

function rewriteCallOpcodes(
  wasm: Uint8Array,
  bodyStart: number,
  bodyEnd: number,
  remapFuncIdx: (idx: number) => number,
): number[] {
  const result: number[] = [];
  let ip = bodyStart;
  while (ip < bodyEnd) {
    const opcode = wasm[ip];
    if (opcode === 0x10) {
      const [oldIdx, len] = decodeLEB128(wasm, ip + 1);
      const newIdx = remapFuncIdx(oldIdx);
      result.push(opcode);
      result.push(...encodeU32(newIdx >= 0 ? newIdx : 0));
      ip += 1 + len;
    } else if (opcode === 0x11) {
      const [typeIdx, len] = decodeLEB128(wasm, ip + 1);
      result.push(opcode);
      result.push(...encodeU32(typeIdx));
      ip += 1 + len;
    } else {
      result.push(opcode);
      ip += 1;
    }
  }
  return result;
}

/**
 * Tree-shakes a WASM module by removing unused functions.
 * Traces the call graph starting from exported functions,
 * then rewrites function, code, and export sections to
 * only keep reachable functions.
 */
export function treeShakeWasm(wasmBuffer: Uint8Array): Uint8Array {
  if (wasmBuffer.length < 8) return wasmBuffer;
  const wasm = wasmBuffer;

  const sections = parseSections(wasm);
  const funcImportCount = getFuncImportCount(wasm, sections);
  const localFuncCount = readSectionEntries(wasm, sections, 3);

  if (localFuncCount === 0) return wasm;

  const bodies = parseCodeBodies(wasm, sections, localFuncCount);
  const exportedFuncs = getExportedFuncIndices(wasm, sections);
  if (exportedFuncs.length === 0) return wasm;

  const reachable = buildCallGraph(bodies, funcImportCount, exportedFuncs);

  const keptLocalFuncs = new Set<number>();
  for (let i = 0; i < localFuncCount; i++) {
    const absIdx = funcImportCount + i;
    if (reachable.has(absIdx)) {
      keptLocalFuncs.add(i);
    }
  }

  if (keptLocalFuncs.size >= localFuncCount) return wasm;

  const oldToNewLocalIdx = new Map<number, number>();
  let newLocalIdx = 0;
  for (let i = 0; i < localFuncCount; i++) {
    if (keptLocalFuncs.has(i)) {
      oldToNewLocalIdx.set(i, newLocalIdx++);
    }
  }

  function remapFuncIdx(absIdx: number): number {
    if (absIdx < funcImportCount) return absIdx;
    const localIdx = absIdx - funcImportCount;
    const newLocal = oldToNewLocalIdx.get(localIdx);
    if (newLocal === undefined) return -1;
    return funcImportCount + newLocal;
  }

  const result: number[] = [];
  result.push(...wasm.slice(0, 8));

  for (const sec of sections) {
    if (sec.id === 3) {
      const content: number[] = [];
      content.push(...encodeU32(oldToNewLocalIdx.size));
      let pos = sec.contentStart + decodeLEB128(wasm, sec.contentStart)[1];
      for (let i = 0; i < localFuncCount; i++) {
        if (keptLocalFuncs.has(i)) {
          const [typeIdx] = decodeLEB128(wasm, pos);
          content.push(...encodeU32(typeIdx));
        }
        pos += decodeLEB128(wasm, pos)[1];
      }
      const sizeBytes = encodeU32(content.length);
      result.push(3, ...sizeBytes, ...content);
    } else if (sec.id === 7) {
      const content: number[] = [];
      let pos = sec.contentStart;
      const [count] = decodeLEB128(wasm, pos);
      content.push(...encodeU32(count));
      pos += decodeLEB128(wasm, pos)[1];
      for (let i = 0; i < count; i++) {
        const [fieldLen] = decodeLEB128(wasm, pos);
        const flLen = decodeLEB128(wasm, pos)[1];
        pos += flLen;
        content.push(...encodeU32(fieldLen));
        content.push(...wasm.slice(pos, pos + fieldLen));
        pos += fieldLen;
        const kind = wasm[pos++];
        content.push(kind);
        if (kind === 0) {
          const [oldIdx] = decodeLEB128(wasm, pos);
          const newIdx = remapFuncIdx(oldIdx);
          content.push(...encodeU32(newIdx >= 0 ? newIdx : 0));
        } else {
          const [idx] = decodeLEB128(wasm, pos);
          content.push(...encodeU32(idx));
        }
        pos += decodeLEB128(wasm, pos)[1];
      }
      const sizeBytes = encodeU32(content.length);
      result.push(7, ...sizeBytes, ...content);
    } else if (sec.id === 10) {
      const content: number[] = [];
      content.push(...encodeU32(oldToNewLocalIdx.size));
      for (let i = 0; i < localFuncCount; i++) {
        if (keptLocalFuncs.has(i)) {
          const body = bodies.find(b => b.localFuncIdx === i)!;
          const rewrittenBody = rewriteCallOpcodes(wasm, body.bodyStart, body.bodyEnd, remapFuncIdx);
          const bodySizeEncoded = encodeU32(rewrittenBody.length);
          content.push(...bodySizeEncoded);
          content.push(...rewrittenBody);
        }
      }
      const sizeBytes = encodeU32(content.length);
      result.push(10, ...sizeBytes, ...content);
    } else {
      result.push(...wasm.slice(sec.start, sec.end));
    }
  }

  return new Uint8Array(result);
}
