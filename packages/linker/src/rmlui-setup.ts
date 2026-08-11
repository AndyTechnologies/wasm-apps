import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { LinkerError, logger } from '@wasm-apps/types';
import {
  getRmluiCacheDir,
  getSdlCacheDir,
  getRmluiDepCacheDir,
  getFontsCacheDir,
  getSdlIncludeDir,
  getRmluiIncludeDir,
  RMLUI_VERSION,
  SDL3_VERSION,
} from './rmlui-dl.js';
import { downloadFile } from './downloader.js';
import { extractTarGz, extractZip } from './extract.js';
import { getSdl3Pin, RMLUI_PIN, RMLUI_FONT_PINS } from './rmlui-pins.js';

/**
 * Instala/actualiza las dependencias de RmlUI (SDL3, RmlUi, fonts) en el
 * caché global ~/.wasm-linker/rmlui/{sdl,rmlui,fonts,src}/.
 *
 * Pipeline:
 * 1. Marker {dep}.{version}.ok → ya instalado, skip
 * 2. Descarga con SHA256 pinned (mismatch → purge + LinkerError)
 * 3. Extrae (VC.zip win32 / tarball linux-macos / fonts desde tarball RmlUi)
 * 4. Escribe marker al completar
 *
 * (T-022): linux/macos usan el source tarball de SDL3 y se compilan desde
 * fuente SIEMPRE (con `cmake --install` al layout esperado); win32-x64 usa
 * el VC.zip prebuilt. Cualquier fallo de descarga → LinkerError directo.
 */

export function sdlMarkerName(): string {
  return `sdl.${SDL3_VERSION}.ok`;
}

export function rmluiMarkerName(): string {
  return `rmlui.${RMLUI_VERSION}.ok`;
}

function markerPath(cacheDir: string, name: string): string {
  return path.join(cacheDir, name);
}

function isInstalled(cacheDir: string, name: string): boolean {
  return fs.existsSync(markerPath(cacheDir, name));
}

function writeMarker(cacheDir: string, name: string): void {
  fs.writeFileSync(markerPath(cacheDir, name), `ok\n`, 'utf-8');
}

async function downloadPinned(url: string, destPath: string, sha256: string): Promise<void> {
  logger.detail(`Downloading ${path.basename(destPath)}...`);
  await downloadFile(
    url,
    destPath,
    (downloaded, total) => {
      if (total) {
        const pct = ((downloaded / total) * 100).toFixed(0);
        logger.detail(`  ${downloaded}/${total} bytes (${pct}%)`);
      }
    },
    sha256,
  );
}

/** Extrae las fonts del tarball RmlUi a la caché fonts/. */
export function extractFonts(rmluiArchive: string, fontsDir: string): void {
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const [fileName, pin] of Object.entries(RMLUI_FONT_PINS)) {
    const dest = path.join(fontsDir, fileName);
    if (fs.existsSync(dest)) continue;
    const insidePath = `RmlUi-${RMLUI_VERSION}/Samples/assets/${fileName}`;
    // Extracción selectiva vía tar --extract --file con ruta exacta.
    // El member tiene 4 componentes (RmlUi-6.2/Samples/assets/NAME): strip=3
    // deja solo el filename. strip=4 colapsa a path vacío y GNU tar sale 0
    // sin escribir nada (bug real detectado en T-031).
    execFileSync('tar', ['-xzf', rmluiArchive, '-C', fontsDir, '--strip-components=3', insidePath]);
    const actual = sha256Of(dest);
    if (actual !== pin.sha256) {
      fs.rmSync(dest, { force: true });
      throw new LinkerError(`Font ${fileName} hash mismatch: expected ${pin.sha256}, got ${actual}`);
    }
  }
}

