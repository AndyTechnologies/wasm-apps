import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from './plugin-manager.js';
import type { ICompilerStrategy, ILinkerStrategy, ICodegenStrategy, WasmPlugin } from '@wasm-apps/types';

// Mock plugin-loader to avoid dynamic imports and circular dependencies
vi.mock('./plugin-loader.js', () => ({
  loadPlugins: vi.fn().mockResolvedValue(undefined),
}));

function makeCompilerStrategy(name = 'test-compiler'): ICompilerStrategy {
  return { name, compile: vi.fn() as any, getVersion: () => '1.0' };
}

function makeLinkerStrategy(name = 'test-linker'): ILinkerStrategy {
  return { name, link: vi.fn() as any, getVersion: () => '1.0' };
}

function makeCodegenStrategy(name = 'test-codegen'): ICodegenStrategy {
  return { name, generate: vi.fn() as any, getVersion: () => '1.0' };
}

function makeWasmPlugin(id = 'test-plugin'): WasmPlugin {
  return { id, register: vi.fn() };
}

describe('PluginManager', () => {
  let pm: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pm = new PluginManager();
  });

  describe('loadWasmPlugins', () => {
    it('loadWasmPlugins es una función async', () => {
      expect(typeof pm.loadWasmPlugins).toBe('function');
    });

    it('loadWasmPlugins completa sin error con config vacío', async () => {
      await expect(pm.loadWasmPlugins([])).resolves.toBeUndefined();
    });

    it('loadWasmPlugins llama a loadPlugins subyacente', async () => {
      const { loadPlugins } = await import('./plugin-loader.js');
      await pm.loadWasmPlugins([]);
      expect(loadPlugins).toHaveBeenCalledWith([]);
    });
  });

  describe('register/get compiler plugins', () => {
    it('registerCompiler and getCompiler', () => {
      const plugin = makeCompilerStrategy('cpp-compiler');
      pm.registerCompiler(plugin);
      expect(pm.getCompiler('cpp-compiler')).toBe(plugin);
    });

    it('getCompiler returns undefined for unknown name', () => {
      expect(pm.getCompiler('nonexistent')).toBeUndefined();
    });

    it('getAvailableCompilers returns registered names', () => {
      pm.registerCompiler(makeCompilerStrategy('clang'));
      pm.registerCompiler(makeCompilerStrategy('gcc'));
      const names = pm.getAvailableCompilers();
      expect(names).toContain('clang');
      expect(names).toContain('gcc');
      expect(names).toHaveLength(2);
    });

    it('registerCompiler overwrites existing entry with same name', () => {
      const original = makeCompilerStrategy('custom');
      const replacement = makeCompilerStrategy('custom');
      pm.registerCompiler(original);
      pm.registerCompiler(replacement);
      expect(pm.getCompiler('custom')).toBe(replacement);
    });
  });

  describe('register/get linker plugins', () => {
    it('registerLinker and getLinker', () => {
      const plugin = makeLinkerStrategy('wasm-linker');
      pm.registerLinker(plugin);
      expect(pm.getLinker('wasm-linker')).toBe(plugin);
    });

    it('getLinker returns undefined for unknown name', () => {
      expect(pm.getLinker('nonexistent')).toBeUndefined();
    });

    it('getAvailableLinkers returns registered names', () => {
      pm.registerLinker(makeLinkerStrategy('lld'));
      pm.registerLinker(makeLinkerStrategy('wasm-ld'));
      const names = pm.getAvailableLinkers();
      expect(names).toContain('lld');
      expect(names).toContain('wasm-ld');
    });
  });

  describe('register/get codegen plugins', () => {
    it('registerCodegen and getCodegen', () => {
      const plugin = makeCodegenStrategy('cpp-codegen');
      pm.registerCodegen(plugin);
      expect(pm.getCodegen('cpp-codegen')).toBe(plugin);
    });

    it('getCodegen returns undefined for unknown name', () => {
      expect(pm.getCodegen('nonexistent')).toBeUndefined();
    });

    it('getAvailableCodegens returns registered names', () => {
      pm.registerCodegen(makeCodegenStrategy('c-codegen'));
      pm.registerCodegen(makeCodegenStrategy('rust-codegen'));
      const names = pm.getAvailableCodegens();
      expect(names).toContain('c-codegen');
      expect(names).toContain('rust-codegen');
    });
  });

  describe('register/get wasm plugins', () => {
    it('registerWasmPlugin and getWasmPlugin', () => {
      const plugin = makeWasmPlugin('stdlib-plugin');
      pm.registerWasmPlugin(plugin);
      expect(pm.getWasmPlugin('stdlib-plugin')).toBe(plugin);
    });

    it('getWasmPlugin returns undefined for unknown id', () => {
      expect(pm.getWasmPlugin('nonexistent')).toBeUndefined();
    });

    it('registerWasmPlugin overwrites existing plugin with same id', () => {
      const original = makeWasmPlugin('dup-plugin');
      const replacement = makeWasmPlugin('dup-plugin');
      pm.registerWasmPlugin(original);
      pm.registerWasmPlugin(replacement);
      expect(pm.getWasmPlugin('dup-plugin')).toBe(replacement);
    });
  });
});
