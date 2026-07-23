import { LinkerError } from '@wasm-apps/types';

export function readLEB128(data: Uint8Array | Buffer, offset: number): { value: number; size: number } {
  if (offset >= data.length) {
    throw new LinkerError(`LEB128 read at offset ${offset} would exceed buffer length ${data.length}`);
  }
  let result = 0;
  let shift = 0;
  let count = 0;
  while (offset < data.length) {
    const byte = data[offset++];
    result |= (byte & 0x7f) << shift;
    count++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (count >= 10) {
      throw new LinkerError(`LEB128 value exceeds maximum encoded length of 10 bytes at offset ${offset - count}`);
    }
    if (shift > 35) {
      throw new LinkerError('LEB128 value exceeds 36-bit limit — unsupported WASM 64-bit value');
    }
  }
  // If we exhausted the buffer without finding the end of the LEB128 value
  if ((data[offset - 1] & 0x80) !== 0) {
    throw new LinkerError(`Incomplete LEB128 value — unexpected end of data at offset ${offset}`);
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
