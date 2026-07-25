import { describe, it, expect } from 'vitest';
import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './toolchain-strategy.js';
// Import a value to ensure the module exists (prevents silent pass with import type)
import { TOOLCHAIN_STRATEGY_VERSION } from './toolchain-strategy.js';

describe('ToolchainStrategy module exports', () => {
  it('exports TOOLCHAIN_STRATEGY_VERSION', () => {
    expect(TOOLCHAIN_STRATEGY_VERSION).toBe(1);
  });
});

describe('ToolchainStrategy interface', () => {
  it('accepts a valid strategy implementation', () => {
    const strategy: ToolchainStrategy = {
      id: 'test-toolchain',
      extensions: ['.foo', '.bar'],
      async compile(_options: ToolchainCompileOptions): Promise<ToolchainResult> {
        return {
          wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
          fileName: 'test.foo',
          toolchainId: 'assemblyscript',
          metadata: { strategy: 'test' },
        };
      },
      async isAvailable(): Promise<boolean> {
        return true;
      },
    };

    expect(strategy.id).toBe('test-toolchain');
    expect(strategy.extensions).toEqual(['.foo', '.bar']);
  });

  it('compile returns a valid ToolchainResult', async () => {
    const strategy: ToolchainStrategy = {
      id: 'test',
      extensions: ['.wasm.ts'],
      async compile(_options: ToolchainCompileOptions): Promise<ToolchainResult> {
        return {
          wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
          fileName: 'input.wasm.ts',
          toolchainId: 'rust',
          metadata: { binarySize: 4 },
        };
      },
      async isAvailable(): Promise<boolean> {
        return false;
      },
    };

    const options: ToolchainCompileOptions = {
      sourceCode: 'export function main(): void {}',
      fileName: 'input.wasm.ts',
      compilerOptions: {
        release: true,
        optimizeLevel: 3,
      },
    };

    const result = await strategy.compile(options);
    expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
    expect(result.wasmBytes).toHaveLength(4);
    expect(result.fileName).toBe('input.wasm.ts');
    expect(result.toolchainId).toBe('rust');
    expect(result.metadata).toEqual({ binarySize: 4 });
  });

  it('isAvailable returns a boolean', async () => {
    const strategy: ToolchainStrategy = {
      id: 'checker',
      extensions: [],
      async compile(): Promise<ToolchainResult> {
        return {
          wasmBytes: new Uint8Array(),
          fileName: 'empty',
          toolchainId: 'assemblyscript',
        };
      },
      async isAvailable(): Promise<boolean> {
        return false;
      },
    };

    expect(await strategy.isAvailable()).toBe(false);
  });
});

describe('ToolchainCompileOptions', () => {
  it('accepts minimal options', () => {
    const opts: ToolchainCompileOptions = {
      sourceCode: '',
      fileName: 'empty.ts',
    };
    expect(opts.sourceCode).toBe('');
    expect(opts.fileName).toBe('empty.ts');
    expect(opts.compilerOptions).toBeUndefined();
  });

  it('accepts full options with compiler overrides', () => {
    const opts: ToolchainCompileOptions = {
      sourceCode: 'export function test(): i32 { return 1; }',
      fileName: 'test.wasm.ts',
      compilerOptions: {
        release: true,
        runtime: 'incremental',
        optimizeLevel: 3,
        shrinkLevel: 1,
        sourceMap: true,
      },
    };
    expect(opts.compilerOptions?.release).toBe(true);
    expect(opts.compilerOptions?.runtime).toBe('incremental');
  });
});

describe('ToolchainResult', () => {
  it('accepts minimal result', () => {
    const result: ToolchainResult = {
      wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
      fileName: 'out.wasm.ts',
      toolchainId: 'assemblyscript',
    };
    expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
    expect(result.fileName).toBe('out.wasm.ts');
    expect(result.toolchainId).toBe('assemblyscript');
    expect(result.metadata).toBeUndefined();
  });
});
