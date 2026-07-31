// Copia src/bindings → dist/bindings tras tsc.
// tsc solo compila .ts; los bindings incluyen assets no-TS (.rs, .h) y
// fuentes .ts que asc necesita textuales (--path). Sin esta copia, la
// inyección de bindings (AS --path, C++ -I, Rust path-dep) falla en runtime.
import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(pkgRoot, 'src', 'bindings');
const dest = path.join(pkgRoot, 'dist', 'bindings');

if (!existsSync(src)) {
  console.error(`copy-bindings: no existe ${src}`);
  process.exit(1);
}

cpSync(src, dest, { recursive: true, force: true });
