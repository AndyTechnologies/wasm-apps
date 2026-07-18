import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

vi.mock('glob', () => ({
  glob: vi.fn(),
}));
vi.mock('@wasm-apps/compiler', () => ({
  compileWasm: vi.fn(),
  getCompileCacheInfo: vi.fn(),
  clearCompileCache: vi.fn(),
}));
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
import { compileWasm } from '@wasm-apps/compiler';
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
    (glob as any).mockResolvedValue([path.join(srcDir, 'main.wasm.ts')]);
    (compileWasm as any).mockResolvedValue({
      wasmBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
      dtsContent: '',
      bindingsJs: '',
      hash: 'abc123',
    });
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

    expect(compileWasm).toHaveBeenCalledOnce();
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

  it('throws when no .wasm.ts files found', async () => {
    (glob as any).mockResolvedValue([]);
    await expect(
      buildProject({
        rootDir: tmpDir,
      }),
    ).rejects.toThrow('No se encontraron archivos');
  });
});
