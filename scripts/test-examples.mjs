import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

  let stdout;
  try {
    stdout = execFileSync(binPath, { encoding: 'utf-8' });
  } catch (err) {
    // On runtime failure, still capture stdout/stderr if available
    if (err && typeof err === 'object' && 'stdout' in err) {
      stdout = String(err.stdout);
    }
    console.error(`  RESULT: ${dir} — RUNTIME FAILED`);
    if (stdout) process.stdout.write(`  stdout:\n${indent(stdout)}`);
    if (err && typeof err === 'object' && 'stderr' in err && err.stderr) {
      process.stderr.write(`  stderr:\n${indent(String(err.stderr))}`);
    }
    failed++;
    continue;
  }

  // Verify stdout against expected output
  const expectedPath = join(examplePath, 'expected-stdout.txt');
  if (existsSync(expectedPath)) {
    const expected = readFileSync(expectedPath, 'utf-8').replace(/\r\n/g, '\n');
    const normalized = stdout.replace(/\r\n/g, '\n');
    if (normalized !== expected) {
      console.error(`  RESULT: ${dir} — OUTPUT MISMATCH`);
      console.error(`  Expected:\n${indent(expected)}`);
      console.error(`  Got:\n${indent(normalized)}`);
      // Save actual output for comparison
      writeFileSync(join(examplePath, 'actual-stdout.txt'), stdout);
      failed++;
      continue;
    }
  } else {
    // First run: save expected output for review
    writeFileSync(expectedPath, stdout);
    console.warn(`  WARN: ${expectedPath} created from actual output — review and commit`);
  }

  console.log(`  RESULT: ${dir} — PASSED`);
  passed++;
}

const total = passed + failed;
console.log(`\n${'='.repeat(36)}`);
console.log(`  Total: ${total}  Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);

function indent(text) {
  return text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}
