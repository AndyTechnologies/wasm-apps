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
import { compileWasm, clearMemoryCache } from './index.js';
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
    expect(cmd).toBe('asc');
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
    expect(cmd).toBe('asc');
    expect(args).toContain('--optimize');
    expect(args).toContain('--optimizeLevel');
    expect(args).toContain('2');
    expect(args).toContain('--shrinkLevel');
    expect(args).toContain('1');
  });
});
