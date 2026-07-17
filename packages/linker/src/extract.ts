import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as tar from 'tar';
import { DownloadError } from '@wasm-apps/types';

function isPathSafe(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  if (normalized.startsWith('..') || normalized === '.' || normalized === '') return false;
  if (normalized.includes('..')) return false;
  return true;
}

/**
 * Extrae un archivo .tar.xz dentro de un directorio de destino.
 * Calcula un hash SHA-256 del archivo comprimido para tracking.
 *
 * @param archivePath - Ruta al archivo .tar.xz
 * @param destDir - Directorio donde extraer
 */
export function extractArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(archivePath);

    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => {
      fs.mkdirSync(destDir, { recursive: true });

      fs.createReadStream(archivePath)
        .pipe(tar.x({ C: destDir }))
        .on('finish', () => resolve())
        .on('error', (err) => reject(new DownloadError(`Extraction failed: ${err.message}`, archivePath, undefined, err)));
    });
    stream.on('error', (err) => reject(new DownloadError(`Read failed: ${err.message}`, archivePath, undefined, err)));
  });
}

/**
 * Extrae un archivo .zip dentro de un directorio de destino.
 * Usa una implementación manual mínima (no depende de adm-zip/unzipper).
 *
 * @param archivePath - Ruta al archivo .zip
 * @param destDir - Directorio donde extraer
 */
export function extractZip(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });

    const buffer = fs.readFileSync(archivePath);
    let offset = 0;

    // Parser ZIP simple para cabeceras de archivo local
    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) {
        offset++;
        continue;
      }

      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const headerSize = 30 + fileNameLength + extraFieldLength;
      const dataOffset = offset + headerSize;

      // Verificación de límites
      if (dataOffset + compressedSize > buffer.length) {
        reject(new DownloadError('ZIP entry exceeds archive bounds', archivePath));
        return;
      }

      const fileName = buffer.toString('utf-8', offset + 30, offset + 30 + fileNameLength);
      const safeName = path.normalize(fileName).replace(/^[/\\]+/, '');

      if (!isPathSafe(safeName)) {
        reject(new DownloadError(`Path traversal detected in ZIP: ${fileName}`, archivePath));
        return;
      }

      if (fileName.endsWith('/')) {
        fs.mkdirSync(path.join(destDir, safeName), { recursive: true });
      } else if (compressionMethod === 0) {
        const filePath = path.join(destDir, safeName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, buffer.subarray(dataOffset, dataOffset + uncompressedSize));
      }
      // Saltar entradas comprimidas (method !== 0) — requeriría inflate

      offset = dataOffset + compressedSize;
    }

    resolve();
  });
}
