import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

vi.mock('glob', () => ({
  glob: vi.fn(),
}));
vi.mock('@wasm-apps/compiler', () => {
  const mockCompileAssemblyScript = vi.fn().mockResolvedValue({
    wasmBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
    fileName: 'main.wasm.ts',
    toolchainId: 'assemblyscript',
    metadata: { hash: 'abc123' },
  });

  const mockCompileCpp = vi.fn().mockResolvedValue({
    wasmBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
    fileName: 'hello.wasm.cpp',
    toolchainId: 'cpp',
  });

  const mockCompileRust = vi.fn().mockResolvedValue({
    wasmBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
    fileName: 'world.wasm.rs',
    toolchainId: 'rust',
  });

  const mockCompilePrecompiled = vi.fn().mockResolvedValue({
    wasmBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
    fileName: 'helper.wasm',
    toolchainId: 'precompiled',
  });

  return {
    compileWasm: vi.fn(),
    getCompileCacheInfo: vi.fn(),
    clearCompileCache: vi.fn(),
    computeToolchainKey: vi.fn(),
    ToolchainRouter: vi.fn(function () {
      return {
        registerBuiltins: vi.fn(),
        getExtension: vi.fn(function (filePath: string) {
          if (/\.wasm\.(ts|mjs|as)$/i.test(filePath)) return '.wasm.ts';
          if (/\.wasm\.(cpp|cxx|cc)$/i.test(filePath)) return '.wasm.cpp';
          if (/\.wasm\.rs$/i.test(filePath)) return '.wasm.rs';
          if (/\.wasm$/i.test(filePath) && !/\.wasm\./.test(filePath)) return '.wasm';
          return '';
        }),
        resolveForExtension: vi.fn(function (ext: string) {
          const strategies: Record<string, any> = {
            '.wasm.ts': {
              id: 'assemblyscript',
              extensions: ['.wasm.ts', '.wasm.mjs', '.as'],
              compile: mockCompileAssemblyScript,
              isAvailable: vi.fn().mockResolvedValue(true),
            },
            '.wasm.cpp': {
              id: 'cpp',
              extensions: ['.wasm.cpp', '.wasm.cxx', '.wasm.cc'],
              compile: mockCompileCpp,
              isAvailable: vi.fn().mockResolvedValue(true),
            },
            '.wasm.rs': {
              id: 'rust',
              extensions: ['.wasm.rs'],
              compile: mockCompileRust,
              isAvailable: vi.fn().mockResolvedValue(true),
            },
            '.wasm': {
              id: 'precompiled',
              extensions: ['.wasm'],
              compile: mockCompilePrecompiled,
              isAvailable: vi.fn().mockResolvedValue(true),
            },
          };
          return strategies[ext] || undefined;
        }),
      };
    }),
    AssemblyScriptToolchainStrategy: vi.fn(),
    CppCompilerStrategy: vi.fn(),
    RustCompilerStrategy: vi.fn(),
    PrecompiledWasmStrategy: vi.fn(),
  };
});
vi.mock('@wasm-apps/linker', () => ({
  createNativeApp: vi.fn(),
  runSetup: vi.fn(),
  getCacheInfo: vi.fn(),
  clearCache: vi.fn(),
  checkSetupStatus: vi.fn(),
  getBuildCacheInfo: vi.fn(),
  clearBuildCache: vi.fn(),
  loadPlugins: vi.fn(),
  pipeline: { runPhase: vi.fn() },
  PipelinePhase: {},
}));

import { glob } from 'glob';
import { createNativeApp, loadPlugins, pipeline } from '@wasm-apps/linker';
import { resolveConfig, initProject, buildProject } from './index.js';

