import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkerError } from '@wasm-apps/types';

// Mock dependencies of native-app-builder
const mockIsBuildUpToDate = vi.hoisted(() => vi.fn());
const mockSaveBuildManifest = vi.hoisted(() => vi.fn());

vi.mock('./build-cache.js', () => ({
  isBuildUpToDate: mockIsBuildUpToDate,
  saveBuildManifest: mockSaveBuildManifest,
}));

vi.mock('./wasm-io.js', () => ({
  parseWasmModule: vi.fn().mockReturnValue({
    exports: [],
    imports: [],
    fileName: 'test.wasm',
    importFuncTypes: [],
  }),
}));

vi.mock('./wasmtime-linker-strategy.js', () => ({
  WasmtimeLinkerStrategy: class {
    link = vi.fn().mockResolvedValue('/out/test');
    name = 'wasmtime';
  },
}));

vi.mock('./default-codegen-strategy.js', () => ({
  DefaultCodegenStrategy: class {
    generate = vi.fn().mockReturnValue('generated cpp');
    name = 'default';
  },
}));

describe('NativeAppBuilder setter chain', () => {
  it('addWasmModule returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    const result = builder.addWasmModule('/path/to/module.wasm');
    expect(result).toBe(builder);
  });

  it('setEntry returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(builder.setEntry('main')).toBe(builder);
  });

  it('setOutputPath returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(builder.setOutputPath('/out/app')).toBe(builder);
  });

  it('setTarget returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(builder.setTarget('x86_64-linux')).toBe(builder);
  });

  it('chained setters configure builder correctly', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(() => {
      builder.addWasmModule('/test.wasm').setEntry('_start').setOutputPath('/out/app').setTarget('x86_64-linux').setWasi(false);
    }).not.toThrow();
    // Further verify state by checking it fails with expected error
    // (the .wasm file doesn't exist so validate() will throw LinkerError)
    await expect(builder.build()).rejects.toThrow(LinkerError);
  });

  it('setWasi returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(builder.setWasi(true)).toBe(builder);
  });

  it('setWasmtimeVersion returns this for chaining', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    expect(builder.setWasmtimeVersion('46.0.1')).toBe(builder);
  });
});

describe('NativeAppBuilder validate()', () => {
  it('throws when no WASM modules added', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder().setOutputPath('/out/app');

    await expect(builder.build()).rejects.toThrow(LinkerError);
  });

  it('throws when no output path set', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder().addWasmModule('/test.wasm');

    await expect(builder.build()).rejects.toThrow(LinkerError);
  });

  it('throws when WASM module does not exist', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder().addWasmModule('/nonexistent/module.wasm').setOutputPath('/out/app');

    await expect(builder.build()).rejects.toThrow(LinkerError);
  });
});

describe('NativeAppBuilder isCacheUpToDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no output path set', async () => {
    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder();
    const result = await builder.isCacheUpToDate();
    expect(result).toBe(false);
  });

  it('delegates to isBuildUpToDate when output path is set', async () => {
    mockIsBuildUpToDate.mockReturnValue(true);

    const { NativeAppBuilder } = await import('./native-app-builder.js');
    const builder = new NativeAppBuilder().addWasmModule('/test.wasm').setOutputPath('/out/app');

    const result = await builder.isCacheUpToDate();

    expect(mockIsBuildUpToDate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('test.wasm')]),
      '/out/app',
      expect.objectContaining({
        entry: '_start',
        wasi: false,
      }),
    );
    expect(result).toBe(true);
  });
});
