import os from 'node:os';
import path from 'node:path';
import { LinkerError } from '@wasm-apps/types';
import { RMLUI_VERSION } from './rmlui-versions.js';
import { getSdl3Pin, RMLUI_PIN, RMLUI_FONT_PINS, type RmluiPin } from './rmlui-pins.js';

export { downloadFile } from './downloader.js';
export { extractArchive, extractZip, extractTarGz } from './extract.js';
export { RMLUI_VERSION, SDL3_VERSION } from './rmlui-versions.js';

export interface RmluiAssets {
  sdl: RmluiPin;
  rmlui: RmluiPin;
  fonts: Record<string, RmluiPin>;
}

/**
 * Determina los pins de descarga para las dependencias de RmlUI según
 * plataforma y arquitectura. URLs reales y SHA256 fijados en rmlui-pins.ts:
 *   - SDL3: win32-x64 → VC.zip prebuilt; linux/macos → source tarball
 *   - RmlUi: tarball del tag 6.2 (independiente de plataforma)
 *   - Fonts: extraídas del tarball RmlUi (Samples/assets/)
 */
export function getRmluiAssets(): RmluiAssets {
  return {
    sdl: getSdl3Pin(os.platform(), os.arch()),
    rmlui: RMLUI_PIN,
    fonts: RMLUI_FONT_PINS,
  };
}

/**
 * Retorna el directorio de caché para las descargas de dependencias RmlUI.
 * Layout: ~/.wasm-linker/rmlui/{sdl,rmlui,fonts,src}/
 */
export function getRmluiCacheDir(): string {
  return path.join(os.homedir(), '.wasm-linker', 'rmlui');
}

/** Directorio de caché de la dependencia SDL3. */
export function getSdlCacheDir(cacheDir: string): string {
  return path.join(cacheDir, 'sdl');
}

/** Directorio de caché de RmlUi (tarball + fuentes). */
export function getRmluiDepCacheDir(cacheDir: string): string {
  return path.join(cacheDir, 'rmlui');
}

/** Directorio de caché de las fonts. */
export function getFontsCacheDir(cacheDir: string): string {
  return path.join(cacheDir, 'fonts');
}

/** Retorna la ruta del include de SDL3 extraído (tarball o VC.zip). */
export function getSdlIncludeDir(cacheDir: string, version: string): string {
  return path.join(cacheDir, 'sdl', `SDL3-${version}`, 'include');
}

/** Retorna la ruta del include de RmlUi extraído (Include/ con mayúscula). */
export function getRmluiIncludeDir(cacheDir: string, version: string): string {
  return path.join(cacheDir, 'rmlui', `RmlUi-${version}`, 'Include');
}

/** Retorna la ruta del directorio de libs SDL3 prebuilt (VC.zip layout: lib/x64/). */
export function getSdlLibDir(cacheDir: string, version: string, platform?: string): string {
  const plat = platform || os.platform();
  const arch = os.arch();
  const libDir = plat === 'win32' && arch === 'x64' ? path.join('lib', 'x64') : 'lib';
  return path.join(cacheDir, 'sdl', `SDL3-${version}`, libDir);
}

/**
 * Retorna la ruta esperada del directorio de libs de RmlUi construido desde
 * fuente (CMake build). Mismo layout en todas las plataformas.
 */
export function getRmluiLibDir(cacheDir: string, version: string): string {
  return path.join(cacheDir, 'rmlui', `RmlUi-${version}`, 'build');
}

/** Backward-compat: antigua firma con target en el nombre (descartada). */
export function getRmluiTargetLegacy(): never {
  throw new LinkerError('Legacy target URLs were removed; use rmlui-pins.ts');
}
