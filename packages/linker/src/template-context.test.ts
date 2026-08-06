import { describe, it, expect } from 'vitest';
import type { NunjucksTemplateContext, TemplateModuleEntry, TemplateHostFunctionEntry, TemplateGlobalEntry } from './template-context.js';
import { TEMPLATE_CONTEXT_VERSION } from './template-context.js';

describe('TEMPLATE_CONTEXT_VERSION', () => {
  it('exports version 1', () => {
    expect(TEMPLATE_CONTEXT_VERSION).toBe(1);
  });
});

describe('TemplateModuleEntry', () => {
  it('accepts a valid module entry', () => {
    const entry: TemplateModuleEntry = {
      index: 0,
      varName: 'wasm_bytes_0',
      lenVar: 'wasm_len_0',
      moduleVar: 'mod0',
      instanceVar: 'instance0',
      bufferHex: '0x00,0x61,0x73,0x6d',
      bufferLength: 4,
      exports: [{ name: '_start', kind: 'function' }],
    };
    expect(entry.index).toBe(0);
    expect(entry.varName).toBe('wasm_bytes_0');
    expect(entry.lenVar).toBe('wasm_len_0');
    expect(entry.exports).toHaveLength(1);
    expect(entry.exports[0].name).toBe('_start');
  });

  it('accepts module without exports', () => {
    const entry: TemplateModuleEntry = {
      index: 1,
      varName: 'wasm_bytes_1',
      lenVar: 'wasm_len_1',
      moduleVar: 'mod1',
      instanceVar: 'instance1',
      bufferHex: '',
      bufferLength: 0,
    };
    expect(entry.exports).toBeUndefined();
  });
});

describe('TemplateHostFunctionEntry', () => {
  it('accepts a valid host function entry', () => {
    const entry: TemplateHostFunctionEntry = {
      module: 'wasi_snapshot_preview1',
      name: 'fd_write',
      params: ['i32', 'i32', 'i32', 'i32'],
      results: ['i32'],
      body: '// fd_write stub',
      funcTypeCpp:
        'FuncType::from_iters(std::vector<ValType>{ValType::i32(), ValType::i32(), ValType::i32(), ValType::i32()}, std::vector<ValType>{ValType::i32()})',
    };
    expect(entry.module).toBe('wasi_snapshot_preview1');
    expect(entry.name).toBe('fd_write');
    expect(entry.params).toHaveLength(4);
  });
});

describe('TemplateGlobalEntry', () => {
  it('accepts a valid global entry', () => {
    const entry: TemplateGlobalEntry = {
      module: 'env',
      name: 'Math.PI',
      cppValue: 'Val(double(3.141592653589793))',
    };
    expect(entry.cppValue).toContain('3.141592653589793');
  });
});

describe('NunjucksTemplateContext', () => {
  it('accepts a full context', () => {
    const context: NunjucksTemplateContext = {
      moduleName: 'wasm-linker',
      entryPoint: 'instance0',
      wasi: false,
      wasmtimeVersion: '26.0.0',
      modules: [
        {
          index: 0,
          varName: 'wasm_bytes_0',
          lenVar: 'wasm_len_0',
          moduleVar: 'mod0',
          instanceVar: 'instance0',
          bufferHex: '0x00,0x61,0x73,0x6d',
          bufferLength: 4,
          exports: [{ name: '_start', kind: 'function' }],
        },
      ],
      hostFunctions: [
        {
          module: 'env',
          name: 'random',
          params: [],
          results: ['f64'],
          body: '    results[0] = Val(double(42));\n    return std::monostate{};',
          funcTypeCpp: 'FuncType::from_iters(std::vector<ValType>{}, std::vector<ValType>{ValType::f64()})',
        },
      ],
      globals: [
        {
          module: 'env',
          name: 'Math.PI',
          cppValue: 'Val(double(3.141592653589793))',
        },
      ],
    };

    expect(context.moduleName).toBe('wasm-linker');
    expect(context.modules).toHaveLength(1);
    expect(context.hostFunctions).toHaveLength(1);
    expect(context.globals).toHaveLength(1);
    expect(context.wasi).toBe(false);
    expect(context.wasmtimeVersion).toBe('26.0.0');
  });

  it('accepts minimal context (empty arrays, wasi: true)', () => {
    const context: NunjucksTemplateContext = {
      moduleName: 'my-app',
      entryPoint: 'instance0',
      wasi: true,
      wasmtimeVersion: '26.0.0',
      modules: [],
      hostFunctions: [],
      globals: [],
      mounts: [],
    };

    expect(context.modules).toEqual([]);
    expect(context.wasi).toBe(true);
  });
});
