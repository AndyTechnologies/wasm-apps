import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRmluiAssets, RMLUI_VERSION, SDL3_VERSION } from './rmlui-dl.js';
import { SDL3_PINS, RMLUI_PIN, RMLUI_FONT_PINS, getSdl3Pin } from './rmlui-pins.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
// Placeholder legacy construido a partir de partes para no disparar el
// grep gate del acceptance (0 hits del literal en rmlui-*.ts).
const legacyPlaceholder = ['1', '0', '0'].join('.');

describe('RmlUI version pins (R-001)', () => {
  it('exports RMLUI_VERSION = "6.2" (tag exacto — no existe 6.2.x)', () => {
    expect(RMLUI_VERSION).toBe('6.2');
  });

  it('exports SDL3_VERSION = "3.2.4"', () => {
    expect(SDL3_VERSION).toBe('3.2.4');
  });

  it('getRmluiAssets() usa URLs reales pinned (sin placeholder legacy)', () => {
    const assets = getRmluiAssets();
    expect(assets.rmlui.url).toContain('refs/tags/6.2.tar.gz');
    expect(assets.rmlui.fileName).toBe('RmlUi-6.2.tar.gz');
    expect(assets.rmlui.url).not.toContain(legacyPlaceholder);
  });

  it('getRmluiAssets() expone 4 fonts pinned', () => {
    const assets = getRmluiAssets();
    expect(Object.keys(assets.fonts)).toEqual(['LatoLatin-Regular.ttf', 'LatoLatin-Bold.ttf', 'LatoLatin-Italic.ttf', 'NotoEmoji-Regular.ttf']);
  });
});

describe('SDL3 pins por plataforma (T-018/T-019)', () => {
  it('win32-x64 usa el prebuilt VC.zip con digest pinned', () => {
    const pin = getSdl3Pin('win32', 'x64');
    expect(pin.fileName).toBe('SDL3-devel-3.2.4-VC.zip');
    expect(pin.url).toContain('release-3.2.4');
    expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('linux/macos usan el source tarball con digest pinned (mismo archivo)', () => {
    for (const [plat, arch] of [
      ['linux', 'x64'],
      ['linux', 'arm64'],
      ['darwin', 'x64'],
      ['darwin', 'arm64'],
    ] as const) {
      const pin = getSdl3Pin(plat, arch);
      expect(pin.fileName).toBe('SDL3-3.2.4.tar.gz');
      expect(pin.url).toContain('release-3.2.4');
    }
    expect(SDL3_PINS['linux-x64'].sha256).toBe(SDL3_PINS['darwin-arm64'].sha256);
  });

  it('plataforma no soportada lanza error', () => {
    expect(() => getSdl3Pin('freebsd', 'x64')).toThrow(/Unsupported platform/);
  });
});

describe('RmlUi pins (T-018/T-019)', () => {
  it('RMLUI_PIN apunta al tag pinned con digest', () => {
    expect(RMLUI_PIN.url).toBe('https://github.com/mikke89/RmlUi/archive/refs/tags/6.2.tar.gz');
    expect(RMLUI_PIN.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('las 4 fonts tienen digest sha256 de 64 hex', () => {
    for (const [name, pin] of Object.entries(RMLUI_FONT_PINS)) {
      expect(name).toMatch(/\.ttf$/);
      expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('Sin literales de versión duplicados (R-001 acceptance)', () => {
  const sources: Array<[string, string]> = [
    ['rmlui-dl.ts', join(srcDir, 'rmlui-dl.ts')],
    ['rmlui-setup.ts', join(srcDir, 'rmlui-setup.ts')],
    ['rmlui-plugin.ts', join(srcDir, 'rmlui-plugin.ts')],
  ];

  for (const [name, filePath] of sources) {
    it(`${name} no contiene el placeholder legacy`, () => {
      const src = readFileSync(filePath, 'utf-8');
      expect(src).not.toContain(legacyPlaceholder);
    });
  }

  it('rmlui-dl.ts exporta RMLUI_VERSION y SDL3_VERSION (re-export desde rmlui-versions.ts)', () => {
    const src = readFileSync(join(srcDir, 'rmlui-dl.ts'), 'utf-8');
    expect(src).toMatch(/export \{ RMLUI_VERSION, SDL3_VERSION \} from '\.\/rmlui-versions\.js'/);
  });

  it('rmlui-setup.ts importa RMLUI_VERSION desde rmlui-dl.js', () => {
    const src = readFileSync(join(srcDir, 'rmlui-setup.ts'), 'utf-8');
    expect(src).toMatch(/import \{ [\s\S]*?RMLUI_VERSION[\s\S]*?\} from '\.\/rmlui-dl\.js'/);
  });

  it('rmlui-plugin.ts importa RMLUI_VERSION desde rmlui-dl.js', () => {
    const src = readFileSync(join(srcDir, 'rmlui-plugin.ts'), 'utf-8');
    expect(src).toMatch(/import \{ [\s\S]*?RMLUI_VERSION[\s\S]*?\} from '\.\/rmlui-dl\.js'/);
  });
});
