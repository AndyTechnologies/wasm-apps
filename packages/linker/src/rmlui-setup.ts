import path from 'node:path';
import fs from 'node:fs';
import { getRmluiCacheDir, getRmluiAssets } from './rmlui-dl.js';
import { downloadFile } from './downloader.js';
import { extractArchive } from './extract.js';
import { logger } from '@wasm-apps/types';
import { CacheManager } from './cache.js';

const RMLUI_VERSION = '1.0.0';

/**
 * Instala/actualiza las dependencias de RmlUI (SDL3, RmlUI, GLAD) en el caché global.
 *
 * Pipeline:
 * 1. Busca en caché (~/.wasm-linker/rmlui/) si ya están descargadas
 * 2. Si no, descarga los assets correspondientes a la plataforma
 * 3. Extrae los archivos
 * 4. Verifica que los encabezados existan
 *
 * NOTA: Implementación placeholder — las URLs de descarga son tentativas.
 * Cuando las pre-built libs sean publicadas, se activará la descarga real.
 *
 * @param ignoreCache - Si true, ignora la caché y fuerza descarga completa
 */
export async function setupRmlui(ignoreCache?: boolean): Promise<void> {
  const cacheDir = getRmluiCacheDir();
  const cache = new CacheManager(cacheDir);

  if (ignoreCache) {
    cache.clear();
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  const assets = getRmluiAssets(RMLUI_VERSION);

  for (const [name, asset] of Object.entries(assets)) {
    const archivePath = path.join(cacheDir, asset.fileName);

    if (fs.existsSync(archivePath)) {
      logger.detail(`RmlUI dependency ${name} already cached: ${asset.fileName}`);
      continue;
    }

    logger.step(`Downloading ${name} ${RMLUI_VERSION}...`);
    try {
      await downloadFile(asset.url, archivePath, (downloaded, total) => {
        if (total) {
          const pct = ((downloaded / total) * 100).toFixed(0);
          logger.detail(`  ${downloaded}/${total} bytes (${pct}%)`);
        }
      });
    } catch (err: unknown) {
      logger.warn(`Download failed for ${name} (${asset.url}): ${(err as Error).message}`);
      logger.warn('Skipping — RmlUI dependencies will need manual setup when pre-built libs are published.');
      continue;
    }

    logger.step(`Extracting ${name}...`);
    try {
      await extractArchive(archivePath, cacheDir);
    } catch (err: unknown) {
      logger.warn(`Extraction failed for ${name}: ${(err as Error).message}`);
      continue;
    }
  }

  logger.detail('RmlUI dependencies setup — placeholder. Pre-built libs TBD.');
}
