import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatBytes } from '@wasm-apps/types';

export interface CacheSummary {
  sizeBytes: number;
  fileCount: number;
}

export interface CacheInfo {
  exists: boolean;
  path: string;
  size: number;
  humanSize: string;
  entries: string[];
}

/**
 * Gestiona la caché global de descargas en ~/.wasm-linker/.
 *
 * Almacena los archivos descargados (Wasmtime C-API tar.xz/zip)
 * y los directorios extraídos.
 */
export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  exists(): boolean {
    return fs.existsSync(this.cacheDir);
  }

  summarize(): CacheSummary {
    if (!this.exists()) return { sizeBytes: 0, fileCount: 0 };

    let sizeBytes = 0;
    let fileCount = 0;

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          sizeBytes += stat.size;
          fileCount++;
        }
      }
    };

    walk(this.cacheDir);
    return { sizeBytes, fileCount };
  }

  clear(): void {
    if (this.exists()) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }
  }
}

const cacheDir = path.join(os.homedir(), '.wasm-linker');
const manager = new CacheManager(cacheDir);

/** Retorna información detallada sobre la caché de descargas. */
export async function getCacheInfo(): Promise<CacheInfo> {
  const summary = manager.summarize();
  return {
    exists: manager.exists(),
    path: cacheDir,
    size: summary.sizeBytes,
    humanSize: formatBytes(summary.sizeBytes),
    entries: fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [],
  };
}

/** Limpia toda la caché de descargas. */
export async function clearCache(): Promise<void> {
  manager.clear();
}
