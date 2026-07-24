import { describe, it, expect, vi } from 'vitest';
import { ToolchainRouter } from './toolchain-router.js';
import type { ToolchainStrategy, ToolchainCompileOptions, ToolchainResult } from './strategies/toolchain-strategy.js';

function createMockStrategy(id: string, extensions: string[]): ToolchainStrategy {
  return {
    id,
    extensions,
    async compile(_opts: ToolchainCompileOptions): Promise<ToolchainResult> {
      return {
        wasmBytes: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
        fileName: `output.${id}.wasm`,
        toolchainId: 'assemblyscript',
      };
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
  };
}

describe('ToolchainRouter', () => {
  it('registers and retrieves strategies by extension', () => {
    const router = new ToolchainRouter();
    const asStrategy = createMockStrategy('assemblyscript', ['.wasm.ts', '.as']);
    const cppStrategy = createMockStrategy('cpp', ['.wasm.cpp', '.wasm.cxx']);

    router.register(asStrategy);
    router.register(cppStrategy);

    expect(router.resolveForExtension('.wasm.ts')?.id).toBe('assemblyscript');
    expect(router.resolveForExtension('.wasm.cpp')?.id).toBe('cpp');
  });

  it('returns undefined when no strategy matches an extension', () => {
    const router = new ToolchainRouter();
    router.register(createMockStrategy('assemblyscript', ['.wasm.ts']));

    expect(router.resolveForExtension('.zig')).toBeUndefined();
    expect(router.resolveForExtension('.unknown')).toBeUndefined();
  });

  it('uses longest-suffix priority for extension matching', () => {
    const router = new ToolchainRouter();
    const asStrategy = createMockStrategy('assemblyscript', ['.wasm.ts', '.wasm.mjs', '.as']);
    const cppStrategy = createMockStrategy('cpp', ['.wasm.cpp', '.wasm.cxx', '.wasm.cc']);
    const rustStrategy = createMockStrategy('rust', ['.wasm.rs']);
    const precompiledStrategy = createMockStrategy('precompiled', ['.wasm']);

    router.register(asStrategy);
    router.register(cppStrategy);
    router.register(rustStrategy);
    router.register(precompiledStrategy);

    // .wasm.ts should match assemblyscript, not the generic .wasm
    expect(router.resolveForExtension('.wasm.ts')?.id).toBe('assemblyscript');
    // .wasm.cpp should match cpp, not .wasm
    expect(router.resolveForExtension('.wasm.cpp')?.id).toBe('cpp');
    // .wasm.rs should match rust
    expect(router.resolveForExtension('.wasm.rs')?.id).toBe('rust');
    // plain .wasm should match precompiled
    expect(router.resolveForExtension('.wasm')?.id).toBe('precompiled');
  });

  it('getExtension extracts the correct extension from file path', () => {
    const router = new ToolchainRouter();
    expect(router.getExtension('math.wasm.ts')).toBe('.wasm.ts');
    expect(router.getExtension('math.wasm.cpp')).toBe('.wasm.cpp');
    expect(router.getExtension('math.wasm.rs')).toBe('.wasm.rs');
    expect(router.getExtension('module.wasm')).toBe('.wasm');
    expect(router.getExtension('lib.wasm.cxx')).toBe('.wasm.cxx');
    expect(router.getExtension('script.as')).toBe('.as');
    expect(router.getExtension('noext')).toBe('');
  });

  it('compileFile compiles using the correct strategy', async () => {
    const router = new ToolchainRouter();
    const asStrategy = createMockStrategy('assemblyscript', ['.wasm.ts']);
    const compileSpy = vi.spyOn(asStrategy, 'compile');

    router.register(asStrategy);

    const result = await router.compileFile({
      sourceCode: 'export function test(): void {}',
      fileName: 'test.wasm.ts',
    });

    expect(result.wasmBytes).toBeInstanceOf(Uint8Array);
    expect(result.fileName).toBe('output.assemblyscript.wasm');
    expect(compileSpy).toHaveBeenCalledOnce();
  });

  it('compileFile throws for unsupported extension', async () => {
    const router = new ToolchainRouter();
    const asStrategy = createMockStrategy('assemblyscript', ['.wasm.ts']);
    router.register(asStrategy);

    await expect(
      router.compileFile({
        sourceCode: '',
        fileName: 'script.py',
      }),
    ).rejects.toThrow('Unsupported extension');
  });

  it('register overwrites existing strategy with same id', () => {
    const router = new ToolchainRouter();
    const v1 = createMockStrategy('test', ['.wasm.ts']);
    const v2 = createMockStrategy('test', ['.wasm.cpp', '.wasm.cxx']);

    router.register(v1);
    router.register(v2);

    // After overwrite, the new extensions should be used
    expect(router.resolveForExtension('.wasm.cpp')?.id).toBe('test');
    // The old extension is no longer handled
    expect(router.resolveForExtension('.wasm.ts')).toBeUndefined();
  });
});
