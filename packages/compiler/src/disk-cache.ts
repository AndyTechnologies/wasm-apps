import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';
import { formatBytes } from '@wasm-apps/types';

const CACHE_DIR = path.join(process.cwd(), '.wapp_cache', 'compiler');

/**
 * Calcula una clave de caché determinista a partir del código fuente + flags de compilación.
 * La clave es un resumen SHA-256 en hex de la representación canónica.
 */
export function computeKey(
  sourceCode: string,
  opts: Partial<Pick<CompileOptions, 'isDev' | 'sourceMap' | 'optimizeLevel' | 'shrinkLevel' | 'runtime'>>,
): string {
  const canonical = JSON.stringify({
    sourceCode,
    isDev: opts.isDev ?? true,
    sourceMap: opts.sourceMap ?? true,
    optimizeLevel: opts.optimizeLevel ?? 3,
    shrinkLevel: opts.shrinkLevel ?? 0,
    runtime: opts.runtime ?? 'incremental',
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

interface CacheEntry {
  result: CompileResult;
}

/** Carga un resultado de compilación de la caché de disco. Retorna null si no existe o está corrupto. */
export function getCached(key: string): CompileResult | null {
  const dirPath = path.join(CACHE_DIR, key);
  const metaPath = path.join(dirPath, 'result.json');
  const wasmPath = path.join(dirPath, 'out.wasm');
  const dtsPath = path.join(dirPath, 'out.d.ts');
  const bindingsPath = path.join(dirPath, 'out.js');
  const mapPath = path.join(dirPath, 'out.wasm.map');

  if (!fs.existsSync(metaPath) || !fs.existsSync(wasmPath) || !fs.existsSync(dtsPath) || !fs.existsSync(bindingsPath)) {
    return null;
  }

  try {
    const meta: CacheEntry = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const wasmBytes = fs.readFileSync(wasmPath);
    const dtsContent = fs.readFileSync(dtsPath, 'utf-8');
    const bindingsJs = fs.readFileSync(bindingsPath, 'utf-8');
    const sourceMap = fs.existsSync(mapPath) ? fs.readFileSync(mapPath, 'utf-8') : undefined;

    return {
      ...meta.result,
      wasmBytes: new Uint8Array(wasmBytes),
      dtsContent,
      bindingsJs,
      sourceMap,
    };
  } catch {
    return null;
  }
}

/** Persiste un resultado de compilación en la caché de disco. */
export function saveToCache(key: string, result: CompileResult): void {
  const dirPath = path.join(CACHE_DIR, key);
  fs.mkdirSync(dirPath, { recursive: true });

  const meta: CacheEntry = { result: { ...result, wasmBytes: undefined! } };
  fs.writeFileSync(path.join(dirPath, 'result.json'), JSON.stringify(meta));
  fs.writeFileSync(path.join(dirPath, 'out.wasm'), Buffer.from(result.wasmBytes));
  fs.writeFileSync(path.join(dirPath, 'out.d.ts'), result.dtsContent);
  fs.writeFileSync(path.join(dirPath, 'out.js'), result.bindingsJs);
  if (result.sourceMap) {
    fs.writeFileSync(path.join(dirPath, 'out.wasm.map'), result.sourceMap);
  }
}

interface CompileCacheInfo {
  exists: boolean;
  path: string;
  size: number;
  humanSize: string;
  entries: number;
}

/** Retorna estadísticas de uso de la caché: número de entradas y tamaño total en disco. */
export function getCompileCacheInfo(): CompileCacheInfo {
  if (!fs.existsSync(CACHE_DIR)) return { exists: false, path: CACHE_DIR, size: 0, humanSize: '0 B', entries: 0 };

  const entries = fs.readdirSync(CACHE_DIR);
  let sizeBytes = 0;
  for (const entry of entries) {
    const entryPath = path.join(CACHE_DIR, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      const files = fs.readdirSync(entryPath);
      for (const file of files) {
        sizeBytes += fs.statSync(path.join(entryPath, file)).size;
      }
    }
  }
  return { exists: true, path: CACHE_DIR, size: sizeBytes, humanSize: formatBytes(sizeBytes), entries: entries.length };
}

/** Elimina toda la caché de disco del compilador. */
export function clearCompileCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}
