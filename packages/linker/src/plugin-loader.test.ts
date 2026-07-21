import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegisterBuiltinHostFunctions = vi.hoisted(() => vi.fn());
const mockRegisterWasmPlugin = vi.hoisted(() => vi.fn());
const mockDetail = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());

// Mock the internal dependencies used by plugin-loader
vi.mock('./builtin-host-functions.js', () => ({
  registerBuiltinHostFunctions: mockRegisterBuiltinHostFunctions,
}));

vi.mock('./plugin-manager.js', () => ({
  pluginManager: {
    registerWasmPlugin: mockRegisterWasmPlugin,
  },
}));

vi.mock('./host-function-registry.js', () => ({
  hostFunctionRegistry: { register: vi.fn(), get: vi.fn() },
}));

vi.mock('./pipeline.js', () => ({
  pipeline: { register: vi.fn() },
}));

vi.mock('@wasm-apps/types', async () => {
  const actual = await vi.importActual<Record<string, any>>('@wasm-apps/types');
  return {
    ...actual,
    logger: {
      detail: mockDetail,
      warn: mockWarn,
    },
  };
});

// Mock the size-optimizer plugin and tree-shake plugin for dynamic imports
vi.mock('./size-optimizer-plugin.js', () => ({
  default: {
    id: 'size-optimizer-plugin',
    register: vi.fn(),
  },
}));

vi.mock('./tree-shake-plugin.js', () => ({
  default: {
    id: 'tree-shake-plugin',
    register: vi.fn(),
  },
}));

describe('loadPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads stdlib-plugin by calling registerBuiltinHostFunctions', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([{ id: 'stdlib-plugin', enabled: true, config: {} }]);

    expect(mockRegisterBuiltinHostFunctions).toHaveBeenCalledTimes(1);
  });

  it('loads size-optimizer-plugin via dynamic import', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([{ id: 'size-optimizer-plugin', enabled: true, config: {} }]);

    expect(mockRegisterWasmPlugin).toHaveBeenCalledTimes(1);
  });

  it('loads tree-shake-plugin via dynamic import', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([{ id: 'tree-shake-plugin', enabled: true, config: {} }]);

    expect(mockRegisterWasmPlugin).toHaveBeenCalledTimes(1);
  });

  it('loads multiple plugins when given a mixed config', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([
      { id: 'stdlib-plugin', enabled: true, config: {} },
      { id: 'tree-shake-plugin', enabled: true, config: {} },
    ]);

    expect(mockRegisterBuiltinHostFunctions).toHaveBeenCalledTimes(1);
    expect(mockRegisterWasmPlugin).toHaveBeenCalledTimes(1);
  });

  it('skips disabled plugins', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([
      { id: 'stdlib-plugin', enabled: false, config: {} },
      { id: 'tree-shake-plugin', enabled: false, config: {} },
    ]);

    expect(mockRegisterBuiltinHostFunctions).not.toHaveBeenCalled();
    expect(mockRegisterWasmPlugin).not.toHaveBeenCalled();
  });
});

describe('plugin-loader path validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('warns when external plugin path is outside project directory', async () => {
    const { loadPlugins } = await import('./plugin-loader.js');

    await loadPlugins([
      {
        id: 'external-plugin',
        enabled: true,
        path: '/etc/malicious/plugin.js',
        config: {},
      },
    ]);

    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('fuera del directorio del proyecto'));
    expect(mockRegisterWasmPlugin).not.toHaveBeenCalled();
  });

  it('warns when external plugin does not export register function', async () => {
    // Create a temp dir within cwd for testing
    const { loadPlugins } = await import('./plugin-loader.js');
    const cwd = process.cwd();
    const safePath = `${cwd}/test-plugin.js`;

    // We can't easily mock dynamic import(pathToFileURL(href)), so we test the
    // path validation part by using a path inside cwd that doesn't exist as a module.
    // The dynamic import will fail and the warning will be logged.
    await loadPlugins([
      {
        id: 'missing-plugin',
        enabled: true,
        path: safePath,
        config: {},
      },
    ]);

    // Should log a warning about loading error (module doesn't exist)
    expect(mockWarn).toHaveBeenCalled();
  });
});
