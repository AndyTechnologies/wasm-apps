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
export function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total?: number) => void, expectedHash?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const get = parsedUrl.protocol === 'https:' ? httpsGet : httpGet;

    const startByte = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
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

      if (statusCode >= 400) {
        reject(new DownloadError(`HTTP ${statusCode}`, url, statusCode));
        return;
      }

      // Si el servidor no soporta Range (200 en vez de 206), descarta los datos parciales
      const useRange = startByte > 0 && statusCode === 206;
      const stream = openStream(useRange);

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
