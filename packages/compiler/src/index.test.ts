import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./strategies/_utils.js', () => ({
  runExecFile: vi.fn(),
}));

vi.mock('./disk-cache.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCached: () => null,
    saveToCache: () => {},
  };
});

import { runExecFile } from './strategies/_utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { compileWasm, clearMemoryCache, rewriteBindingImports } from './index.js';
import { clearCompileCache } from './disk-cache.js';

/** Escribe archivos de salida simulados de asc en el temp dir derivado de los args. */
function writeAscOutputs(args: string[], dtsContent = ''): void {
  const outIdx = args.indexOf('--outFile');
  if (outIdx === -1) return;
  const dir = path.dirname(args[outIdx + 1]);
  fs.writeFileSync(path.join(dir, 'output.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
  fs.writeFileSync(path.join(dir, 'output.js'), '');
  fs.writeFileSync(path.join(dir, 'output.d.ts'), dtsContent);
  fs.writeFileSync(path.join(dir, 'output.wasm.map'), '{}');
}

describe('compileWasm', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-test-'));
  const wasmFile = path.join(tmpDir, 'test.wasm.ts');

  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryCache();
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    clearCompileCache();
    fs.writeFileSync(wasmFile, 'export function _start(): void {}');
    vi.mocked(runExecFile).mockResolvedValue({ stdout: '', stderr: '' });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns compile result with all fields', async () => {
    vi.mocked(runExecFile).mockImplementation(async (_cmd: string, args: string[]) => {
      writeAscOutputs(args, 'export function _start(): void;');
      return { stdout: '', stderr: '' };
    });

    const result = await compileWasm({
      fileName: `${wasmFile}-1`,
      sourceCode: 'export function _start(): void {}',
      isDev: true,
    });

    expect(result.wasmBytes).toBeDefined();
    expect(result.dtsContent).toBe('export function _start(): void;');
    expect(result.bindingsJs).toBe('');
    expect(result.sourceMap).toBe('{}');
    expect(result.hash).toBeTruthy();
  });

  it('caches result in memory on second call', async () => {
    vi.mocked(runExecFile).mockImplementation(async (_cmd: string, args: string[]) => {
      writeAscOutputs(args);
      return { stdout: '', stderr: '' };
    });

    const fileName = `${wasmFile}-mem`;
    await compileWasm({ fileName, sourceCode: 'unique_mem_cache_test', isDev: true });
    await compileWasm({ fileName, sourceCode: 'unique_mem_cache_test', isDev: true });

    expect(vi.mocked(runExecFile)).toHaveBeenCalledTimes(1);
  });

  it('recompiles when source changes', async () => {
    vi.mocked(runExecFile).mockImplementation(async (_cmd: string, args: string[]) => {
      writeAscOutputs(args);
      return { stdout: '', stderr: '' };
    });

    const fileName = `${wasmFile}-recomp`;
    await compileWasm({ fileName, sourceCode: 'v1', isDev: true });
    await compileWasm({ fileName, sourceCode: 'v2', isDev: true });

    expect(vi.mocked(runExecFile)).toHaveBeenCalledTimes(2);
  });

  it('throws CompilerError on asc error', async () => {
    vi.mocked(runExecFile).mockResolvedValue({ stdout: '', stderr: 'ERROR: syntax error' });

    await expect(compileWasm({ fileName: `${wasmFile}-err`, sourceCode: 'invalid as source' })).rejects.toThrow('Error en compilacion');
  });

  it('throws when required output files are missing', async () => {
    await expect(compileWasm({ fileName: `${wasmFile}-missing`, sourceCode: 'export function _start(): void {} // missing-output-test' })).rejects.toThrow(
      'No se generaron',
    );
  });

  it('passes correct args for dev mode', async () => {
    await compileWasm({
      fileName: `${wasmFile}-dev`,
      sourceCode: 'export function _start(): void {} // dev-test',
      isDev: true,
      sourceMap: true,
    }).catch(() => {});

    expect(vi.mocked(runExecFile)).toHaveBeenCalled();
    const [cmd, args] = vi.mocked(runExecFile).mock.calls[0];
    expect(cmd).toMatch(/node_modules[\\/]\.bin[\\/]asc$|^asc$/);
    expect(args).toContain('--debug');
    expect(args).toContain('--sourceMap');
  });

  it('passes correct args for release mode', async () => {
    await compileWasm({
      fileName: `${wasmFile}-rel`,
      sourceCode: 'export function _start(): void {} // release-test',
      isDev: false,
      optimizeLevel: 2,
      shrinkLevel: 1,
    }).catch(() => {});

    const [cmd, args] = vi.mocked(runExecFile).mock.calls[0];
    expect(cmd).toMatch(/node_modules[\\/]\.bin[\\/]asc$|^asc$/);
    expect(args).toContain('--optimize');
    expect(args).toContain('--optimizeLevel');
    expect(args).toContain('2');
    expect(args).toContain('--shrinkLevel');
    expect(args).toContain('1');
  });
});

