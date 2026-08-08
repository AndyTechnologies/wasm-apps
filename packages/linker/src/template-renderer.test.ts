import { describe, it, expect } from 'vitest';
import { renderTemplate } from './template-renderer.js';
import type { NunjucksTemplateContext } from './template-context.js';

function minimalContext(overrides?: Partial<NunjucksTemplateContext>): NunjucksTemplateContext {
  return {
    moduleName: 'test-app',
    entryPoint: 'instance0',
    entryFunctionName: '_start',
    escapedEntryFunctionName: '_start',
    wasi: false,
    wasmtimeVersion: '46.0.1',
    modules: [
      {
        index: 0,
        varName: 'wasm_bytes_0',
        lenVar: 'wasm_len_0',
        moduleVar: 'mod0',
        instanceVar: 'instance0',
        bufferHex: '    0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00',
        bufferLength: 8,
        exports: [{ name: '_start', kind: 'function', escapedName: '_start', safeName: '_start' }],
      },
    ],
    hostFunctions: [],
    globals: [],
    mounts: [],
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('renders C++ preamble from default template', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('#include <wasmtime.hh>');
    expect(output).toContain('using namespace wasmtime;');
    expect(output).toContain('_check_result');
    expect(output).toContain('_check_trap');
    expect(output).toContain('_wasm_rng');
  });

  it('renders _readAsString and _readAsStringNT helpers', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('_readAsString(Caller& caller, int32_t ptr)');
    expect(output).toContain('_readAsStringNT(Caller& caller, int32_t ptr)');
  });

  it('renders module buffer arrays', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('const unsigned char wasm_bytes_0[]');
    expect(output).toContain('0x00,0x61,0x73,0x6d');
    expect(output).toContain('const size_t wasm_len_0 = 8');
  });

  it('renders define_exports function', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('static int define_exports(Linker &linker');
    expect(output).toContain('instance0');
    expect(output).toContain('"_start"');
  });

  it('renders main function with engine/store/linker', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('int main(int argc, char *argv[])');
    expect(output).toContain('Engine engine;');
    expect(output).toContain('Store store(engine);');
    expect(output).toContain('Linker linker(engine);');
  });

  it('includes WASI config when wasi is true', () => {
    const ctx = minimalContext({ wasi: true });
    const output = renderTemplate(ctx);
    expect(output).toContain('WasiConfig wasi_config');
    expect(output).toContain('define_wasi');
  });

  it('does not include WASI config when wasi is false', () => {
    const ctx = minimalContext({ wasi: false });
    const output = renderTemplate(ctx);
    expect(output).not.toContain('WasiConfig');
  });

  it('renders module compilation', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('Module::compile(engine');
    expect(output).toContain('wasm_bytes_0');
  });

  it('renders module instantiation', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('_check_trap(linker.instantiate(ctx');
    expect(output).toContain('define_exports(linker, ctx, instance0, "instance0")');
  });

  it('renders entry point call', () => {
    const ctx = minimalContext();
    const output = renderTemplate(ctx);
    expect(output).toContain('entry_func.call(ctx, {})');
    expect(output).toContain('return 0;');
  });

  it('does not HTML-escape C++ code (autoescape is false)', () => {
    const ctx = minimalContext({
      hostFunctions: [
        {
          module: 'env',
          name: 'my_func',
          escapedModule: 'env',
          escapedName: 'my_func',
          params: ['i32'],
          results: ['i32'],
          funcTypeCpp: 'FuncType::from_iters(std::vector<ValType>{ValType::i32()}, std::vector<ValType>{ValType::i32()})',
          body: '    results[0] = Val(int32_t(42));\n    return std::monostate{};',
        },
      ],
    });
    const output = renderTemplate(ctx);
    // C++ angle brackets and ampersands should NOT be escaped to HTML entities
    expect(output).toContain('std::vector<ValType>');
    expect(output).not.toContain('&lt;');
    expect(output).not.toContain('&gt;');
    expect(output).not.toContain('&amp;');
  });

  it('renders host functions with funcTypeCpp and body', () => {
    const ctx = minimalContext({
      hostFunctions: [
        {
          module: 'env',
          name: 'my_func',
          escapedModule: 'env',
          escapedName: 'my_func',
          params: ['i32'],
          results: ['i32'],
          funcTypeCpp: 'FuncType::from_iters(std::vector<ValType>{ValType::i32()}, std::vector<ValType>{ValType::i32()})',
          body: '    results[0] = Val(int32_t(42));\n    return std::monostate{};',
        },
      ],
    });
    const output = renderTemplate(ctx);
    expect(output).toContain('my_func');
    expect(output).toContain('FuncType::from_iters');
    expect(output).toContain('results[0] = Val(int32_t(42))');
  });

  it('renders globals when provided', () => {
    const ctx = minimalContext({
      globals: [
        {
          module: 'env',
          name: 'Math.PI',
          escapedModule: 'env',
          escapedName: 'Math.PI',
          cppValue: 'Val(double(3.141592653589793))',
        },
      ],
    });
    const output = renderTemplate(ctx);
    expect(output).toContain('Math.PI');
    expect(output).toContain('3.141592653589793');
  });

  it('renders multiple modules', () => {
    const ctx = minimalContext({
      modules: [
        {
          index: 0,
          varName: 'wasm_bytes_0',
          lenVar: 'wasm_len_0',
          moduleVar: 'mod0',
          instanceVar: 'instance0',
          bufferHex: '    0x00,0x61,0x73,0x6d',
          bufferLength: 4,
          exports: [{ name: 'helper', kind: 'function', escapedName: 'helper', safeName: 'helper' }],
        },
        {
          index: 1,
          varName: 'wasm_bytes_1',
          lenVar: 'wasm_len_1',
          moduleVar: 'mod1',
          instanceVar: 'instance1',
          bufferHex: '    0x00,0x61,0x73,0x6d',
          bufferLength: 4,
          exports: [{ name: '_start', kind: 'function', escapedName: '_start', safeName: '_start' }],
        },
      ],
    });
    const output = renderTemplate(ctx);
    expect(output).toContain('wasm_bytes_0');
    expect(output).toContain('wasm_bytes_1');
    expect(output).toContain('mod0');
    expect(output).toContain('mod1');
    expect(output).toContain('instance0');
    expect(output).toContain('instance1');
  });

  it('renders define_exports for all modules with exports', () => {
    const ctx = minimalContext({
      modules: [
        {
          index: 0,
          varName: 'wasm_bytes_0',
          lenVar: 'wasm_len_0',
          moduleVar: 'mod0',
          instanceVar: 'instance0',
          bufferHex: '    0x00,0x61,0x73,0x6d',
          bufferLength: 4,
          exports: [
            { name: 'helper', kind: 'function', escapedName: 'helper', safeName: 'helper' },
            { name: 'some-func', kind: 'function', escapedName: 'some-func', safeName: 'some_func' },
          ],
        },
      ],
    });
    const output = renderTemplate(ctx);
    expect(output).toContain('some-func');
    expect(output).toContain('some_func');
  });
});
