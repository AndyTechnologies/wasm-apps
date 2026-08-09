import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  rmluiTarballUrl,
  bindgenHeadersDir,
  extractRmluiTarball,
  probeBackendHeaders,
  vendorGl3Header,
  writePinsReport,
  BACKEND_HEADER_FILES,
} from '../../../scripts/rmlui-bindgen/index.mjs';
import { RMLUI_VERSION, SDL3_VERSION } from './rmlui-dl.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bindgenSrc = join(scriptDir, '..', '..', '..', 'scripts', 'rmlui-bindgen', 'index.mjs');

// g++ solo está garantizado en linux/macOS; en CI Windows se degrada con skip.
let gxxAvailable = false;
try {
  execFileSync('g++', ['--version'], { stdio: 'pipe' });
  gxxAvailable = true;
} catch {
  gxxAvailable = false;
}

describe('rmlui-bindgen: header acquisition from pinned tag (R-006)', () => {
  it('rmluiTarballUrl() apunta al tag 6.2 pinned (refs/tags, no branch flotante)', () => {
    const url = rmluiTarballUrl();
    expect(url).toBe('https://github.com/mikke89/RmlUi/archive/refs/tags/6.2.tar.gz');
    expect(url).toContain('refs/tags/');
    expect(url).not.toContain('refs/heads/');
  });

  it('rmluiTarballUrl(version) respeta el parámetro', () => {
    expect(rmluiTarballUrl('6.1')).toBe('https://github.com/mikke89/RmlUi/archive/refs/tags/6.1.tar.gz');
  });

  it('rmluiTarballUrl() usa RMLUI_VERSION exportado (sin literal duplicado)', () => {
    expect(rmluiTarballUrl()).toContain(`/tags/${RMLUI_VERSION}.tar.gz`);
  });

  it('bindgenHeadersDir() extrae a os.tmpdir()/rmlui-bindgen-6.2/', () => {
    expect(bindgenHeadersDir()).toBe(join(tmpdir(), 'rmlui-bindgen-6.2'));
  });

  it('bindgenHeadersDir(version) parametriza el directorio', () => {
    expect(bindgenHeadersDir('9.9')).toBe(join(tmpdir(), 'rmlui-bindgen-9.9'));
  });

  it('index.mjs importa las versiones desde rmlui-versions.ts y no duplica literales', () => {
    const src = readFileSync(bindgenSrc, 'utf-8');
    expect(src).toMatch(/import \{[^}]*RMLUI_VERSION[^}]*\} from '\.\.\/\.\.\/packages\/linker\/src\/rmlui-versions\.ts'/);
    expect(src).not.toContain(['1', '0', '0'].join('.'));
  });
});

describe('rmlui-bindgen: tarball extraction (R-006)', () => {
  let fixtureRoot: string;
  let tarballPath: string;
  let destDir: string;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'rmlui-bindgen-fixture-'));
    const pkgRoot = join(fixtureRoot, 'RmlUi-6.2');
    mkdirSync(join(pkgRoot, 'Backends'), { recursive: true });
    mkdirSync(join(pkgRoot, 'Include', 'RmlUi'), { recursive: true });
    writeFileSync(join(pkgRoot, 'Backends', 'RmlUi_Include_GL3.h'), '#define glFixture 1\n');
    writeFileSync(join(pkgRoot, 'Include', 'RmlUi', 'Core.h'), '#pragma once\n');
    tarballPath = join(fixtureRoot, 'rmlui-6.2.tar.gz');
    execFileSync('tar', ['-czf', tarballPath, '-C', fixtureRoot, 'RmlUi-6.2'], { stdio: 'pipe' });
    destDir = join(fixtureRoot, 'out');
  });

  it('extrae con strip-components (Backends/ en la raíz de destDir)', () => {
    extractRmluiTarball(tarballPath, destDir);
    expect(existsSync(join(destDir, 'Backends', 'RmlUi_Include_GL3.h'))).toBe(true);
    expect(existsSync(join(destDir, 'Include', 'RmlUi', 'Core.h'))).toBe(true);
    expect(existsSync(join(destDir, 'RmlUi-6.2'))).toBe(false);
  });

  it('lanza error si el tarball no existe', () => {
    expect(() => extractRmluiTarball(join(fixtureRoot, 'nope.tar.gz'), join(fixtureRoot, 'out2'))).toThrow();
  });
});

