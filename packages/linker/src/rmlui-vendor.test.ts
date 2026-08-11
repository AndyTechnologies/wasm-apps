import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcDir = dirname(fileURLToPath(import.meta.url));
const vendorPath = join(srcDir, '..', 'templates-rmlui', 'vendor', 'RmlUi_Include_GL3.h');

describe('GL3 loader vendored desde el tarball 6.2 (R-007)', () => {
  it('existe en packages/linker/templates-rmlui/vendor/', () => {
    expect(existsSync(vendorPath)).toBe(true);
  });

  it('contiene ~344 #define gl* (loader GL embebido, sin GLAD externo)', () => {
    const src = readFileSync(vendorPath, 'utf-8');
    const glDefines = src.split('\n').filter((l) => /^#define\s+gl\w+/.test(l.trim()));
    expect(glDefines.length).toBe(344);
  });

  it('expone defines GL3 core usados por el bridge (triangulación)', () => {
    const src = readFileSync(vendorPath, 'utf-8');
    expect(src).toMatch(/#define\s+glGenVertexArrays/);
    expect(src).toMatch(/#define\s+glCreateShader/);
    expect(src).toMatch(/#define\s+glGetString/);
    expect(src).toMatch(/#define\s+glClear/);
  });

  it('es el loader de RmlUi (banner del archivo fuente)', () => {
    const firstLines = readFileSync(vendorPath, 'utf-8').split('\n').slice(0, 30).join('\n');
    expect(firstLines).toMatch(/RmlUi|GLAD|glad/i);
  });
});
