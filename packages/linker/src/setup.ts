import { logger } from '@wasm-apps/types';
import { ensureWasmtimeAvailable, getWasmtimeCachedPaths, wasmtimeDownloadInfo } from './wasmtime-dl.js';
import { clearCache, getCacheInfo } from './cache.js';
import type { DownloadOptions } from './downloader.js';

export interface SetupOptions {
  ignoreCache?: boolean;
}

export interface SetupStatus {
  wasmtime: { status: 'ok' | 'missing' | 'error'; path?: string; error?: string };
  cacheSize: string;
}

export async function runSetup(options?: SetupOptions): Promise<void> {
  const ignoreCache = options?.ignoreCache ?? false;

  if (ignoreCache) {
    logger.info('Ignorando cache existente, forzando descarga...');
    await clearCache();
  }

  const cachedWt = getWasmtimeCachedPaths();
  if (cachedWt && !ignoreCache) {
    logger.success(`Wasmtime: ${cachedWt.libPath} — OK`);
  } else {
    const info = wasmtimeDownloadInfo();
    logger.step(`Descargando Wasmtime ${info.version}...`);

    const dlOpts: DownloadOptions = {
      ignoreCache,
      label: 'Wasmtime',
    };

    try {
      const paths = await ensureWasmtimeAvailable(dlOpts);
      logger.success(`Wasmtime: ${paths.libPath} — OK`);
    } catch (err: any) {
      const msg = err.cause ? `${err.message} (causa: ${err.cause.message})` : err.message;
      logger.error(`Wasmtime: ERROR — ${msg}`);
      if (err.statusCode) {
        logger.error(`URL: ${err.url}`);
        if (err.statusCode === 302) {
          logger.warn('Sugerencia: Puede haber una redireccion no seguida automaticamente.');
        }
      }
      throw err;
    }
  }

  logger.success('Setup completado.');
}

export async function checkSetupStatus(): Promise<SetupStatus> {
  const cachedWt = getWasmtimeCachedPaths();

  const wtStatus: SetupStatus['wasmtime'] = cachedWt
    ? { status: 'ok', path: cachedWt.libPath }
    : { status: 'missing' };

  const info = await getCacheInfo();

  return { wasmtime: wtStatus, cacheSize: info.humanSize };
}
