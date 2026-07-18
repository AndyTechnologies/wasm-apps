import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { formatBytes } from '@wasm-apps/types';

function pathsEqual(a: string, b: string): boolean {
  const resolvedA = path.resolve(a);
  const resolvedB = path.resolve(b);
  if (process.platform === 'win32') {
    return resolvedA.toLowerCase() === resolvedB.toLowerCase();
  }
  return resolvedA === resolvedB;
}

function normalizeOutput(output: string): string {
  if (process.platform === 'win32' && !output.toLowerCase().endsWith('.exe')) {
    return output + '.exe';
  }
  return output;
}

const BUILD_DIR_NAME = '.wapp_build';
const MANIFEST_FILE = 'build-manifest.json';

interface BuildManifestFile {
  path: string;
  contentHash: string;
}

interface BuildManifestOptions {
  entry: string;
  target: string;
  wasi: boolean;
  moduleMatching: string;
  wasmtimePath: string;
  wasmtimeVersion: string;
}

interface BuildManifest {
  version: 1;
  wasmFiles: BuildManifestFile[];
  options: BuildManifestOptions;
  outputHash: string;
  createdAt: string;
}

function getBuildDir(rootDir?: string): string {
  const base = rootDir || process.cwd();
  return path.join(base, BUILD_DIR_NAME);
}

function getManifestPath(rootDir?: string): string {
  return path.join(getBuildDir(rootDir), MANIFEST_FILE);
}

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function loadManifest(rootDir?: string): BuildManifest | null {
  const mPath = getManifestPath(rootDir);
  if (!fs.existsSync(mPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(mPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveManifest(manifest: BuildManifest, rootDir?: string): void {
  const buildDir = getBuildDir(rootDir);
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  fs.writeFileSync(getManifestPath(rootDir), JSON.stringify(manifest, null, 2) + os.EOL, 'utf-8');
}

/**
 * Comprueba si el build está actualizado comparando los archivos WASM, salida y opciones
 * contra el manifiesto de build almacenado.
 */
export async function isBuildUpToDate(
  wasmFiles: string[],
  output: string,
  options: {
    entry: string;
    target?: string;
    wasi: boolean;
    moduleMatching: string;
    wasmtimePath?: string;
    wasmtimeVersion: string;
  },
  rootDir?: string,
): Promise<boolean> {
  output = normalizeOutput(output);
  if (!fs.existsSync(output)) return false;

  const manifest = loadManifest(rootDir);
  if (!manifest) return false;
  if (manifest.version !== 1) return false;

  if (manifest.options.entry !== options.entry) return false;
  if (manifest.options.target !== (options.target || '')) return false;
  if (manifest.options.wasi !== options.wasi) return false;
  if (manifest.options.moduleMatching !== options.moduleMatching) return false;
  if (manifest.options.wasmtimePath !== (options.wasmtimePath || '')) return false;
  if (manifest.options.wasmtimeVersion !== options.wasmtimeVersion) return false;

  if (manifest.wasmFiles.length !== wasmFiles.length) return false;
  for (let i = 0; i < wasmFiles.length; i++) {
    if (!pathsEqual(manifest.wasmFiles[i].path, wasmFiles[i])) return false;
    if (manifest.wasmFiles[i].contentHash !== fileHash(wasmFiles[i])) return false;
  }

  const outputHash = fileHash(output);
  if (manifest.outputHash !== outputHash) return false;

  return true;
}

/**
 * Guarda el manifiesto de build en disco para futuras comprobaciones de build incremental.
 */
export function saveBuildManifest(
  wasmFiles: string[],
  output: string,
  options: {
    entry: string;
    target?: string;
    wasi: boolean;
    moduleMatching: string;
    wasmtimePath?: string;
    wasmtimeVersion: string;
  },
  rootDir?: string,
): void {
  output = normalizeOutput(output);
  const wasmEntries = wasmFiles.map((f) => ({
    path: path.resolve(f),
    contentHash: fileHash(f),
  }));

  const manifest: BuildManifest = {
    version: 1,
    wasmFiles: wasmEntries,
    options: {
      entry: options.entry,
      target: options.target || '',
      wasi: options.wasi,
      moduleMatching: options.moduleMatching,
      wasmtimePath: options.wasmtimePath || '',
      wasmtimeVersion: options.wasmtimeVersion,
    },
    outputHash: fileHash(output),
    createdAt: new Date().toISOString(),
  };

  saveManifest(manifest, rootDir);
}

/** Retorna información de la caché de build: ruta, tamaño y número de entradas. */
export function getBuildCacheInfo(rootDir?: string): { path: string; exists: boolean; size: number; humanSize: string; entries: number } {
  const dir = getBuildDir(rootDir);
  if (!fs.existsSync(dir)) {
    return { path: dir, exists: false, size: 0, humanSize: '0 B', entries: 0 };
  }

  let totalSize = 0;
  let fileCount = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        totalSize += dirSize(fullPath);
      } else if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
        fileCount++;
      }
    }
  } catch {
    // ignorar
  }

  return {
    path: dir,
    exists: true,
    size: totalSize,
    humanSize: formatBytes(totalSize),
    entries: fileCount,
  };
}

/** Elimina el directorio de build y su contenido. */
export function clearBuildCache(rootDir?: string): void {
  const dir = getBuildDir(rootDir);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function dirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += dirSize(fullPath);
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // saltar inaccesibles
  }
  return size;
}
