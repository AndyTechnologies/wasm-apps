import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const rootDir = resolve(import.meta.dirname, '..');
const examplesDir = join(rootDir, 'examples');
const cliScript = join(rootDir, 'packages/cli/dist/cli.js');
const ext = process.platform === 'win32' ? '.exe' : '';

const exampleDirs = [
  'basico',
  'proyecto-completo',
  'plugin-basico',
  'plugin-avanzado',
  'cpp-saludo',
  'rust-hello',
  'precompiled',
  'multi-toolchain',
  'custom-template',
  'mounts-demo',
  'rust-fs',
  'as-fs',
];

/**
 * Check if a toolchain is available on the current system.
 * For C++: verifies clang++ exists AND has wasm-ld available.
 * For Rust: verifies cargo exists AND wasm32 target is installed.
 * @param {'cpp'|'rust'} toolchain
 * @returns {boolean}
 */
function isToolchainAvailable(toolchain) {
  try {
    if (toolchain === 'cpp') {
      execFileSync('which', ['clang++'], { stdio: 'pipe' });
      // Verify wasm-ld exists (the linker clang++ uses for wasm32 target)
      const ldPath = execFileSync('clang++', ['--target=wasm32', '-print-prog-name=wasm-ld'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();
      if (!ldPath || !existsSync(ldPath)) return false;
      return true;
    }
    if (toolchain === 'rust') {
      execFileSync('which', ['cargo'], { stdio: 'pipe' });
      const target = execFileSync('rustup', ['target', 'list', '--installed'], {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return target.includes('wasm32-unknown-unknown');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Map example directories to required toolchains (empty = no special requirements).
 * @type {Record<string, string[]>}
 */
const requiresToolchain = {
  'cpp-saludo': ['cpp'],
  'rust-hello': ['rust'],
  'multi-toolchain': ['cpp'],
  'custom-template': [],
  'mounts-demo': ['cpp'],
  'rust-fs': ['rust'],
  'as-fs': [],
  // precompiled depends on basico's build output (AssemblyScript WASM)
  precompiled: [],
};

/**
 * Examples to always skip.
 * @type {Set<string>}
 */
const skipExamples = new Set([]);

/**
 * Clean build artifacts for a given example directory.
 * Removes wasm-out/, .wapp_build/, and .wapp_cache/ so every build starts fresh.
 * @param {string} examplePath
 */
function cleanBuildArtifacts(examplePath) {
  for (const dir of ['wasm-out', '.wapp_build', '.wapp_cache']) {
    const fullPath = join(examplePath, dir);
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

let passed = 0;
let skipped = 0;
let failed = 0;

for (const dir of exampleDirs) {
  const examplePath = join(examplesDir, dir);

  if (!existsSync(examplePath)) {
    console.error(`  SKIP: ${dir} (directorio no encontrado)`);
    skipped++;
    continue;
  }

  // Skip examples on the skip list
  if (skipExamples.has(dir)) {
    console.warn(`  SKIP: ${dir} (in skip list)`);
    skipped++;
    continue;
  }

  // Check toolchain requirements
  const required = requiresToolchain[dir] || [];
  const missing = required.filter((t) => !isToolchainAvailable(t));
  if (missing.length > 0) {
    console.warn(`  SKIP: ${dir} (requiere: ${missing.join(', ')})`);
    skipped++;
    continue;
  }

  // Clean build artifacts so every example builds from scratch
  cleanBuildArtifacts(examplePath);

  // Diagnóstico temporal: guarda el main.cpp generado junto al binario
  process.env.WAPP_KEEP_CPP = '1';

  // precompiled depends on basico's compiled WASM — clean src/ and copy before building
  if (dir === 'precompiled') {
    const basicoWasm = join(examplesDir, 'basico', 'wasm-out', 'main.wasm');
    if (!existsSync(basicoWasm)) {
      console.error(`  SKIP: ${dir} (basico must be built first — wasm-out/main.wasm not found)`);
      skipped++;
      continue;
    }
    const precompiledSrcDir = join(examplePath, 'src');
    // src/ is not versioned (main.wasm is regenerated) — ensure it exists
    mkdirSync(precompiledSrcDir, { recursive: true });
    // Clean any stale .wasm files from src/
    for (const f of readdirSync(precompiledSrcDir)) {
      if (f.endsWith('.wasm')) rmSync(join(precompiledSrcDir, f));
    }
    copyFileSync(basicoWasm, join(precompiledSrcDir, 'main.wasm'));
    console.log(`  (copied basico/wasm-out/main.wasm → src/main.wasm)`);
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
    // Diagnóstico temporal: volcar el main.cpp generado para inspección
    const cppPath = join(examplePath, outDir, `${outputName}.cpp`);
    if (existsSync(cppPath)) {
      process.stderr.write(`  --- main.cpp generado (${cppPath}) ---\n${indent(readFileSync(cppPath, 'utf-8'))}\n`);
    }
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

const total = passed + failed + skipped;
console.log(`\n${'='.repeat(36)}`);
console.log(`  Total: ${total}  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
if (failed > 0) process.exit(1);

function indent(text) {
  return text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}
