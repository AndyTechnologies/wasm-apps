import path from 'node:path';
import fs from 'node:fs';
import { getWasmtimeAsset, getWasmtimeCacheDir, getWasmtimeIncludeDir } from './wasmtime-dl.js';
import { downloadFile } from './downloader.js';
import { extractArchive } from './extract.js';
import { logger } from '@wasm-apps/types';
import { CacheManager, getCacheInfo } from './cache.js';

const WASMTIME_VERSION = '46.0.1';

/**
 * Instala/actualiza Wasmtime C-API en el caché global.
 *
 * Pipeline:
 * 1. Busca en caché (~/.wasm-linker/) si ya está descargado
 * 2. Si no, descarga el asset correspondiente a la plataforma
 * 3. Extrae tar.xz o zip
 * 4. Verifica que include/wasmtime.h exista
 *
 * @param wasmtimePath - Ruta personalizada (opcional, salta descarga)
 * @param ignoreCache - Si true, ignora la caché y fuerza descarga completa
 */
export async function setupWasmtime(wasmtimePath?: string, ignoreCache?: boolean): Promise<void> {
  if (wasmtimePath) {
    const headerPath = path.join(wasmtimePath, 'include', 'wasmtime.h');
    if (fs.existsSync(headerPath)) {
      logger.success(`Using custom Wasmtime path: ${wasmtimePath}`);
      return;
    }
    logger.warn(`Custom Wasmtime path ${wasmtimePath} does not contain wasmtime.h. Will download.`);
  }

  const cacheDir = getWasmtimeCacheDir();
  const cache = new CacheManager(cacheDir);

  if (ignoreCache) {
    cache.clear();
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const { url, fileName } = getWasmtimeAsset(WASMTIME_VERSION);
  const archivePath = path.join(cacheDir, fileName);

  if (fs.existsSync(archivePath)) {
    const includeDir = getWasmtimeIncludeDir(cacheDir, WASMTIME_VERSION);
    if (fs.existsSync(path.join(includeDir, 'wasmtime.h'))) {
      logger.success('Wasmtime C-API already cached');
      return;
    }
  }

  logger.step(`Downloading Wasmtime ${WASMTIME_VERSION}...`);
  await downloadFile(url, archivePath, (downloaded, total) => {
    if (total) {
      const pct = ((downloaded / total) * 100).toFixed(0);
      logger.detail(`  ${downloaded}/${total} bytes (${pct}%)`);
    }
  });

  logger.step('Extracting Wasmtime C-API...');
  await extractArchive(archivePath, cacheDir);

  logger.success('Wasmtime C-API setup complete');
}

/** Alias para setupWasmtime, mantenido para compatibilidad hacia atrás con el CLI. */
export async function runSetup(options?: { ignoreCache?: boolean }): Promise<void> {
  await setupWasmtime(undefined, options?.ignoreCache);
}

/** Verifica si Wasmtime C-API está instalado correctamente. */
export function checkWasmtimeSetup(wasmtimePath?: string): boolean {
  if (wasmtimePath) {
    return fs.existsSync(path.join(wasmtimePath, 'include', 'wasmtime.h'));
  }

  const cacheDir = getWasmtimeCacheDir();
  const includeDir = getWasmtimeIncludeDir(cacheDir, WASMTIME_VERSION);
  return fs.existsSync(path.join(includeDir, 'wasmtime.h'));
}

/**
 * Retorna el estado de instalación de todas las dependencias (para el comando status del CLI).
 * Retorna un objeto con estado de wasmtime, ruta, error y tamaño de caché.
 */
export async function checkSetupStatus(): Promise<{
  wasmtime: { status: string; path?: string; error?: string };
  cacheSize: string;
}> {
  const cacheInfo = await getCacheInfo();
  return {
    wasmtime: {
      status: checkWasmtimeSetup() ? 'ok' : 'missing',
      path: cacheInfo.path,
    },
    cacheSize: cacheInfo.humanSize,
  };
}
