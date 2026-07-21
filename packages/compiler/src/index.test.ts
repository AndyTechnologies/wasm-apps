import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAscMain = vi.fn();
vi.mock('assemblyscript/asc', () => ({
  default: {
    main: (...args: any[]) => mockAscMain(...args),
  },
}));

vi.mock('./disk-cache.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    getCached: () => null,
    saveToCache: () => {},
  };
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { compileWasm, clearMemoryCache } from './index.js';
import { clearCompileCache } from './disk-cache.js';

describe('compileWasm', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compile-test-'));
  const wasmFile = path.join(tmpDir, 'test.wasm.ts');

  function createResult(dts: string = 'export function test(): void;') {
    return (args: string[], options: any) => {
      options.writeFile('out.wasm', Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      options.writeFile('out.js', 'module.exports = {}');
      options.writeFile('out.d.ts', dts);
      options.writeFile('out.wasm.map', '{"version":3}');
      return { error: null, stderr: '', stdout: '' };
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryCache();
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    clearCompileCache(tmpDir);
    fs.writeFileSync(wasmFile, 'export function _start(): void {}');
    mockAscMain.mockResolvedValue({
      error: null,
      stderr: '',
      stdout: '',
    });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns compile result with all fields', async () => {
    mockAscMain.mockImplementation(createResult('export function _start(): void;'));

    const result = await compileWasm({
      fileName: `${wasmFile}-1`,
      sourceCode: 'export function _start(): void {}',
      isDev: true,
    });

    expect(result.wasmBytes).toBeDefined();
    expect(result.dtsContent).toBe('export function _start(): void;');
    expect(result.bindingsJs).toBe('module.exports = {}');
    expect(result.sourceMap).toBe('{"version":3}');
    expect(result.hash).toBeTruthy();
  });

  it('caches result in memory on second call', async () => {
    let callCount = 0;
    mockAscMain.mockImplementation((args: string[], options: any) => {
      callCount++;
      options.writeFile('out.wasm', Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      options.writeFile('out.js', 'module.exports = {}');
      options.writeFile('out.d.ts', '');
      return { error: null, stderr: '', stdout: '' };
    });

    const fileName = `${wasmFile}-mem`;
    await compileWasm({
      fileName,
      sourceCode: 'unique_mem_cache_test',
      isDev: true,
    });
    await compileWasm({
      fileName,
      sourceCode: 'unique_mem_cache_test',
      isDev: true,
    });

    expect(callCount).toBe(1);
  });

  it('recompiles when source changes', async () => {
    let callCount = 0;
    mockAscMain.mockImplementation((args: string[], options: any) => {
      callCount++;
      options.writeFile('out.wasm', Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      options.writeFile('out.js', 'module.exports = {}');
      options.writeFile('out.d.ts', '');
      return { error: null, stderr: '', stdout: '' };
    });

    const fileName = `${wasmFile}-recomp`;
    await compileWasm({
      fileName,
      sourceCode: 'v1',
      isDev: true,
    });
    await compileWasm({
      fileName,
      sourceCode: 'v2',
      isDev: true,
    });

    expect(callCount).toBe(2);
  });

  it('throws CompilerError on asc error', async () => {
    mockAscMain.mockResolvedValue({
      error: new Error('Parse error'),
      stderr: 'ERROR: syntax error',
      stdout: '',
    });

    await expect(
      compileWasm({
        fileName: `${wasmFile}-err`,
        sourceCode: 'invalid as source',
      }),
    ).rejects.toThrow('Error compilando');
  });

  it('throws when required output files are missing', async () => {
    mockAscMain.mockImplementation((args: string[], options: any) => {
      options.writeFile('out.wasm', Buffer.from([0x00]));
      return { error: null, stderr: '', stdout: '' };
    });

    await expect(
      compileWasm({
        fileName: `${wasmFile}-missing`,
        sourceCode: 'export function _start(): void {} // missing-output-test',
      }),
    ).rejects.toThrow('No se generaron');
  });

  it('passes correct args for dev mode', async () => {
    mockAscMain.mockImplementation(createResult());

    await compileWasm({
      fileName: `${wasmFile}-dev`,
      sourceCode: 'export function _start(): void {} // dev-test',
      isDev: true,
      sourceMap: true,
    });

    expect(mockAscMain).toHaveBeenCalled();
    const args = mockAscMain.mock.calls[0][0];
    expect(args).toContain('--debug');
    expect(args).toContain('--sourceMap');
  });

  it('passes correct args for release mode', async () => {
    mockAscMain.mockImplementation(createResult());

    await compileWasm({
      fileName: `${wasmFile}-rel`,
      sourceCode: 'export function _start(): void {} // release-test',
      isDev: false,
      optimizeLevel: 2,
      shrinkLevel: 1,
    });

    const args = mockAscMain.mock.calls[0][0];
    expect(args).toContain('--optimize');
    expect(args).toContain('--optimizeLevel');
    expect(args).toContain('2');
    expect(args).toContain('--shrinkLevel');
    expect(args).toContain('1');
  });
});
