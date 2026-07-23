import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as tar from 'tar';
import { createDecompressor } from 'lzma-native';
import { DownloadError } from '@wasm-apps/types';

const ZIP_LOCAL_HEADER_SIG = 0x04034b50;
const MAX_ZIP_SCAN_BYTES = 65536;

function isPathSafe(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  if (path.isAbsolute(normalized)) return false;
  if (normalized === '..' || normalized === '.' || normalized === '') return false;
  if (normalized.includes('..')) return false;
  return true;
}

function destroyStreams(...streams: any[]): void {
  for (const s of streams) {
    if (typeof (s as any).destroy === 'function') (s as any).destroy();
  }
}

export function extractArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });

    const decompressor = createDecompressor({ memlimit: 256 * 1024 * 1024 });
    const extract = tar.x({
      C: destDir,
      filter: (filePath: string, _entry: any) => {
        if (path.isAbsolute(filePath)) {
          throw new DownloadError(`Absolute path rejected in tar archive: ${filePath}`, archivePath);
        }
        if (_entry.type === 'SymbolicLink') {
          throw new DownloadError(`Symlink rejected in tar archive: ${filePath}`, archivePath);
        }
        return true;
      },
    });
    const readStream = fs.createReadStream(archivePath);

    const onError = (err: Error, msg: string) => {
      destroyStreams(readStream, decompressor, extract);
      reject(new DownloadError(`${msg}: ${err.message}`, archivePath, undefined, err));
    };

    readStream
      .on('error', (err: Error) => onError(err, 'Read failed'))
      .pipe(decompressor)
      .on('error', (err: Error) => onError(err, 'xz decompression failed'))
      .pipe(extract)
      .on('error', (err: Error) => onError(err, 'tar extraction failed'))
      .on('finish', () => resolve());
  });
}

function findNextLocalHeader(buffer: Buffer, startOffset: number): number {
  const end = Math.min(startOffset + MAX_ZIP_SCAN_BYTES, buffer.length - 30);
  for (let i = startOffset; i < end; i++) {
    if (buffer.readUInt32LE(i) === ZIP_LOCAL_HEADER_SIG) {
      return i;
    }
  }
  return -1;
}

export async function extractZip(archivePath: string, destDir: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });

  const buffer = await fs.promises.readFile(archivePath);
  let offset = 0;
  let entriesFound = 0;

  while (offset <= buffer.length - 30) {
    offset = findNextLocalHeader(buffer, offset);
    if (offset < 0) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const headerSize = 30 + fileNameLength + extraFieldLength;
    const dataOffset = offset + headerSize;

    if (compressedSize === 0 && uncompressedSize === 0 && fileNameLength === 0) {
      break;
    }

    if (dataOffset + compressedSize > buffer.length) {
      throw new DownloadError('ZIP entry exceeds archive bounds', archivePath);
    }

    const fileName = buffer.toString('utf-8', offset + 30, offset + 30 + fileNameLength);
    const safeName = path.normalize(fileName).replace(/^[/\\]+/, '');

    if (!isPathSafe(safeName)) {
      throw new DownloadError(`Path traversal detected in ZIP: ${fileName}`, archivePath);
    }

    if (fileName.endsWith('/')) {
      await fs.promises.mkdir(path.join(destDir, safeName), { recursive: true });
    } else if (compressionMethod === 0) {
      const filePath = path.join(destDir, safeName);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, buffer.subarray(dataOffset, dataOffset + uncompressedSize));
    } else if (compressionMethod === 8) {
      const filePath = path.join(destDir, safeName);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      // Guard against zip bombs: reject if uncompressed size exceeds 200 MB
      if (uncompressedSize > 200 * 1024 * 1024) {
        throw new DownloadError(`ZIP entry '${fileName}' declares ${uncompressedSize} byte(s) uncompressed — exceeds 200 MB limit`, archivePath);
      }
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      const decompressed = zlib.inflateRawSync(compressed);
      await fs.promises.writeFile(filePath, decompressed);
    }

    offset = dataOffset + compressedSize;
    entriesFound++;
  }

  if (entriesFound === 0) {
    throw new DownloadError('No valid ZIP entries found', archivePath);
  }
}
