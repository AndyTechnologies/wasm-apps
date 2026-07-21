import fs from 'node:fs';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import crypto from 'node:crypto';
import { DownloadError } from '@wasm-apps/types';

/** Check if a hostname belongs to the same base domain (exact or subdomain). */
function isSameBaseDomain(hostname: string, baseHostname: string): boolean {
  if (hostname === baseHostname) return true;
  if (hostname.endsWith('.' + baseHostname)) return true;
  return false;
}

function doDownload(
  url: string,
  destPath: string,
  onProgress?: (downloaded: number, total?: number) => void,
  expectedHash?: string,
  startByte?: number,
  expectedTotal?: number,
  redirectCount?: number,
  originalHostname?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      reject(new DownloadError(`Invalid URL: ${url}`, url, undefined, err as Error));
      return;
    }
    const get = parsedUrl.protocol === 'https:' ? httpsGet : httpGet;
    const currentRedirectCount = redirectCount ?? 0;
    const baseDomain = originalHostname ?? parsedUrl.hostname;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: 30000,
      headers: startByte && startByte > 0 ? { Range: `bytes=${startByte}-` } : {},
    };

    const hash = crypto.createHash('sha256');
    let fileStream: fs.WriteStream | null = null;

    function openStream(append: boolean): fs.WriteStream {
      const stream = fs.createWriteStream(destPath, { flags: append ? 'a' : 'w' });
      fileStream = stream;
      return stream;
    }

    const req = get(options, (response) => {
      const statusCode = response.statusCode || 0;

      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        req.destroy();
        if (currentRedirectCount >= 5) {
          reject(new DownloadError(`Too many redirects (${currentRedirectCount})`, url));
          return;
        }
        const redirectUrlObj = new URL(response.headers.location, url);
        if (!isSameBaseDomain(redirectUrlObj.hostname, baseDomain)) {
          reject(new DownloadError(`Redirect to different domain rejected: ${redirectUrlObj.hostname} (base: ${baseDomain})`, url));
          return;
        }
        const redirectUrlStr = redirectUrlObj.toString();
        resolve(doDownload(redirectUrlStr, destPath, onProgress, expectedHash, undefined, expectedTotal, currentRedirectCount + 1, baseDomain));
        return;
      }

      if (statusCode >= 400) {
        req.destroy();
        reject(new DownloadError(`HTTP ${statusCode}`, url, statusCode));
        return;
      }

      const serverTotal = parseInt(response.headers['content-length'] || '0', 10);

      if (startByte && startByte > 0) {
        if (statusCode === 206 && expectedTotal && serverTotal > 0) {
          const expectedRemaining = expectedTotal - startByte;
          if (serverTotal !== expectedRemaining) {
            fs.rmSync(destPath, { force: true });
            resolve(doDownload(url, destPath, onProgress, expectedHash, 0, expectedTotal));
            return;
          }
        } else if (statusCode !== 206) {
          fs.rmSync(destPath, { force: true });
          resolve(doDownload(url, destPath, onProgress, expectedHash, 0, expectedTotal));
          return;
        }
      }

      const useRange = !!(startByte && startByte > 0 && statusCode === 206);
      const stream = openStream(!!useRange);
      const totalSize = serverTotal;
      let downloaded = useRange ? startByte : 0;

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        hash.update(chunk);
        onProgress?.(downloaded, totalSize > 0 ? (useRange ? totalSize + startByte : totalSize) : undefined);
      });

      response.on('error', (err) => {
        fs.rmSync(destPath, { force: true });
        reject(new DownloadError(`Response error: ${err.message}`, url, undefined, err));
      });

      response.pipe(stream);

      stream.on('error', (err) => {
        fs.rmSync(destPath, { force: true });
        reject(new DownloadError(`Write failed: ${err.message}`, url, undefined, err));
      });

      stream.on('finish', () => {
        stream.close();
        if (expectedHash) {
          const actualHash = hash.digest('hex');
          if (actualHash !== expectedHash) {
            fs.rmSync(destPath, { force: true });
            reject(new DownloadError(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`, url));
            return;
          }
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      if (fileStream) {
        fileStream.close();
        fs.rmSync(destPath, { force: true });
      }
      reject(new DownloadError(`Download failed: ${err.message}`, url, undefined, err));
    });
  });
}

export function downloadFile(url: string, destPath: string, onProgress?: (downloaded: number, total?: number) => void, expectedHash?: string): Promise<void> {
  let startByte = 0;
  try {
    startByte = fs.statSync(destPath).size;
  } catch {}
  const expectedTotal = startByte > 0 ? startByte : undefined;

  if (startByte > 0) {
    const headUrl = new URL(url);
    const get = headUrl.protocol === 'https:' ? httpsGet : httpGet;

    return new Promise<void>((resolve, reject) => {
      const headReq = get(headUrl, (res) => {
        const serverSize = parseInt(res.headers['content-length'] || '0', 10);
        res.resume();

        if (serverSize > 0 && startByte >= serverSize) {
          fs.rmSync(destPath, { force: true });
          resolve(doDownload(url, destPath, onProgress, expectedHash, 0));
        } else if (serverSize > 0 && startByte < serverSize && res.headers['accept-ranges'] === 'bytes') {
          resolve(doDownload(url, destPath, onProgress, expectedHash, startByte, serverSize));
        } else {
          fs.rmSync(destPath, { force: true });
          resolve(doDownload(url, destPath, onProgress, expectedHash, 0));
        }
      });

      headReq.on('error', () => {
        fs.rmSync(destPath, { force: true });
        resolve(doDownload(url, destPath, onProgress, expectedHash, 0));
      });

      headReq.end();
    });
  }

  return doDownload(url, destPath, onProgress, expectedHash, 0);
}