describe('rmlui-bindgen: pins.json report (R-006)', () => {
  it('writePinsReport() reporta 6.2 y la URL del tag pinned', () => {
    const reportPath = join(tmpdir(), `rmlui-bindgen-pins-${process.pid}.json`);
    try {
      writePinsReport(reportPath);
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      expect(report.rmlui.version).toBe('6.2');
      expect(report.rmlui.tarball).toBe('https://github.com/mikke89/RmlUi/archive/refs/tags/6.2.tar.gz');
      expect(report.sdl3.version).toBe('3.2.4');
    } finally {
      rmSync(reportPath, { force: true });
    }
  });

  it('writePinsReport() usa las constantes exportadas', () => {
    const reportPath = join(tmpdir(), `rmlui-bindgen-pins-${process.pid}-b.json`);
    try {
      writePinsReport(reportPath);
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      expect(report.rmlui.version).toBe(RMLUI_VERSION);
      expect(report.sdl3.version).toBe(SDL3_VERSION);
    } finally {
      rmSync(reportPath, { force: true });
    }
  });
});

describe.skipIf(!gxxAvailable)('rmlui-bindgen: compile probe g++ -fsyntax-only (R-006)', () => {
  let fixtureRoot: string;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'rmlui-bindgen-probe-'));
    const backends = join(fixtureRoot, 'Backends');
    const include = join(fixtureRoot, 'Include', 'RmlUi');
    mkdirSync(backends, { recursive: true });
    mkdirSync(include, { recursive: true });
    // Header autónomo compilable (simula RmlUi_Include_GL3.h standalone)
    writeFileSync(join(backends, 'RmlUi_Include_GL3.h'), '#ifndef RMLUI_PROBE_GL3_H\n#define RMLUI_PROBE_GL3_H\n#define glProbeFn 1\n#endif\n');
    writeFileSync(join(backends, 'RmlUi_Platform_SDL.h'), '#pragma once\n');
    writeFileSync(join(backends, 'RmlUi_Renderer_GL3.h'), '#pragma once\n');
    writeFileSync(join(include, 'Core.h'), '#pragma once\n');
  });

  it('probe exit 0 cuando los headers de backends existen', () => {
    expect(() => probeBackendHeaders(fixtureRoot)).not.toThrow();
  });

  it('lanza error si falta algún header de backends', () => {
    rmSync(join(fixtureRoot, 'Backends', 'RmlUi_Renderer_GL3.h'));
    expect(() => probeBackendHeaders(fixtureRoot)).toThrow(/Missing RmlUi headers/);
  });

  it('BACKEND_HEADER_FILES cubre los includes de backends + Core', () => {
    expect(BACKEND_HEADER_FILES).toEqual([
      'Backends/RmlUi_Include_GL3.h',
      'Backends/RmlUi_Platform_SDL.h',
      'Backends/RmlUi_Renderer_GL3.h',
      'Include/RmlUi/Core.h',
    ]);
  });
});

describe('rmlui-bindgen: vendor GL3 header (R-007)', () => {
  let fixtureRoot: string;
  let destPath: string;

  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'rmlui-bindgen-vendor-'));
    mkdirSync(join(fixtureRoot, 'Backends'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'Backends', 'RmlUi_Include_GL3.h'), '#define glFixture 1\n');
    destPath = join(fixtureRoot, 'vendor', 'RmlUi_Include_GL3.h');
  });

  it('copia el header desde el tarball extraído al destino', () => {
    vendorGl3Header(fixtureRoot, destPath);
    expect(readFileSync(destPath, 'utf-8')).toBe('#define glFixture 1\n');
  });

  it('lanza error si el header fuente no existe', () => {
    const emptyRoot = join(fixtureRoot, 'empty-root');
    mkdirSync(emptyRoot, { recursive: true });
    expect(() => vendorGl3Header(emptyRoot, join(fixtureRoot, 'vendor2', 'x.h'))).toThrow(/Missing source header/);
  });
});

