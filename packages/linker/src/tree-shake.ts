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
  bodyStart: number;
  bodyEnd: number;
  calledFuncs: Set<number>;
}

// Minimal valid body: 0 locals, unreachable, end = 3 bytes
const MINIMAL_BODY = [0x00, 0x00, 0x0b];

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
      lPos += decodeLEB128(wasm, lPos)[1] + 1;
    }

    const calledFuncs = new Set<number>();
    let ip = lPos;
    while (ip < bodyEnd) {
      const opcode = wasm[ip];
      if (opcode === 0x10) {
        const [funcIdx] = decodeLEB128(wasm, ip + 1);
        calledFuncs.add(funcIdx);
        ip += 1 + decodeLEB128(wasm, ip + 1)[1];
      } else {
        ip += wasmInstLength(wasm, ip);
      }
    }

    bodies.push({ localFuncIdx: i, bodyStart, bodyEnd, calledFuncs });
    pos = bodyEnd;
  }

  return bodies;
}

function wasmInstLength(wasm: Uint8Array, offset: number): number {
  const opcode = wasm[offset];
  if (opcode >= 0x02 && opcode <= 0x04) {
    const bt = wasm[offset + 1];
    if (bt === 0x40 || bt === 0x7f || bt === 0x7e || bt === 0x7d || bt === 0x7c) return 2;
    return 1 + decodeLEB128(wasm, offset + 1)[1];
  }
  if (opcode === 0x0e) {
    let pos = offset + 1 + decodeLEB128(wasm, offset + 1)[1];
    const [numTargets] = decodeLEB128(wasm, pos);
    pos += decodeLEB128(wasm, pos)[1];
    for (let i = 0; i <= numTargets; i++) {
      pos += decodeLEB128(wasm, pos)[1];
    }
    return pos - offset;
  }
  if (opcode === 0x10 || opcode === 0x12 || opcode >= 0x0c && opcode <= 0x0d) {
    return 1 + decodeLEB128(wasm, offset + 1)[1];
  }
  if (opcode === 0x11 || opcode === 0x13) {
    return 2 + decodeLEB128(wasm, offset + 1)[1];
  }
  if (opcode >= 0x20 && opcode <= 0x24) {
    return 1 + decodeLEB128(wasm, offset + 1)[1];
  }
  if (opcode >= 0x28 && opcode <= 0x35) {
    const alignLen = decodeLEB128(wasm, offset + 1)[1];
    return 1 + alignLen + decodeLEB128(wasm, offset + 1 + alignLen)[1];
  }
  if (opcode === 0x3f || opcode === 0x40) return 2;
  if (opcode === 0x41) return 1 + decodeLEB128(wasm, offset + 1)[1];
  if (opcode === 0x42) return 1 + sleb128Length(wasm, offset + 1);
  if (opcode === 0x43) return 5;
  if (opcode === 0x44) return 9;
  if (opcode === 0xfc || opcode === 0xfb) return 2;
  return 1;
}

function sleb128Length(wasm: Uint8Array, offset: number): number {
  let pos = offset;
  while (true) {
    if (!(wasm[pos++] & 0x80)) break;
  }
  return pos - offset;
}

function getExportedFuncIndices(wasm: Uint8Array, sections: ParsedSection[]): number[] {
  const exportSec = sections.find(s => s.id === 7);
  if (!exportSec) return [];

  const indices: number[] = [];
  let pos = exportSec.contentStart;
  const [count] = decodeLEB128(wasm, pos);
  pos += decodeLEB128(wasm, pos)[1];

  for (let i = 0; i < count; i++) {
    const [fieldLen] = decodeLEB128(wasm, pos);
    pos += decodeLEB128(wasm, pos)[1] + fieldLen;
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
    const [modLen] = decodeLEB128(wasm, pos);
    pos += decodeLEB128(wasm, pos)[1] + modLen;
    const [nameLen] = decodeLEB128(wasm, pos);
    pos += decodeLEB128(wasm, pos)[1] + nameLen;
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

function getStartFuncIndex(wasm: Uint8Array, sections: ParsedSection[]): number | undefined {
  const sec = sections.find(s => s.id === 8);
  if (!sec) return undefined;
  const [idx] = decodeLEB128(wasm, sec.contentStart);
  return idx;
}

function buildCallGraph(bodies: ParsedCodeBody[], importCount: number, exportedFuncs: number[], startFuncIdx?: number): Set<number> {
  const reachable = new Set<number>();
  const queue: number[] = [];

  for (const idx of exportedFuncs) {
    if (!reachable.has(idx)) {
      reachable.add(idx);
      queue.push(idx);
    }
  }

  if (startFuncIdx !== undefined && !reachable.has(startFuncIdx)) {
    reachable.add(startFuncIdx);
    queue.push(startFuncIdx);
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

/**
 * Tree-shakes a WASM module by replacing unused function bodies
 * with minimal valid bodies (unreachable; end).
 * Preserves all indices so no call opcode rewriting is needed.
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
  const startFuncIdx = getStartFuncIndex(wasm, sections);
  if (exportedFuncs.length === 0 && startFuncIdx === undefined) return wasm;

  const reachable = buildCallGraph(bodies, funcImportCount, exportedFuncs, startFuncIdx);

  const totalSavings = bodies.reduce((acc, b) => {
    const absIdx = funcImportCount + b.localFuncIdx;
    if (!reachable.has(absIdx)) return acc + (b.bodyEnd - b.bodyStart) - MINIMAL_BODY.length;
    return acc;
  }, 0);

  if (totalSavings <= 0) return wasm;

  const result: number[] = [];
  result.push(...wasm.slice(0, 8));

  for (const sec of sections) {
    if (sec.id === 10) {
      const content: number[] = [];
      content.push(...encodeU32(localFuncCount));
      for (let i = 0; i < localFuncCount; i++) {
        const absIdx = funcImportCount + i;
        if (reachable.has(absIdx)) {
          const body = bodies.find(b => b.localFuncIdx === i)!;
          const bodySize = body.bodyEnd - body.bodyStart;
          content.push(...encodeU32(bodySize));
          content.push(...wasm.slice(body.bodyStart, body.bodyEnd));
        } else {
          content.push(...encodeU32(MINIMAL_BODY.length));
          content.push(...MINIMAL_BODY);
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
