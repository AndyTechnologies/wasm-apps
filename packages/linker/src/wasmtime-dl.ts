import os from 'node:os';
import path from 'node:path';

export { downloadFile } from './downloader.js';
export { extractArchive } from './extract.js';

interface WasmtimeAsset {
  url: string;
  fileName: string;
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

  let target: string;

  if (plat === 'linux' && a === 'x64') target = 'x86_64-linux';
  else if (plat === 'linux' && a === 'arm64') target = 'aarch64-linux';
  else if (plat === 'darwin' && a === 'x64') target = 'x86_64-macos';
  else if (plat === 'darwin' && a === 'arm64') target = 'aarch64-macos';
  else if (plat === 'win32' && a === 'x64') target = 'x86_64-windows';
  else if (plat === 'win32' && a === 'arm64') target = 'aarch64-windows';
  else throw new Error(`Unsupported platform: ${plat}-${a}`);

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
  let target: string;
  if (plat === 'linux' && a === 'x64') target = 'x86_64-linux';
  else if (plat === 'linux' && a === 'arm64') target = 'aarch64-linux';
  else if (plat === 'darwin' && a === 'x64') target = 'x86_64-macos';
  else if (plat === 'darwin' && a === 'arm64') target = 'aarch64-macos';
  else if (plat === 'win32' && a === 'x64') target = 'x86_64-windows';
  else if (plat === 'win32' && a === 'arm64') target = 'aarch64-windows';
  else throw new Error(`Unsupported platform: ${plat}-${a}`);

  return path.join(cacheDir, `wasmtime-v${version}-${target}-c-api`, 'include');
}
