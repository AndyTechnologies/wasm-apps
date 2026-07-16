import os from 'node:os';
import type { ResolvedLink, WasmImportFuncType } from '@wasm-apps/types';
import { hostFunctionRegistry } from './host-function-registry.js';

const VALTYPE_TO_CPP: Record<string, string> = {
  i32: 'ValType::i32()',
  i64: 'ValType::i64()',
  f32: 'ValType::f32()',
  f64: 'ValType::f64()',
};

const VALTYPE_TO_SET: Record<string, string> = {
  i32: 'Val(int32_t(',
  i64: 'Val(int64_t(',
  f32: 'Val(float(',
  f64: 'Val(double(',
};

function funcTypeCpp(params: string[], results: string[]): string {
  const p = params.map(t => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  const r = results.map(t => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  return `FuncType::from_iters(std::vector<ValType>{${p}}, std::vector<ValType>{${r}})`;
}

function defaultResultCode(results: string[]): string {
  if (results.length === 0) return '    return std::monostate{};';
  return results.map((t, i) => `    results[${i}] = ${VALTYPE_TO_SET[t] || 'Val(int32_t('}0));`).join(os.EOL) + os.EOL + '    return std::monostate{};';
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

const MATH_CONSTANTS: Record<string, string> = {
  'Math.E': '2.718281828459045',
  'Math.LN2': '0.6931471805599453',
  'Math.LN10': '2.302585092994046',
  'Math.LOG2E': '1.4426950408889634',
  'Math.LOG10E': '0.4342944819032518',
  'Math.PI': '3.141592653589793',
  'Math.SQRT1_2': '0.7071067811865476',
  'Math.SQRT2': '1.4142135623730951',
  'globalThis': '0',
};

export function findEntryModule(link: ResolvedLink, entryPoint: string): string {
  for (const mod of link.order) {
    const found = mod.module.exports.some(e => e.name === entryPoint && e.kind === 'function');
    if (found) return `instance${mod.index}`;
  }
  throw new Error(`No se encontro la funcion de entrada '${entryPoint}' en ningun modulo.`);
}

export function validateEntryExport(link: ResolvedLink, entryPoint: string): void {
  for (const mod of link.order) {
    if (mod.module.exports.some(e => e.name === entryPoint)) return;
  }
  throw new Error(`No se encontro la exportacion '${entryPoint}' en ningun modulo compilado.`);
}

export function generateCCode(
  link: ResolvedLink,
  entryPoint: string,
  wasi: boolean,
  importFuncTypes?: WasmImportFuncType[],
): string {
  const modules = link.order;
  const moduleBuffers = modules.map(m => ({
    varName: `wasm_bytes_${m.index}`,
    lenVar: `wasm_len_${m.index}`,
    bytes: m.module.buffer,
    moduleVar: `mod${m.index}`,
    instanceVar: `instance${m.index}`,
  }));

  const neededGlobals = new Map<string, { module: string; name: string }>();

  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.module === 'wasi_snapshot_preview1' || imp.module === 'wasi_unstable') continue;

      if (imp.kind === 'global') {
        const key = `${imp.module}.${imp.name}`;
        if (!neededGlobals.has(key)) {
          neededGlobals.set(key, { module: imp.module, name: imp.name });
        }
        continue;
      }
    }
  }

  const importTypeMap = new Map<string, WasmImportFuncType>();
  if (importFuncTypes) {
    for (const ft of importFuncTypes) {
      importTypeMap.set(`${ft.module}.${ft.name}`, ft);
    }
  }

  const hostFuncs: Array<{ name: string; module: string; params: string[]; results: string[] }> = [];
  const seen = new Set<string>();
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.kind !== 'function') continue;
      const key = `${imp.module}.${imp.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (imp.module === 'env' || hostFunctionRegistry.has(imp.module, imp.name) || hostFunctionRegistry.has('env', imp.name)) {
        const ft = importTypeMap.get(key);
        if (!ft) {
          const byName = hostFunctionRegistry.getByName(imp.name);
          if (byName) {
            const altKey = `${byName.module}.${imp.name}`;
            const altFt = importTypeMap.get(altKey);
            if (altFt) {
              hostFuncs.push({ name: imp.name, module: imp.module, params: altFt.params, results: altFt.results });
            }
          }
          continue;
        }
        hostFuncs.push({ name: imp.name, module: imp.module, params: ft.params, results: ft.results });
      }
    }
  }

  let cpp = [
    '#include <wasmtime.hh>',
    '#include <iostream>',
    '#include <cstdlib>',
    '#include <cstring>',
    '#include <chrono>',
    '#include <unordered_map>',
    '#include <unordered_set>',
    '#include <random>',
    '#include <string>',
    '#include <cmath>',
    '#include <limits>',
    '#ifdef _MSC_VER',
    '#include <intrin.h>',
    '#endif',
    '',
    '#ifdef _MSC_VER',
    'static inline int _wasm_clz32(uint32_t x) {',
    '  unsigned long leading_zero;',
    '  _BitScanReverse(&leading_zero, x);',
    '  return 31 - (int)leading_zero;',
    '}',
    '#else',
    'static inline int _wasm_clz32(uint32_t x) {',
    '  return x == 0 ? 32 : __builtin_clz(x);',
    '}',
    '#endif',
    '',
    'static inline size_t _wasm_strnlen(const char* s, size_t maxlen) {',
    '  size_t n = 0;',
    '  while (n < maxlen && s[n]) ++n;',
    '  return n;',
    '}',
    '',
    'using namespace wasmtime;',
    '',
    'static std::mt19937 _wasm_rng(std::random_device{}());',
    'static std::unordered_map<std::string, std::chrono::steady_clock::time_point> _wasm_timers;',
    '',
    'static std::string _readAsString(Caller& caller, int32_t ptr) {',
    '  if (ptr <= 0) return "";',
    '  auto mem = caller.get_export("memory");',
    '  if (!mem) return "";',
    '  auto* memory = std::get_if<wasmtime::Memory>(&*mem);',
    '  if (!memory) return "";',
    '  auto ctx = caller.context();',
    '  auto span = memory->data(ctx);',
    '  auto* data = span.data();',
    '  auto sz = span.size();',
    '  if (ptr < 4 || (uint32_t)ptr > (uint32_t)sz) return "";',
    '  int32_t len = *reinterpret_cast<int32_t*>(data + ptr - 4) >> 1;',
    '  if (len < 0 || len > 65536) return "";',
    '  if (ptr + (int32_t)(len * 2) > (int32_t)sz) return "";',
    '  uint16_t* chars = reinterpret_cast<uint16_t*>(data + ptr);',
    '  std::string result;',
    '  result.reserve(len + 1);',
    '  for (int32_t i = 0; i < len; i++) {',
    '    uint16_t c = chars[i];',
    '    if (c == 0) break;',
    '    if (c < 0x80) {',
    '      result += (char)c;',
    '    } else if (c < 0x800) {',
    '      result += (char)(0xC0 | (c >> 6));',
    '      result += (char)(0x80 | (c & 0x3F));',
    '    } else {',
    '      result += (char)(0xE0 | (c >> 12));',
    '      result += (char)(0x80 | ((c >> 6) & 0x3F));',
    '      result += (char)(0x80 | (c & 0x3F));',
    '    }',
    '  }',
    '  return result;',
    '}',
    '',
    'static std::string _readAsStringNT(Caller& caller, int32_t ptr) {',
    '  if (ptr <= 0) return "";',
    '  auto mem = caller.get_export("memory");',
    '  if (!mem) return "";',
    '  auto* memory = std::get_if<wasmtime::Memory>(&*mem);',
    '  if (!memory) return "";',
    '  auto ctx = caller.context();',
    '  auto span = memory->data(ctx);',
    '  auto* data = span.data();',
    '  auto sz = span.size();',
    '  if (ptr >= (int32_t)sz) return "";',
    '  size_t mlen = _wasm_strnlen(reinterpret_cast<const char*>(data + ptr), sz - ptr);',
    '  return std::string(reinterpret_cast<const char*>(data + ptr), mlen);',
    '}',
    '',
  ].join('\n');

  for (const mb of moduleBuffers) {
    const byteStr = Array.from(mb.bytes).join(',');
    cpp += `const unsigned char ${mb.varName}[] = { ${byteStr} };\n`;
    cpp += `const size_t ${mb.lenVar} = ${mb.bytes.length};\n\n`;
  }

  cpp += 'static void define_exports(Linker &linker, Store::Context ctx, Instance instance, const char* instance_label) {\n';
  cpp += '  static std::unordered_set<std::string> _defined;\n';
  for (const mod of modules) {
    const exports = mod.module.exports;
    if (exports.length === 0) continue;
    cpp += `  if (std::strcmp(instance_label, "instance${mod.index}") == 0) {\n`;
    for (const exp of exports) {
      const safeName = sanitizeIdentifier(exp.name);
      cpp += `    if (_defined.find("${exp.name}") == _defined.end()) {\n`;
      cpp += `      _defined.insert("${exp.name}");\n`;
      cpp += `      auto exp = instance.get(ctx, "${exp.name}");\n`;
      cpp += `      if (!exp) { std::cerr << "Error obteniendo export ${safeName}" << std::endl; std::exit(1); }\n`;
      cpp += `      auto result = linker.define(ctx, "env", "${exp.name}", *exp);\n`;
      cpp += `      if (!result) { std::cerr << "Error definiendo ${safeName}" << std::endl; std::exit(1); }\n`;
      cpp += `    }\n`;
    }
    cpp += `    return;\n  }\n`;
  }
  cpp += `
  std::cerr << "Unknown instance label " << instance_label << std::endl; std::exit(1);
  }

  int main(int argc, char *argv[]) {
    Engine engine;
    Store store(engine);
    auto ctx = store.context();
    Linker linker(engine);
    
`;

  if (wasi) {
    cpp += `
    WasiConfig wasi_config;
    wasi_config.inherit_argv();
    wasi_config.inherit_stdin();
    wasi_config.inherit_stdout();
    wasi_config.inherit_stderr();
    ctx.set_wasi(std::move(wasi_config)).unwrap();
    linker.define_wasi().unwrap();
    
`;
  }

  for (const func of hostFuncs) {
    let generator = hostFunctionRegistry.get(func.module, func.name);
    if (!generator) {
      const byName = hostFunctionRegistry.getByName(func.name);
      if (byName) generator = byName.generator;
    }
    const body = generator
      ? generator(func.params, func.results)
      : defaultResultCode(func.results);
    const funcType = funcTypeCpp(func.params, func.results);
    cpp += `
  {
    auto ty = ${funcType};
    linker.define(ctx, "${func.module}", "${func.name}",
      Func(ctx, ty, [](Caller caller, Span<const Val> args, Span<Val> results) -> Result<std::monostate, Trap> {
${body}
      })
    ).unwrap();
  }
`;
  }

  for (const [, gl] of neededGlobals) {
    const importName = `${gl.module}.${gl.name}`;
    const mathConst = MATH_CONSTANTS[gl.name];
    let valStr: string;
    if (mathConst !== undefined) {
      valStr = `Val(double(${mathConst}))`;
    } else if (gl.name === 'process.argv') {
      valStr = 'Val(int32_t(0))';
    } else if (gl.name.startsWith('document.')) {
      valStr = 'Val(int32_t(0))';
    } else {
      valStr = 'Val(int32_t(0))';
    }
    cpp += `  linker.define(ctx, "${gl.module}", "${gl.name}", Global::wrap(ctx, ${valStr})).unwrap();\n`;
  }

  for (const mb of moduleBuffers) {
    cpp += `\n  auto ${mb.moduleVar} = Module::compile(engine, Span<uint8_t>(const_cast<uint8_t*>(${mb.varName}), ${mb.lenVar}));\n`;
    cpp += `  if (!${mb.moduleVar}) { std::cerr << "Error compilando modulo: " << ${mb.moduleVar}.err().message() << std::endl; return 1; }\n`;
  }

  for (const mod of modules) {
    const iv = `instance${mod.index}`;
    const mv = `mod${mod.index}`;
    cpp += `\n  auto ${iv} = linker.instantiate(ctx, ${mv}.unwrap());\n`;
    cpp += `  if (!${iv}) {\n`;
    cpp += `    std::cerr << "Error instanciando modulo ${mod.index}" << std::endl;\n`;
    cpp += `    return 1;\n  }\n`;
    cpp += `  define_exports(linker, ctx, ${iv}.unwrap(), "${iv}");\n`;
  }

  const entryIdx = findEntryModule(link, entryPoint);

  cpp += `\n  auto entry_exp = ${entryIdx}.unwrap().get(ctx, "${entryPoint}");\n`;
  cpp += `  if (!entry_exp) { std::cerr << "Entry point ${entryPoint} no encontrado" << std::endl; return 1; }\n`;
  cpp += '  if (!std::get_if<Func>(&*entry_exp)) { std::cerr << "' + entryPoint + ' no es una funcion" << std::endl; return 1; }\n';
  cpp += '  auto entry_func = std::get<Func>(*entry_exp);\n';
  cpp += '  auto result = entry_func.call(ctx, {});\n';
  cpp += '  if (!result) {\n';
  cpp += `    std::cerr << "Error llamando a ${entryPoint}" << std::endl;\n`;
  cpp += '    return 1;\n  }\n\n';

  cpp += '  return 0;\n';
  cpp += '}\n';

  return cpp;
}
