import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CompileOptions, CompileResult, ResolvedAlias } from '@wasm-apps/types';
import { formatBytes } from '@wasm-apps/types';

let _cacheDir: string | undefined;

function getCacheDir(): string {
  if (!_cacheDir) {
    _cacheDir = path.join(process.cwd(), '.wapp_cache', 'compiler');
  }
  return _cacheDir;
}

function serializeAliases(aliases?: ResolvedAlias[]): string {
  if (!aliases || aliases.length === 0) return '';
  return JSON.stringify(
    aliases.map((a) => ({
      find: typeof a.find === 'string' ? a.find : a.find.source,
      replacement: a.replacement,
    })),
  );
}

/**
 * Calcula una clave de caché determinista a partir del código fuente + flags de compilación + aliases.
 * La clave es un resumen SHA-256 en hex de la representación canónica.
 */
export function computeKey(
  sourceCode: string,
  opts: Partial<Pick<CompileOptions, 'isDev' | 'sourceMap' | 'optimizeLevel' | 'shrinkLevel' | 'runtime' | 'aliases'>>,
): string {
  const sourceHash = crypto.createHash('sha256').update(sourceCode).digest('hex');
  const canonical = JSON.stringify({
    sourceHash,
    isDev: opts.isDev ?? true,
    sourceMap: opts.sourceMap ?? true,
    optimizeLevel: opts.optimizeLevel ?? 3,
    shrinkLevel: opts.shrinkLevel ?? 0,
    runtime: opts.runtime ?? 'incremental',
    aliases: serializeAliases(opts.aliases),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

interface CacheEntry {
  result: CompileResult;
}

/** Carga un resultado de compilación de la caché de disco. Retorna null si no existe o está corrupto. */
export function getCached(key: string): CompileResult | null {
  const dirPath = path.join(getCacheDir(), key);
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
  const dirPath = path.join(getCacheDir(), key);
  fs.mkdirSync(dirPath, { recursive: true });

  const { wasmBytes: _wasmBytes, ...resultMeta } = result;
  const meta: CacheEntry = { result: resultMeta as unknown as CompileResult };
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
  if (!fs.existsSync(getCacheDir())) return { exists: false, path: getCacheDir(), size: 0, humanSize: '0 B', entries: 0 };

  const entries = fs.readdirSync(getCacheDir());
  let sizeBytes = 0;
  for (const entry of entries) {
    const entryPath = path.join(getCacheDir(), entry);
    if (fs.statSync(entryPath).isDirectory()) {
      const files = fs.readdirSync(entryPath);
      for (const file of files) {
        sizeBytes += fs.statSync(path.join(entryPath, file)).size;
      }
    }
  }
  return { exists: true, path: getCacheDir(), size: sizeBytes, humanSize: formatBytes(sizeBytes), entries: entries.length };
}

/** Elimina una entrada específica de la caché de disco. */
export function deleteCacheEntry(key: string): void {
  const dirPath = path.join(getCacheDir(), key);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/** Elimina toda la caché de disco del compilador. */
export function clearCompileCache(): void {
  if (fs.existsSync(getCacheDir())) {
    fs.rmSync(getCacheDir(), { recursive: true, force: true });
  }
}
