const WASM_MAGIC = 0x6d736100;
const CUSTOM_SECTION_ID = 0;

const STRIP_SECTIONS = new Set([
  'name',
  'producers',
  'sourceMappingURL',
]);

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

function encodeLEB128(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return new Uint8Array(bytes);
}

function readSectionName(bytes: Uint8Array, offset: number, size: number): string | null {
  const [nameLen, nlLen] = decodeLEB128(bytes, offset);
  const nameStart = offset + nlLen;
  if (nameStart + nameLen > offset + size) return null;
  return new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
}

export function stripWasm(buffer: Buffer): Buffer {
  const bytes = new Uint8Array(buffer);

  const magic = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0, true);
  if (magic !== WASM_MAGIC) return buffer;

  const version = new DataView(buffer.buffer, buffer.byteOffset + 4, 4).getUint32(0, true);
  if (version !== 1) return buffer;

  const result: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

  let pos = 8;
  while (pos < bytes.length) {
    const sectionId = bytes[pos++];
    const [sectionSize, sLen] = decodeLEB128(bytes, pos);
    pos += sLen;
    const sectionEnd = pos + sectionSize;

    if (sectionId === CUSTOM_SECTION_ID) {
      const name = readSectionName(bytes, pos, sectionSize);
      if (name && STRIP_SECTIONS.has(name)) {
        pos = sectionEnd;
        continue;
      }
    }

    result.push(sectionId);
    const sizeBytes = encodeLEB128(sectionSize);
    for (const b of sizeBytes) result.push(b);
    for (let i = pos; i < sectionEnd; i++) result.push(bytes[i]);

    pos = sectionEnd;
  }

  return Buffer.from(result);
}
