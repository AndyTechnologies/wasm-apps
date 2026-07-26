import os from 'node:os';
import path from 'node:path';
import { LinkerError } from '@wasm-apps/types';

export { downloadFile } from './downloader.js';
export { extractArchive } from './extract.js';

export interface RmluiAsset {
  url: string;
  fileName: string;
}

function getRmluiTarget(platform: string, arch: string): string {
  if (platform === 'linux' && arch === 'x64') return 'x86_64-linux';
  if (platform === 'linux' && arch === 'arm64') return 'aarch64-linux';
  if (platform === 'darwin' && arch === 'x64') return 'x86_64-macos';
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-macos';
  if (platform === 'win32' && arch === 'x64') return 'x86_64-windows';
  if (platform === 'win32' && arch === 'arm64') return 'aarch64-windows';
  throw new LinkerError(`Unsupported platform: ${platform}-${arch}`);
}

/**
 * Retorna el directorio de caché para las descargas de dependencias RmlUI.
 */
export function getRmluiCacheDir(): string {
  return path.join(os.homedir(), '.wasm-linker', 'rmlui');
}

export interface RmluiAssets {
  sdl: { url: string; fileName: string };
  rmlui: { url: string; fileName: string };
  glad: { url: string; fileName: string };
}

/**
 * Determina las URLs de descarga para las dependencias de RmlUI según plataforma y arquitectura.
 *
 * NOTA: Estas URLs son placeholders — serán resueltas cuando las pre-built libs sean publicadas.
 * Actualmente retorna URLs de ejemplo con el target platform mapping.
 */
export function getRmluiAssets(version?: string): RmluiAssets {
  const v = version || '1.0.0';
  const plat = os.platform();
  const arch = os.arch();
  const target = getRmluiTarget(plat, arch);

  return {
    sdl: {
      url: `https://github.com/libsdl-org/SDL/releases/download/release-${v}/SDL3-${v}-${target}.tar.gz`,
      fileName: `SDL3-${v}-${target}.tar.gz`,
    },
    rmlui: {
      url: `https://github.com/mikke89/RmlUi/releases/download/${v}/RmlUi-${v}-${target}.tar.gz`,
      fileName: `RmlUi-${v}-${target}.tar.gz`,
    },
    glad: {
      url: `https://github.com/Dav1dde/glad/releases/download/v${v}/glad-${v}-${target}.tar.gz`,
      fileName: `glad-${v}-${target}.tar.gz`,
    },
  };
}

/** Retorna la ruta esperada para el directorio de includes de SDL extraído. */
export function getSdlIncludeDir(cacheDir: string, version: string, platform?: string, arch?: string): string {
  const plat = platform || os.platform();
  const a = arch || os.arch();
  const target = getRmluiTarget(plat, a);
  return path.join(cacheDir, `SDL3-${version}-${target}`, 'include');
}

/** Retorna la ruta esperada para el directorio de includes de RmlUI extraído. */
export function getRmluiIncludeDir(cacheDir: string, version: string, platform?: string, arch?: string): string {
  const plat = platform || os.platform();
  const a = arch || os.arch();
  const target = getRmluiTarget(plat, a);
  return path.join(cacheDir, `RmlUi-${version}-${target}`, 'include');
}

/** Retorna la ruta esperada para el directorio de includes de GLAD extraído. */
export function getGladIncludeDir(cacheDir: string, version: string, platform?: string, arch?: string): string {
  const plat = platform || os.platform();
  const a = arch || os.arch();
  const target = getRmluiTarget(plat, a);
  return path.join(cacheDir, `glad-${version}-${target}`, 'include');
}
