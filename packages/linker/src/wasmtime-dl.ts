import os from 'node:os';
import path from 'node:path';

export { downloadFile } from './downloader.js';
export { extractArchive } from './extract.js';

interface WasmtimeAsset {
  url: string;
  fileName: string;
}

function getWasmtimeTarget(platform: string, arch: string): string {
  if (platform === 'linux' && arch === 'x64') return 'x86_64-linux';
  if (platform === 'linux' && arch === 'arm64') return 'aarch64-linux';
  if (platform === 'darwin' && arch === 'x64') return 'x86_64-macos';
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-macos';
  if (platform === 'win32' && arch === 'x64') return 'x86_64-windows';
  if (platform === 'win32' && arch === 'arm64') return 'aarch64-windows';
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

/**
 * Determina la URL de descarga de Wasmtime C-API según plataforma y arquitectura.
 *
 * Mapea process.platform + process.arch a los assets de GitHub releases.
 * Lanza error si la combinación no está soportada.
 */
export function getWasmtimeAsset(version: string, platform?: string, arch?: string): WasmtimeAsset {
  const plat = platform || os.platform();
  const a = arch || os.arch();
  const target = getWasmtimeTarget(plat, a);

  const ext = plat === 'win32' ? 'zip' : 'tar.xz';
  const fileName = `wasmtime-v${version}-${target}-c-api.${ext}`;
  const url = `https://github.com/bytecodealliance/wasmtime/releases/download/v${version}/${fileName}`;

  return { url, fileName };
}

/** Retorna el directorio de caché para las descargas de Wasmtime dentro del home del usuario. */
export function getWasmtimeCacheDir(): string {
  return path.join(os.homedir(), '.wasm-linker');
}

/** Retorna la ruta esperada para el directorio de includes/headers de Wasmtime C-API extraído. */
export function getWasmtimeIncludeDir(cacheDir: string, version: string, platform?: string, arch?: string): string {
  const plat = platform || os.platform();
  const a = arch || os.arch();
  const target = getWasmtimeTarget(plat, a);

  return path.join(cacheDir, `wasmtime-v${version}-${target}-c-api`, 'include');
}