function sha256Of(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Build de SDL3 desde fuente (T-022): extrae el tarball a src/, compila y
 * instala headers + libs estáticas al layout esperado (SDL3-<v>/include y
 * SDL3-<v>/lib) vía `cmake --install --prefix`. */
async function buildSdl3FromSource(archivePath: string, sdlCacheDir: string): Promise<void> {
  const srcDir = path.join(sdlCacheDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  logger.step('Building SDL3 from source...');
  await extractTarGz(archivePath, srcDir);
  const sdlSrc = path.join(srcDir, `SDL3-${SDL3_VERSION}`);
  const buildDir = path.join(sdlCacheDir, `SDL3-${SDL3_VERSION}`, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  await execFileAsync('cmake', [
    '-S',
    sdlSrc,
    '-B',
    buildDir,
    '-DSDL_STATIC=ON',
    '-DSDL_SHARED=OFF',
    '-DSDL_TEST=OFF',
    '-DSDL_TESTS=OFF',
    '-DSDL_EXAMPLES=OFF',
  ]);
  await execFileAsync('cmake', ['--build', buildDir, '--config', 'Release']);
  await execFileAsync('cmake', ['--install', buildDir, '--prefix', path.join(sdlCacheDir, `SDL3-${SDL3_VERSION}`)]);
}

/**
 * Build de RmlUi desde fuente (T-023): libs estáticas rmlui_core +
 * rmlui_debugger con los módulos opcionales desactivados. Los backends
 * SDL/GL3 se compilan en el CMake generado del linker con
 * RMLUI_SDL_VERSION_MAJOR=3 (no se compilan aquí).
 */
async function buildRmluiFromSource(rmluiCacheDir: string): Promise<string> {
  const srcDir = path.join(rmluiCacheDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  const rmluiSrc = path.join(rmluiCacheDir, `RmlUi-${RMLUI_VERSION}`);
  const buildDir = path.join(rmluiSrc, 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  logger.step(`Building RmlUi ${RMLUI_VERSION} from source...`);
  await execFileAsync('cmake', [
    '-S',
    rmluiSrc,
    '-B',
    buildDir,
    '-DBUILD_SHARED_LIBS=OFF',
    '-DBUILD_SAMPLES=OFF',
    '-DBUILD_TESTING=OFF',
    '-DBUILD_LUA_BINDINGS=OFF',
    '-DBUILD_LOTTIE=OFF',
    '-DBUILD_SVG=OFF',
    '-DCMAKE_BUILD_TYPE=Release',
  ]);
  await execFileAsync('cmake', ['--build', buildDir, '--config', 'Release']);
  return buildDir;
}

/** Instala/actualiza las dependencias de RmlUI. */
export async function setupRmlui(ignoreCache?: boolean): Promise<void> {
  const cacheDir = getRmluiCacheDir();
  const sdlCacheDir = getSdlCacheDir(cacheDir);
  const rmluiCacheDir = getRmluiDepCacheDir(cacheDir);
  const fontsDir = getFontsCacheDir(cacheDir);

  for (const dir of [cacheDir, sdlCacheDir, rmluiCacheDir, fontsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (ignoreCache) {
    for (const dir of [sdlCacheDir, rmluiCacheDir, fontsDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const plat = os.platform();
  const arch = os.arch();

  // ── RmlUi tarball (común a todas las plataformas) ────────────────
  const rmluiArchive = path.join(rmluiCacheDir, RMLUI_PIN.fileName);
  if (!isInstalled(rmluiCacheDir, rmluiMarkerName())) {
    try {
      await downloadPinned(RMLUI_PIN.url, rmluiArchive, RMLUI_PIN.sha256);
    } catch (err: unknown) {
      throw new LinkerError(`RmlUi ${RMLUI_VERSION} download failed and has no source fallback. ` + `URL: ${RMLUI_PIN.url} — ${(err as Error).message}`);
    }
    const rmluiDest = path.join(rmluiCacheDir, `RmlUi-${RMLUI_VERSION}`);
    fs.rmSync(rmluiDest, { recursive: true, force: true });
    await extractTarGz(rmluiArchive, rmluiCacheDir);
    // RmlUi: libs estáticas compiladas desde fuente (rmlui_core + rmlui_debugger).
    await buildRmluiFromSource(rmluiCacheDir);
    writeMarker(rmluiCacheDir, rmluiMarkerName());
  }

  // Backends headers (RmlUi_Renderer_GL3.h, RmlUi_Platform_SDL.h) → layout
  // instalado (Include/RmlUi/Backends/). Idempotente: repara cachés viejas
  // que ya tienen el marker pero no copiaron los backends.
  const rmluiRoot = path.join(rmluiCacheDir, `RmlUi-${RMLUI_VERSION}`);
  const backendsSrc = path.join(rmluiRoot, 'Backends');
  const backendsDest = path.join(rmluiRoot, 'Include', 'RmlUi', 'Backends');
  if (fs.existsSync(backendsSrc) && !fs.existsSync(backendsDest)) {
    fs.cpSync(backendsSrc, backendsDest, { recursive: true });
    logger.detail('RmlUi backends headers copied to Include/RmlUi/Backends');
  }

  // ── Fonts desde el tarball RmlUi ──────────────────────────────────
  if (!fs.existsSync(path.join(fontsDir, 'LatoLatin-Regular.ttf'))) {
    // El tarball puede faltar (limpieza manual / ignoreCache parcial) aunque
    // el marker de RmlUi exista — re-descargar antes de extraer fonts.
    if (!fs.existsSync(rmluiArchive)) {
      await downloadPinned(RMLUI_PIN.url, rmluiArchive, RMLUI_PIN.sha256);
    }
    extractFonts(rmluiArchive, fontsDir);
  }

  // ── SDL3 según plataforma ─────────────────────────────────────────
  const sdlPin = getSdl3Pin(plat, arch);
  const sdlArchive = path.join(sdlCacheDir, sdlPin.fileName);
  if (!isInstalled(sdlCacheDir, sdlMarkerName())) {
    try {
      await downloadPinned(sdlPin.url, sdlArchive, sdlPin.sha256);
    } catch (err: unknown) {
      // win32-x64 VC.zip prebuilt: sin fallback → error directo.
      // linux/macos source tarball: sin tarball no hay nada que compilar → error.
      throw new LinkerError(`SDL3 ${SDL3_VERSION} download failed (${plat}-${arch}). URL: ${sdlPin.url} — ${(err as Error).message}`);
    }

    const sdlDest = path.join(sdlCacheDir, `SDL3-${SDL3_VERSION}`);
    fs.rmSync(sdlDest, { recursive: true, force: true });
    if (sdlPin.fileName.endsWith('.zip')) {
      // Prebuilt VC (win32-x64): extraer directo (lib/x64 + include).
      await extractZip(sdlArchive, sdlCacheDir);
    } else {
      // Source tarball (linux/macos): extraer + compilar + instalar.
      await buildSdl3FromSource(sdlArchive, sdlCacheDir);
    }
    writeMarker(sdlCacheDir, sdlMarkerName());
  }

  logger.detail(`RmlUI deps ready in ${cacheDir}`);
  logger.detail(`  SDL3 include: ${getSdlIncludeDir(cacheDir, SDL3_VERSION)}`);
  logger.detail(`  RmlUi include: ${getRmluiIncludeDir(cacheDir, RMLUI_VERSION)}`);
}

function execFileAsync(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 600000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new LinkerError(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}
