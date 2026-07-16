import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { CompileOptions, CompileResult } from '@wasm-apps/types';

const CACHE_DIR_NAME = '.wapp_cache';
const COMPILER_CACHE_NAME = 'compiler';

function getCacheDirPath(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, CACHE_DIR_NAME, COMPILER_CACHE_NAME);
}

function ensureCacheDir(rootDir?: string): string {
  const dir = getCacheDirPath(rootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCacheDir(rootDir?: string): string {
  return getCacheDirPath(rootDir);
}

export function computeKey(sourceCode: string, options: CompileOptions): string {
  const data = JSON.stringify({
    s: sourceCode,
    r: options.runtime,
    d: options.isDev,
    m: options.sourceMap,
    o: options.optimizeLevel,
    h: options.shrinkLevel,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

interface CacheMetadata {
  hash: string;
  dependencies: string[];
  hasSourceMap: boolean;
  timestamp: number;
}

export function getCached(key: string, rootDir?: string): CompileResult | null {
  const entryDir = path.join(getCacheDirPath(rootDir), key);
  const metaPath = path.join(entryDir, 'result.json');
  const wasmPath = path.join(entryDir, 'out.wasm');
  const dtsPath = path.join(entryDir, 'out.d.ts');
  const jsPath = path.join(entryDir, 'out.js');

  if (!fs.existsSync(metaPath) || !fs.existsSync(wasmPath) || !fs.existsSync(dtsPath) || !fs.existsSync(jsPath)) {
    return null;
  }

  try {
    const meta: CacheMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const wasmBytes = fs.readFileSync(wasmPath);
    const dtsContent = fs.readFileSync(dtsPath, 'utf-8');
    const bindingsJs = fs.readFileSync(jsPath, 'utf-8');

    let sourceMap: string | undefined;
    if (meta.hasSourceMap) {
      const mapPath = path.join(entryDir, 'out.wasm.map');
      if (fs.existsSync(mapPath)) {
        sourceMap = fs.readFileSync(mapPath, 'utf-8');
      }
    }

    return {
      wasmBytes: new Uint8Array(wasmBytes),
      dtsContent,
      bindingsJs,
      sourceMap,
      dependencies: meta.dependencies,
      hash: meta.hash,
    };
  } catch {
    return null;
  }
}

export function saveToCache(key: string, result: CompileResult, rootDir?: string): void {
  const entryDir = path.join(ensureCacheDir(rootDir), key);
  if (!fs.existsSync(entryDir)) {
    fs.mkdirSync(entryDir, { recursive: true });
  }

  const meta: CacheMetadata = {
    hash: result.hash,
    dependencies: result.dependencies,
    hasSourceMap: !!result.sourceMap,
    timestamp: Date.now(),
  };

  fs.writeFileSync(path.join(entryDir, 'result.json'), JSON.stringify(meta, null, 2), 'utf-8');
  fs.writeFileSync(path.join(entryDir, 'out.wasm'), Buffer.from(result.wasmBytes));
  fs.writeFileSync(path.join(entryDir, 'out.d.ts'), result.dtsContent, 'utf-8');
  fs.writeFileSync(path.join(entryDir, 'out.js'), result.bindingsJs, 'utf-8');

  if (result.sourceMap) {
    fs.writeFileSync(path.join(entryDir, 'out.wasm.map'), result.sourceMap, 'utf-8');
  }
}

export function getCompileCacheInfo(rootDir?: string): { path: string; exists: boolean; size: number; humanSize: string; entries: number } {
  const dir = getCacheDirPath(rootDir);
  const exists = fs.existsSync(dir);

  if (!exists) {
    return { path: dir, exists: false, size: 0, humanSize: '0 B', entries: 0 };
  }

  let totalSize = 0;
  let entryCount = 0;

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        entryCount++;
        totalSize += getDirSize(fullPath);
      }
    }
  } catch {
    // ignore
  }

  return {
    path: dir,
    exists: true,
    size: totalSize,
    humanSize: formatBytes(totalSize),
    entries: entryCount,
  };
}

export function clearCompileCache(rootDir?: string): void {
  const dir = getCacheDirPath(rootDir);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // skip inaccessible
  }
  return size;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
