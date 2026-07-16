import { execFileSync } from 'node:child_process';
import { join, resolve, basename } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const rootDir = resolve(import.meta.dirname, '..');
const examplesDir = join(rootDir, 'examples');
const cliScript = join(rootDir, 'packages/cli/dist/cli.js');
const ext = process.platform === 'win32' ? '.exe' : '';

const exampleDirs = ['basico', 'proyecto-completo', 'plugin-basico', 'plugin-avanzado'];

let passed = 0;
let failed = 0;

for (const dir of exampleDirs) {
  const examplePath = join(examplesDir, dir);

  if (!existsSync(examplePath)) {
    console.error(`  SKIP: ${dir} (directorio no encontrado)`);
    continue;
  }

  process.stdout.write(`\n--- ${dir} ---\n`);

  try {
    execFileSync('node', [cliScript, 'build'], { cwd: examplePath, stdio: 'inherit' });
  } catch {
    console.error(`  RESULT: ${dir} — BUILD FAILED`);
    failed++;
    continue;
  }

  const configPath = join(examplePath, 'wapp.json');
  let outputName = dir;
  let outDir = 'wasm-out';
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (cfg.output) outputName = cfg.output;
      if (cfg.outDir) outDir = cfg.outDir;
    } catch {
      // use defaults
    }
  }

  const binPath = join(examplePath, outDir, `${outputName}${ext}`);

  if (!existsSync(binPath)) {
    console.error(`  RESULT: ${dir} — binary not found at ${binPath}`);
    failed++;
    continue;
  }

  try {
    execFileSync(binPath, { stdio: 'inherit' });
    console.log(`  RESULT: ${dir} — PASSED`);
    passed++;
  } catch {
    console.error(`  RESULT: ${dir} — RUNTIME FAILED`);
    failed++;
  }
}

const total = passed + failed;
console.log(`\n${'='.repeat(36)}`);
console.log(`  Total: ${total}  Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
