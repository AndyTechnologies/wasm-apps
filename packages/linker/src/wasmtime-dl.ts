import os from 'os';
import path from 'path';
import fs from 'fs';
import { downloadFileWithResume } from './downloader.js';
import type { DownloadOptions } from './downloader.js';
import { extract } from './extract.js';

export const WASMTIME_VERSION = process.env.WASMTIME_VERSION || '46.0.1';
const WASMTIME_BASE_URL = `https://github.com/bytecodealliance/wasmtime/releases/download/v${WASMTIME_VERSION}`;

function getPlatformSuffix(): string {
  const plat = os.platform();
  const arch = os.arch();
  if (plat === 'linux' && arch === 'x64') return 'x86_64-linux';
  if (plat === 'linux' && arch === 'arm64') return 'aarch64-linux';
  if (plat === 'darwin' && arch === 'x64') return 'x86_64-macos';
  if (plat === 'darwin' && arch === 'arm64') return 'aarch64-macos';
  if (plat === 'win32' && arch === 'x64') return 'x86_64-windows';
  throw new Error(`Plataforma no soportada para Wasmtime: ${plat}-${arch}`);
}

function wasmtimeCacheDir(): string {
  const newDir = path.join(os.homedir(), '.wasm-linker', 'wasmtime', WASMTIME_VERSION);
  const oldDir = path.join(os.homedir(), '.wapp', 'wasmtime', WASMTIME_VERSION);
  if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) {
    return oldDir;
  }
  return newDir;
}

export interface WasmtimePaths {
  includeDir: string;
  libPath: string;
}

export function wasmtimeDownloadInfo(): { version: string; url: string; fileName: string } {
  const suffix = getPlatformSuffix();
  const ext = os.platform() === 'win32' ? 'zip' : 'tar.xz';
  const fileName = `wasmtime-v${WASMTIME_VERSION}-${suffix}-c-api.${ext}`;
  const url = `${WASMTIME_BASE_URL}/${fileName}`;
  return { version: WASMTIME_VERSION, url, fileName };
}

export function getWasmtimeCachedPaths(): WasmtimePaths | null {
  const cacheDir = wasmtimeCacheDir();
  const includeDir = path.join(cacheDir, 'include');
  const libDir = path.join(cacheDir, 'lib');
  const libName = os.platform() === 'win32' ? 'wasmtime.lib' : 'libwasmtime.a';
  const libPath = path.join(libDir, libName);

  if (fs.existsSync(includeDir)) {
    if (fs.existsSync(libPath)) {
      return { includeDir, libPath };
    }
    if (fs.existsSync(libDir)) {
      const found = fs.readdirSync(libDir).filter(f => f.endsWith('.a') || f.endsWith('.lib'));
      if (found.length > 0) {
        return { includeDir, libPath: path.join(libDir, found[0]) };
      }
    }
  }

  return null;
}

export async function ensureWasmtimeAvailable(dlOpts?: DownloadOptions): Promise<WasmtimePaths> {
  const cached = getWasmtimeCachedPaths();
  if (cached && !dlOpts?.ignoreCache) {
    return cached;
  }

  const info = wasmtimeDownloadInfo();
  const cacheDir = wasmtimeCacheDir();

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const archivePath = path.join(cacheDir, info.fileName);
  await downloadFileWithResume(info.url, archivePath, dlOpts);

  console.log('Extrayendo...');
  await extract(archivePath, cacheDir, 1);
  fs.unlinkSync(archivePath);

  const result = getWasmtimeCachedPaths();
  if (!result) {
    throw new Error('No se pudo encontrar la libreria Wasmtime tras la extraccion.');
  }

  return result;
}
