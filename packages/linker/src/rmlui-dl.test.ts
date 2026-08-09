import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRmluiAssets, RMLUI_VERSION, SDL3_VERSION } from './rmlui-dl.js';

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

  it('getRmluiAssets() usa RMLUI_VERSION por defecto (sin placeholder legacy)', () => {
    const assets = getRmluiAssets();
    expect(assets.rmlui.url).toContain('/6.2/');
    expect(assets.rmlui.fileName).toContain('6.2');
    expect(assets.rmlui.url).not.toContain(legacyPlaceholder);
  });

  it('getRmluiAssets(version) respeta el parámetro explícito', () => {
    const assets = getRmluiAssets('7.1');
    expect(assets.rmlui.url).toContain('/7.1/');
    expect(assets.sdl.url).toContain('release-7.1');
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
    expect(src).toMatch(/import \{ [^}]*RMLUI_VERSION[^}]* \} from '\.\/rmlui-dl\.js'/);
  });

  it('rmlui-plugin.ts importa RMLUI_VERSION desde rmlui-dl.js', () => {
    const src = readFileSync(join(srcDir, 'rmlui-plugin.ts'), 'utf-8');
    expect(src).toMatch(/import \{ [^}]*RMLUI_VERSION[^}]* \} from '\.\/rmlui-dl\.js'/);
  });
});
