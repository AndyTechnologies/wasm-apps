export function readLEB128(data: Uint8Array | Buffer, offset: number): { value: number; size: number } {
  let result = 0;
  let shift = 0;
  let count = 0;
  while (offset < data.length) {
    const byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    count++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) break;
  }
  return { value: result, size: count };
}

export function readLEB128Value(data: Uint8Array | Buffer, offset: number): number {
  return readLEB128(data, offset).value;
}

export function countLEB128(data: Uint8Array | Buffer, offset: number): number {
  return readLEB128(data, offset).size;
}

export function encodeLEB128(value: number): number[] {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}
