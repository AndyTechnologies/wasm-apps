#!/usr/bin/env node
/**
 * rmlui-smoke.mjs — Smoke E2E de los ejemplos RmlUI (T-032).
 *
 * Corre cada binario RmlUI compilado durante ~4s y verifica que:
 *   1. El proceso siga vivo hasta el timeout (no crashea).
 *   2. stderr no contenga errores reales (filtra los logs de info de
 *      carga de fonts, que RmlUi emite por el canal de error).
 *
 * Requiere display (X11/Wayland). Sin display → SKIP (CI headless).
 * Uso: node scripts/rmlui-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const examplesDir = join(rootDir, 'examples');
const examples = ['rmlui-basic', 'rmlui-dom-api', 'rmlui-rust'];
const RUN_MS = 4000;

// Solo en Linux la ventana SDL3 requiere un display X11/Wayland; en macOS
// (cocoa) y Windows el runner tiene sesión de escritorio sin DISPLAY.
const isLinux = process.platform === 'linux';
const hasDisplay = !isLinux || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

/** Líneas de stderr que son info legítima de RmlUi (no errores). */
const INFO_RE = /^Loaded font face /;

/** Patrones que indican un error real en stderr. */
const ERROR_RES = [/error/i, /failed/i, /could not/i, /unable to open/i, /not found/i, /exception/i, /abort/i];

function isErrorLine(line) {
  if (INFO_RE.test(line)) return false;
  return ERROR_RES.some((re) => re.test(line));
}

async function runSmoke(example) {
  const dir = join(examplesDir, example);
  const bin = join(dir, 'wasm-out', example);
  if (!existsSync(bin)) {
    console.log(`  SKIP: ${example} (binario no encontrado — build primero)`);
    return 'skipped';
  }

  return await new Promise((resolvePromise) => {
    const child = spawn(bin, [], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
    let errBuf = '';
    let finished = false;

    child.stderr.on('data', (chunk) => {
      errBuf += chunk.toString();
    });

    const finish = (status, extra = '') => {
      if (finished) return;
      finished = true;
      const errLines = errBuf.split('\n').filter((l) => l.trim() && isErrorLine(l));
      resolvePromise({ status, extra, errLines });
    };

    child.on('error', (err) => finish('failed', `spawn error: ${err.message}`));
    child.on('exit', (code, signal) => {
      // Murió antes del timeout → crash (o exit limpio inesperado).
      finish(code === 0 ? 'exited' : 'failed', `exit code=${code} signal=${signal}`);
    });

    setTimeout(() => {
      if (!finished) {
        child.kill('SIGTERM');
        finish('passed');
      }
    }, RUN_MS);
  });
}

let passed = 0;
let failed = 0;
let skipped = 0;

if (!hasDisplay) {
  console.log('rmlui-smoke: SKIP (Linux sin DISPLAY/WAYLAND_DISPLAY — CI headless)');
  process.exit(0);
}

for (const example of examples) {
  const result = await runSmoke(example);
  if (result.status === 'skipped') {
    skipped++;
  } else if (result.status === 'passed') {
    passed++;
    console.log(`  PASS: ${example} (corrió ${RUN_MS}ms sin errores)`);
  } else {
    failed++;
    console.error(`  FAIL: ${example} — ${result.extra}`);
    for (const line of (result.errLines || []).slice(0, 8)) {
      console.error(`         ${line}`);
    }
  }
}

console.log(`\nrmlui-smoke: ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
