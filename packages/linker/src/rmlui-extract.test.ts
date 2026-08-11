import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

// Test de integración real de extractFonts (sin mocks): construye un tarball
// con la estructura exacta de RmlUi-6.2 (Samples/assets/NAME, 4 componentes)
// y verifica la extracción selectiva con --strip-components=3. Regresión de
// T-031: strip=4 colapsaba a path vacío y GNU tar salía 0 sin escribir nada.
describe('extractFonts: extracción real de fonts desde tarball RmlUi', () => {
  const run = process.platform === 'win32' ? it.skip : it;

  run('extrae al path correcto (no ENOENT): el mismatch con bytes fake prueba que el archivo se leyó', async () => {
    const { extractFonts } = await import('./rmlui-setup.js');
    const dir = mkdtempSync(join(tmpdir(), 'rmlui-extract-'));
    try {
      const archive = join(dir, 'RmlUi-6.2.tar.gz');
      const staging = join(dir, 'stage');
      const fontsDir = join(dir, 'fonts');
      const fontPath = join(staging, 'RmlUi-6.2', 'Samples', 'assets', 'LatoLatin-Regular.ttf');
      mkdirSync(join(staging, 'RmlUi-6.2', 'Samples', 'assets'), { recursive: true });
      writeFileSync(fontPath, 'fake-font-bytes');
      execFileSync('tar', ['-czf', archive, '-C', staging, 'RmlUi-6.2']);

      // Con strip=3 el tar extrae el member (4 componentes) al path correcto.
      // Con el bug de strip=4 el archivo nunca se creaba → ENOENT en sha256Of.
      // El error aquí es hash mismatch (bytes fake), no ENOENT → regresión cubierta.
      expect(() => extractFonts(archive, fontsDir)).toThrow(/hash mismatch/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  run('rechaza font con hash incorrecto (borra el archivo)', async () => {
    const { extractFonts } = await import('./rmlui-setup.js');
    const dir = mkdtempSync(join(tmpdir(), 'rmlui-extract-bad-'));
    try {
      const archive = join(dir, 'RmlUi-6.2.tar.gz');
      const staging = join(dir, 'stage');
      const fontsDir = join(dir, 'fonts');
      const fontPath = join(staging, 'RmlUi-6.2', 'Samples', 'assets', 'LatoLatin-Regular.ttf');
      mkdirSync(join(staging, 'RmlUi-6.2', 'Samples', 'assets'), { recursive: true });
      writeFileSync(fontPath, 'wrong-bytes');
      execFileSync('tar', ['-czf', archive, '-C', staging, 'RmlUi-6.2']);

      expect(() => extractFonts(archive, fontsDir)).toThrow(/hash mismatch/);
      expect(existsSync(join(fontsDir, 'LatoLatin-Regular.ttf'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