describe('rmlui-bindgen: census 4 capas (T-017)', () => {
  const pkgTypes = join(scriptDir, '..', '..', 'types', 'src');
  const abiPath = join(pkgTypes, 'rmlui-abi.h');
  const hhPath = join(pkgTypes, 'rmlui.hh');
  const rsPath = join(pkgTypes, 'rmlui_bindings.rs');
  const tsPath = join(pkgTypes, 'rmlui-bindings.ts');
  const pluginPath = join(scriptDir, 'rmlui-plugin.ts');

  function abiFunctions(): string[] {
    const src = readFileSync(abiPath, 'utf-8');
    const fns = [...src.matchAll(/\b(RmlU?I?_\w+)\s*\(/g)].map((m) => m[1]);
    return [...new Set(fns)].sort();
  }

  function extractFunctions(src: string): string[] {
    const fns = [...new Set([...src.matchAll(/\b(RmlU?I?_\w+)\s*\(/g)].map((m) => m[1]))];
    // RmlUI_Exception es la clase de excepción local del RAII, no una función ABI.
    return fns.filter((fn) => fn !== 'RmlUI_Exception').sort();
  }

  const mirrorLayers = [
    ['rmlui_bindings.rs (Rust FFI)', rsPath],
    ['rmlui-bindings.ts (AssemblyScript)', tsPath],
    ['rmlui-plugin.ts (host funcs)', pluginPath],
  ] as const;

  it('rs/ts/plugin son espejo completo del ABI (conjuntos idénticos)', () => {
    const fns = abiFunctions();
    expect(fns.length).toBeGreaterThan(40); // sanity: 52 funciones esperadas
    for (const [layerName, layerPath] of mirrorLayers) {
      const src = readFileSync(layerPath, 'utf-8');
      const missing = fns.filter((fn) => !src.includes(fn));
      expect(missing, `${layerName} no cubre: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('rmlui.hh es un subset válido: todo lo que usa existe en el ABI', () => {
    const abi = abiFunctions();
    const hhFns = extractFunctions(readFileSync(hhPath, 'utf-8'));
    expect(hhFns.length).toBeGreaterThan(10);
    const invented = hhFns.filter((fn) => !abi.includes(fn));
    expect(invented, `rmlui.hh llama funciones que no existen en el ABI: ${invented.join(', ')}`).toEqual([]);
  });

  it('rmlui.hh expone los símbolos nuevos del ABI migrado (6.2)', () => {
    const src = readFileSync(hhPath, 'utf-8');
    const required = ['Rml_LoadDocumentFromMemory', 'Rml_SetClass', 'Rml_IsClassSet', 'Rml_SetClassNames', 'Rml_GetNumDocuments', 'Rml_GetDocument'];
    const missing = required.filter((fn) => !src.includes(fn));
    expect(missing, `rmlui.hh no usa: ${missing.join(', ')}`).toEqual([]);
  });

  it('los símbolos legacy (6.1) no aparecen en ninguna capa', () => {
    const legacy = ['Rml_LoadDocumentFromString', 'Rml_AddClass', 'Rml_RemoveClass', 'Rml_ToggleClass', 'Rml_HasClass'];
    const layers = [['rmlui.hh (RAII)', hhPath], ...mirrorLayers] as const;
    for (const [layerName, layerPath] of layers) {
      const src = readFileSync(layerPath, 'utf-8');
      const hits = legacy.filter((sym) => src.includes(sym));
      expect(hits, `${layerName} conserva símbolos legacy: ${hits.join(', ')}`).toEqual([]);
    }
  });
});