describe('resolveConfig', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));

  afterEach(() => {
    const configPath = path.join(tmpDir, 'wapp.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  });

  it('returns defaults when no config file', () => {
    const config = resolveConfig(tmpDir);
    expect(config.sourceDir).toBe('src');
    expect(config.entry).toBe('_start');
    expect(config.moduleMatching).toBe('file-name');
    expect(config.compiler?.release).toBe(false);
  });

  it('merges config file with defaults', () => {
    fs.writeFileSync(path.join(tmpDir, 'wapp.json'), JSON.stringify({ sourceDir: 'custom-src', entry: 'main' }));
    const config = resolveConfig(tmpDir);
    expect(config.sourceDir).toBe('custom-src');
    expect(config.entry).toBe('main');
    expect(config.moduleMatching).toBe('file-name');
  });

  it('overrides with provided options', () => {
    const config = resolveConfig(tmpDir, { entry: 'override_entry', wasi: true });
    expect(config.entry).toBe('override_entry');
    expect(config.wasi).toBe(true);
  });

  it('throws ConfigError on invalid config file', () => {
    fs.writeFileSync(path.join(tmpDir, 'wapp.json'), 'not-json');
    expect(() => resolveConfig(tmpDir)).toThrow();
  });
});

describe('initProject', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-test-'));

  afterEach(() => {
    const configPath = path.join(tmpDir, 'wapp.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  });

  it('creates wapp.json with defaults', () => {
    const config = initProject(tmpDir);
    const configPath = path.join(tmpDir, 'wapp.json');
    expect(fs.existsSync(configPath)).toBe(true);
    expect(config.sourceDir).toBe('src');
    expect(config.entry).toBe('_start');
  });

  it('accepts overrides', () => {
    fs.rmSync(path.join(tmpDir, 'wapp.json'), { force: true });
    const config = initProject(tmpDir, { entry: 'custom_start', wasi: true });
    expect(config.entry).toBe('custom_start');
    expect(config.wasi).toBe(true);
  });

  it('throws if wapp.json already exists', () => {
    initProject(tmpDir);
    expect(() => initProject(tmpDir)).toThrow();
  });

  it('creates directory if it does not exist', () => {
    const newDir = path.join(tmpDir, 'subdir');
    const config = initProject(newDir, { entry: 'new_entry' });
    expect(fs.existsSync(newDir)).toBe(true);
    expect(config.entry).toBe('new_entry');
    fs.rmSync(newDir, { recursive: true, force: true });
  });
});

describe('buildProject', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-build-test-'));
  const srcDir = path.join(tmpDir, 'src');
  const outDir = path.join(tmpDir, 'wasm-out');

  beforeEach(() => {
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    vi.clearAllMocks();
    // glob is called twice: first for compiled extensions, second for precompiled .wasm
    (glob as any).mockResolvedValueOnce([path.join(srcDir, 'main.wasm.ts')]).mockResolvedValueOnce([]);
    (createNativeApp as any).mockResolvedValue(undefined);
    (loadPlugins as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('compiles and links successfully', async () => {
    fs.writeFileSync(path.join(srcDir, 'main.wasm.ts'), 'export function _start(): void {}');

    await buildProject({
      rootDir: tmpDir,
      entry: '_start',
    });

    // Verify output wasm file was created
    expect(fs.existsSync(path.join(outDir, 'main.wasm'))).toBe(true);
    expect(createNativeApp).toHaveBeenCalledOnce();
    expect(createNativeApp).toHaveBeenCalledWith(expect.objectContaining({ entry: '_start', wasi: false }));
  });

  it('passes wasi flag to createNativeApp', async () => {
    fs.writeFileSync(path.join(tmpDir, 'wapp.json'), JSON.stringify({ wasi: true }));
    fs.writeFileSync(path.join(srcDir, 'main.wasm.ts'), 'export function _start(): void {}');

    await buildProject({
      rootDir: tmpDir,
    });

    expect(createNativeApp).toHaveBeenCalledWith(expect.objectContaining({ wasi: true }));
  });

  it('throws when source dir does not exist', async () => {
    const badDir = path.join(tmpDir, 'nonexistent');
    await expect(
      buildProject({
        rootDir: tmpDir,
        sourceDir: badDir,
      }),
    ).rejects.toThrow('no existe');
  });

  it('throws when no source files found', async () => {
    (glob as any).mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(
      buildProject({
        rootDir: tmpDir,
      }),
    ).rejects.toThrow('No se encontraron archivos fuente');
  });

  it('discovers and compiles C++ source files', async () => {
    fs.writeFileSync(path.join(srcDir, 'hello.wasm.cpp'), 'extern "C" { void _start() {} }');

    (glob as any)
      .mockReset()
      .mockResolvedValueOnce([path.join(srcDir, 'hello.wasm.cpp')])
      .mockResolvedValueOnce([]);

    await buildProject({
      rootDir: tmpDir,
      entry: '_start',
    });

    expect(fs.existsSync(path.join(outDir, 'hello.cpp.wasm'))).toBe(true);
    expect(createNativeApp).toHaveBeenCalledOnce();
  });

  it('discovers and compiles Rust source files', async () => {
    fs.writeFileSync(path.join(srcDir, 'world.wasm.rs'), 'fn main() {}');

    (glob as any)
      .mockReset()
      .mockResolvedValueOnce([path.join(srcDir, 'world.wasm.rs')])
      .mockResolvedValueOnce([]);

    await buildProject({
      rootDir: tmpDir,
      entry: '_start',
    });

    expect(fs.existsSync(path.join(outDir, 'world.rust.wasm'))).toBe(true);
    expect(createNativeApp).toHaveBeenCalledOnce();
  });

  it('discovers precompiled .wasm files', async () => {
    // Create a valid binary .wasm file (just magic bytes + basic content)
    const wasmBuffer = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    fs.writeFileSync(path.join(srcDir, 'helper.wasm'), wasmBuffer);

    (glob as any)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([path.join(srcDir, 'helper.wasm')]);

    await buildProject({
      rootDir: tmpDir,
      entry: '_start',
    });

    expect(fs.existsSync(path.join(outDir, 'helper.wasm'))).toBe(true);
    expect(createNativeApp).toHaveBeenCalledOnce();
  });
});
