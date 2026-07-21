import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable } from 'node:stream';
import { DownloadError } from '@wasm-apps/types';

let finishTimer: ReturnType<typeof setTimeout>;

function makeWritable(): Writable {
  const w = new Writable({
    write(_chunk: any, _encoding: any, callback: Function) {
      callback();
    },
    final(callback: Function) {
      callback();
    },
  });
  w.destroy = vi.fn();
  // Don't auto-emit finish — let the pipe chain manage it
  return w;
}

const mkCreateDecompressor = vi.hoisted(() => vi.fn(makeWritable));
const mkTarX = vi.hoisted(() => vi.fn(makeWritable));

vi.mock('lzma-native', () => ({ createDecompressor: mkCreateDecompressor }));
vi.mock('tar', () => ({ x: mkTarX }));

describe('extractArchive security options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createDecompressor with memlimit option', async () => {
    const { extractArchive } = await import('./extract.js');

    const testDir = mkdtempSync(join(tmpdir(), 'extract-test-'));
    const archive = join(testDir, 'test.tar.xz');
    writeFileSync(archive, Buffer.alloc(64));
    const dest = join(testDir, 'out');
    mkdirSync(dest, { recursive: true });

    // The call will time out or resolve — catch any error
    await extractArchive(archive, dest).catch(() => {});

    expect(mkCreateDecompressor).toHaveBeenCalledWith(expect.objectContaining({ memlimit: 256 * 1024 * 1024 }));

    rmSync(testDir, { recursive: true, force: true });
  });

  it('extractZip rejects path traversal in ZIP entries', async () => {
    const { extractZip } = await import('./extract.js');

    const testDir = mkdtempSync(join(tmpdir(), 'extract-zip-'));
    const archive = join(testDir, 'traversal.zip');

    // Build a minimal ZIP with a path traversal filename (../../../etc/passwd)
    // ZIP local header structure: sig(4) + version(2) + flags(2) + method(2) +
    //   modtime(2) + moddate(2) + crc32(4) + csize(4) + usize(4) +
    //   fnameLen(2) + extraLen(2) + fname(variable) + extra(variable)
    const fileName = Buffer.from('../../../etc/passwd');
    const fnameLen = fileName.length;
    const buf = Buffer.alloc(30 + fnameLen);
    buf.writeUInt32LE(0x04034b50, 0); // local file header signature
    buf.writeUInt16LE(0, 4); // version needed
    buf.writeUInt16LE(0, 6); // flags
    buf.writeUInt16LE(0, 8); // compression method (stored)
    buf.writeUInt16LE(0, 10); // mod time
    buf.writeUInt16LE(0, 12); // mod date
    buf.writeUInt32LE(0, 14); // crc32
    buf.writeUInt32LE(0, 18); // compressed size
    buf.writeUInt32LE(0, 22); // uncompressed size
    buf.writeUInt16LE(fnameLen, 26); // file name length
    buf.writeUInt16LE(0, 28); // extra field length
    fileName.copy(buf, 30);

    writeFileSync(archive, buf);
    const dest = join(testDir, 'out');
    mkdirSync(dest, { recursive: true });

    await expect(extractZip(archive, dest)).rejects.toThrow(DownloadError);

    rmSync(testDir, { recursive: true, force: true });
  });

  it('calls tar.x with filter option and filter rejects bad entries', async () => {
    const { extractArchive } = await import('./extract.js');

    const testDir = mkdtempSync(join(tmpdir(), 'extract-test-'));
    const archive = join(testDir, 'test.tar.xz');
    writeFileSync(archive, Buffer.alloc(64));
    const dest = join(testDir, 'out');
    mkdirSync(dest, { recursive: true });

    await extractArchive(archive, dest).catch(() => {});

    expect(mkTarX).toHaveBeenCalledWith(expect.objectContaining({ filter: expect.any(Function) }));

    // Test the filter function directly
    const options = mkTarX.mock.calls[0][0];
    const filterFn = options.filter as (path: string, entry: { type: string }) => boolean;

    expect(() => filterFn('/etc/passwd', { type: 'File' })).toThrow();
    expect(() => filterFn('link', { type: 'SymbolicLink' })).toThrow();
    expect(filterFn('wasmtime/include/wasm.h', { type: 'File' })).toBe(true);
    expect(filterFn('lib/wasmtime.a', { type: 'File' })).toBe(true);

    rmSync(testDir, { recursive: true, force: true });
  });
});