describe('rewriteBindingImports', () => {
  const bindingsDir = '/repo/packages/compiler/dist/bindings';
  const sourceDir = '/repo/examples/as-fs/src';

  it('rewrites bare console/fs/wasi imports to relative .ts paths preserving quotes', () => {
    const src = "import { log } from 'console';\nimport { readFile } from 'fs';\nimport { stdoutWrite } from 'wasi';\n";
    const out = rewriteBindingImports(src, bindingsDir, sourceDir);
    expect(out).toBe(
      "import { log } from '../../../packages/compiler/dist/bindings/console.ts';\n" +
        "import { readFile } from '../../../packages/compiler/dist/bindings/fs.ts';\n" +
        "import { stdoutWrite } from '../../../packages/compiler/dist/bindings/wasi.ts';\n",
    );
  });

  it('preserves double-quoted specifiers', () => {
    const src = 'import { log } from "console";';
    const out = rewriteBindingImports(src, bindingsDir, sourceDir);
    expect(out).toBe('import { log } from "../../../packages/compiler/dist/bindings/console.ts";');
  });

  it('prefixes ./ when bindings live inside the source dir', () => {
    const out = rewriteBindingImports("import { log } from 'console';", '/repo/src/bindings', '/repo/src');
    expect(out).toBe("import { log } from './bindings/console.ts';");
  });

  it('leaves relative imports untouched', () => {
    const src = "import { x } from './console';\nimport { y } from '../fs';\n";
    expect(rewriteBindingImports(src, bindingsDir, sourceDir)).toBe(src);
  });

  it('leaves unknown bare imports untouched', () => {
    const src = "import { z } from 'lodash';\n";
    expect(rewriteBindingImports(src, bindingsDir, sourceDir)).toBe(src);
  });

  it('emits only forward-slash separators', () => {
    const out = rewriteBindingImports("import { log } from 'console';", bindingsDir, sourceDir);
    expect(out).not.toContain('\\');
  });
});

describe('compileWasm binding import rewrite wiring', () => {
  it('writes bare binding imports rewritten to relative paths in the temp source', async () => {
    let tempSource = '';
    vi.mocked(runExecFile).mockImplementation(async (_cmd: string, args: string[]) => {
      // Capturar el fuente temp ANTES del cleanup del finally
      const srcFile = args[0];
      if (typeof srcFile === 'string' && srcFile.endsWith('source.ts')) {
        tempSource = fs.readFileSync(srcFile, 'utf-8');
      }
      writeAscOutputs(args);
      return { stdout: '', stderr: '' };
    });

    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-test-'));
    const wasmFile2 = path.join(tmpDir2, 'test.wasm.ts');
    fs.writeFileSync(wasmFile2, 'placeholder');
    await compileWasm({
      fileName: `${wasmFile2}-rewrite`,
      sourceCode: "import { log } from 'console';\nexport function _start(): void { log('hi'); }\n",
      isDev: true,
    });
    fs.rmSync(tmpDir2, { recursive: true, force: true });

    expect(tempSource).toContain('console.ts');
    expect(tempSource).not.toContain("from 'console'");
  });
});
