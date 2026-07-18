import fs from 'node:fs';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import crypto from 'node:crypto';
import { DownloadError } from '@wasm-apps/types';

/**
 * Descarga un archivo desde una URL HTTP/HTTPS con reanudación (resume) parcial.
 *
 * Soporta el header Range para reanudar descargas interrumpidas.
 * Escribe el contenido directamente en el path de destino.
 *
 * @param url - URL del archivo a descargar
 * @param destPath - Ruta local donde guardar
 * @param onProgress - Callback con bytes descargados y total (si se conoce)
 * @param expectedHash - Hash SHA-256 esperado para verificación de integridad
 */
function doDownload(
  url: string,
  destPath: string,
  onProgress?: (downloaded: number, total?: number) => void,
  expectedHash?: string,
  startByte?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const get = parsedUrl.protocol === 'https:' ? httpsGet : httpGet;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: startByte && startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
    };

    const hash = crypto.createHash('sha256');
    let fileStream: fs.WriteStream | null = null;

    function openStream(append: boolean): fs.WriteStream {
      const stream = fs.createWriteStream(destPath, { flags: append ? 'a' : 'w' });
      fileStream = stream;
      return stream;
    }

    get(options, (response) => {
      const statusCode = response.statusCode || 0;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).toString();
        resolve(doDownload(redirectUrl, destPath, onProgress, expectedHash, undefined));
        return;
      }

      if (statusCode >= 400) {
        reject(new DownloadError(`HTTP ${statusCode}`, url, statusCode));
        return;
      }

      const useRange = startByte && startByte > 0 && statusCode === 206;
      const stream = openStream(!!useRange);

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = useRange ? startByte : 0;

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        hash.update(chunk);
        onProgress?.(downloaded, totalSize > 0 ? (useRange ? totalSize + startByte : totalSize) : undefined);
      });

      response.pipe(stream);

      stream.on('finish', () => {
        stream.close();
        if (expectedHash) {
          const actualHash = hash.digest('hex');
          if (actualHash !== expectedHash) {
            reject(new DownloadError(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`, url));
            return;
          }
        }
        resolve();
      });
    }).on('error', (err) => {
      if (fileStream) fileStream.close();
      reject(new DownloadError(`Download failed: ${err.message}`, url, undefined, err));
    });
  });
}

export function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total?: number) => void, expectedHash?: string): Promise<void> {
  const startByte = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
  return doDownload(url, destPath, onProgress, expectedHash, startByte);
}
