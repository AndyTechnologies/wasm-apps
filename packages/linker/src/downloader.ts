import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { pipeline } from 'node:stream/promises';
import { logger, formatBytes, DownloadError } from '@wasm-apps/types';
import ora, { type Ora } from 'ora';

export interface DownloadOptions {
  ignoreCache?: boolean;
  label?: string;
  onProgress?: (received: number, total: number) => void;
}

export async function downloadFileWithResume(
  fileUrl: string,
  dest: string,
  options?: DownloadOptions,
): Promise<void> {
  const label = options?.label || 'Descargando';
  const spinner = ora({ text: label, color: 'cyan' }).start();

  try {
    await doDownload(fileUrl, dest, options, spinner);
    spinner.succeed(`${label} completada`);
  } catch (err) {
    spinner.fail(`${label} fallida`);
    throw err;
  }
}

async function doDownload(
  fileUrl: string,
  dest: string,
  options?: DownloadOptions,
  spinner?: Ora,
): Promise<void> {
  const partPath = dest + '.part';
  const ignoreCache = options?.ignoreCache ?? false;
  const onProgress = options?.onProgress;

  let startByte = 0;
  if (!ignoreCache && fs.existsSync(partPath)) {
    startByte = fs.statSync(partPath).size;
  }

  const isHttps = fileUrl.startsWith('https:');
  const protocol = isHttps ? https : http;

  await new Promise<void>((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const req = protocol.get(fileUrl, { headers }, async (response) => {
      const statusCode = response.statusCode!;

      if (statusCode >= 301 && statusCode <= 308) {
        const location = response.headers.location;
        if (!location) {
          reject(new DownloadError(`Redireccion sin Location`, fileUrl, statusCode));
          return;
        }
        response.destroy();
        if (fs.existsSync(partPath)) {
          fs.rmSync(partPath);
        }
        spinner!.text = `${options?.label || 'Descargando'} (redirigiendo...)`;
        resolve(doDownload(location, dest, options, spinner));
        return;
      }

      if (statusCode === 416) {
        if (fs.existsSync(partPath)) {
          fs.renameSync(partPath, dest);
        }
        resolve();
        return;
      }

      if (startByte > 0 && statusCode === 200) {
        startByte = 0;
        if (fs.existsSync(partPath)) {
          fs.unlinkSync(partPath);
        }
      }

      if (statusCode !== 200 && statusCode !== 206) {
        reject(new DownloadError(
          `Error HTTP ${statusCode}`,
          fileUrl,
          statusCode,
        ));
        return;
      }

      const totalContentLength = parseInt(response.headers['content-length'] || '0', 10);
      const totalBytes = startByte + totalContentLength;
      let received = startByte;

      const fileStream = fs.createWriteStream(partPath, startByte > 0 ? { flags: 'a' } : undefined);

      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (totalBytes > 0) {
          const pct = ((received / totalBytes) * 100).toFixed(1);
          spinner!.text = `${options?.label || 'Descargando'} ${pct}% (${formatBytes(received)} / ${formatBytes(totalBytes)})`;
        }
        onProgress?.(received, totalBytes || received);
      });

      try {
        await pipeline(response, fileStream);
        fs.renameSync(partPath, dest);
        resolve();
      } catch (err: any) {
        fileStream.destroy();
        if (fs.existsSync(partPath)) {
          const partial = fs.statSync(partPath).size;
          if (partial > 0) {
            logger.warn(`Descarga interrumpida, parcial guardado (${partial} bytes). Reanudara en el proximo intento.`);
          }
        }
        reject(new DownloadError(
          `Error de red: ${err.message}`,
          fileUrl,
          undefined,
          err,
        ));
      }
    });

    req.on('error', (err) => {
      reject(new DownloadError(
        `Error de conexion: ${err.message}`,
        fileUrl,
        undefined,
        err,
      ));
    });

    req.end();
  });
}
