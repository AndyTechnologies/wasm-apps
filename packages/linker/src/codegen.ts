import os from 'node:os';
import type { ResolvedLink, WasmImportFuncType, WasmModuleInfo, WasmExport, WasmImport } from '@wasm-apps/types';
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

const MATH_CONSTANTS: Record<string, string> = {
  'Math.E': '2.718281828459045',
  'Math.LN2': '0.6931471805599453',
  'Math.LN10': '2.302585092994046',
  'Math.LOG2E': '1.4426950408889634',
  'Math.LOG10E': '0.4342944819032518',
  'Math.PI': '3.141592653589793',
  'Math.SQRT1_2': '0.7071067811865476',
  'Math.SQRT2': '1.4142135623730951',
};

interface ModuleBuffer {
  varName: string;
  lenVar: string;
  bytes: Buffer;
  moduleVar: string;
  instanceVar: string;
}

function funcTypeCpp(params: string[], results: string[]): string {
  const p = params.map((t) => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  const r = results.map((t) => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  return `FuncType::from_iters(std::vector<ValType>{${p}}, std::vector<ValType>{${r}})`;
}

function defaultResultCode(results: string[]): string {
  if (results.length === 0) return '    return std::monostate{};';
  return results.map((t, i) => `    results[${i}] = ${VALTYPE_TO_SET[t] || 'Val(int32_t('}0));`).join(os.EOL) + os.EOL + '    return std::monostate{};';
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function buildModuleBuffers(modules: ResolvedLink['order']): ModuleBuffer[] {
  return modules.map((m) => ({
    varName: `wasm_bytes_${m.index}`,
    lenVar: `wasm_len_${m.index}`,
    bytes: m.module.buffer,
    moduleVar: `mod${m.index}`,
    instanceVar: `instance${m.index}`,
  }));
}

function buildNeededGlobals(modules: ResolvedLink['order']): Map<string, { module: string; name: string }> {
  const neededGlobals = new Map<string, { module: string; name: string }>();
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.module === 'wasi_snapshot_preview1' || imp.module === 'wasi_unstable') continue;
      if (imp.kind === 'global') {
        const key = `${imp.module}.${imp.name}`;
        if (!neededGlobals.has(key)) {
          neededGlobals.set(key, { module: imp.module, name: imp.name });
        }
      }
    }
  }
  return neededGlobals;
}

function buildHostFunctionList(
  modules: ResolvedLink['order'],
  importTypeMap: Map<string, WasmImportFuncType>,
): Array<{ name: string; module: string; params: string[]; results: string[] }> {
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
  return hostFuncs;
}

function generatePreamble(): string {
  return [
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
  ].join('\n');
}

function generateStringReader(): string {
  return [
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
}

function generateModuleBuffers(moduleBuffers: ModuleBuffer[]): string {
  let result = '';
  for (const mb of moduleBuffers) {
    const byteStr = Array.from(mb.bytes).join(',');
    result += `const unsigned char ${mb.varName}[] = { ${byteStr} };\n`;
    result += `const size_t ${mb.lenVar} = ${mb.bytes.length};\n\n`;
  }
  return result;
}

function generateDefineExports(modules: ResolvedLink['order']): string {
  let code = 'static void define_exports(Linker &linker, Store::Context ctx, Instance instance, const char* instance_label) {\n';
  code += '  static std::unordered_set<std::string> _defined;\n';
  for (const mod of modules) {
    const exports = mod.module.exports;
    if (exports.length === 0) continue;
    code += `  if (std::strcmp(instance_label, "instance${mod.index}") == 0) {\n`;
    for (const exp of exports) {
      const safeName = sanitizeIdentifier(exp.name);
      code += `    if (_defined.find("${exp.name}") == _defined.end()) {\n`;
      code += `      _defined.insert("${exp.name}");\n`;
      code += `      auto exp = instance.get(ctx, "${exp.name}");\n`;
      code += `      if (!exp) { std::cerr << "Error obteniendo export ${safeName}" << std::endl; std::exit(1); }\n`;
      code += `      auto result = linker.define(ctx, "env", "${exp.name}", *exp);\n`;
      code += `      if (!result) { std::cerr << "Error definiendo ${safeName}" << std::endl; std::exit(1); }\n`;
      code += `    }\n`;
    }
    code += `    return;\n  }\n`;
  }
  code += `  std::cerr << "Unknown instance label " << instance_label << std::endl; std::exit(1);\n`;
  code += '}\n\n';
  return code;
}

function generateMainStart(wasi: boolean): string {
  let code = `int main(int argc, char *argv[]) {
    Engine engine;
    Store store(engine);
    auto ctx = store.context();
    Linker linker(engine);
    \n`;
  if (wasi) {
    code += `    WasiConfig wasi_config;
    wasi_config.inherit_argv();
    wasi_config.inherit_stdin();
    wasi_config.inherit_stdout();
    wasi_config.inherit_stderr();
    ctx.set_wasi(std::move(wasi_config)).unwrap();
    linker.define_wasi().unwrap();
    \n`;
  }
  return code;
}

function generateHostFunctionDefs(hostFuncs: Array<{ name: string; module: string; params: string[]; results: string[] }>): string {
  let code = '';
  for (const func of hostFuncs) {
    let generator = hostFunctionRegistry.get(func.module, func.name);
    if (!generator) {
      const byName = hostFunctionRegistry.getByName(func.name);
      if (byName) generator = byName.generator;
    }
    const body = generator ? generator(func.params, func.results) : defaultResultCode(func.results);
    const funcType = funcTypeCpp(func.params, func.results);
    code += `
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
  return code;
}

function generateGlobalDefs(neededGlobals: Map<string, { module: string; name: string }>): string {
  let code = '';
  for (const [, gl] of neededGlobals) {
    const mathConst = MATH_CONSTANTS[gl.name];
    let valStr: string;
    if (mathConst !== undefined) {
      valStr = `Val(double(${mathConst}))`;
    } else {
      valStr = 'Val(int32_t(0))';
    }
    code += `  linker.define(ctx, "${gl.module}", "${gl.name}", Global::wrap(ctx, ${valStr})).unwrap();\n`;
  }
  return code;
}

function generateModuleCompilation(moduleBuffers: ModuleBuffer[]): string {
  let code = '';
  for (const mb of moduleBuffers) {
    code += `\n  auto ${mb.moduleVar} = Module::compile(engine, Span<uint8_t>(const_cast<uint8_t*>(${mb.varName}), ${mb.lenVar}));\n`;
    code += `  if (!${mb.moduleVar}) { std::cerr << "Error compilando modulo: " << ${mb.moduleVar}.err().message() << std::endl; return 1; }\n`;
  }
  return code;
}

function generateModuleInstantiation(modules: ResolvedLink['order']): string {
  let code = '';
  for (const mod of modules) {
    const iv = `instance${mod.index}`;
    const mv = `mod${mod.index}`;
    code += `\n  auto ${iv} = linker.instantiate(ctx, ${mv}.unwrap());\n`;
    code += `  if (!${iv}) {\n`;
    code += `    std::cerr << "Error instanciando modulo ${mod.index}" << std::endl;\n`;
    code += `    return 1;\n  }\n`;
    code += `  define_exports(linker, ctx, ${iv}.unwrap(), "${iv}");\n`;
  }
  return code;
}

function generateEntryCall(entryModule: string, entryPoint: string): string {
  return `\n  auto entry_exp = ${entryModule}.unwrap().get(ctx, "${entryPoint}");
  if (!entry_exp) { std::cerr << "Entry point ${entryPoint} no encontrado" << std::endl; return 1; }
  if (!std::get_if<Func>(&*entry_exp)) { std::cerr << "${entryPoint} no es una funcion" << std::endl; return 1; }
  auto entry_func = std::get<Func>(*entry_exp);
  auto result = entry_func.call(ctx, {});
  if (!result) {
    std::cerr << "Error llamando a ${entryPoint}" << std::endl;
    return 1;
  }

  return 0;
}
`;
}

export function findEntryModule(link: ResolvedLink, entryPoint: string): string {
  for (const mod of link.order) {
    const found = mod.module.exports.some((e) => e.name === entryPoint && e.kind === 'function');
    if (found) return `instance${mod.index}`;
  }
  throw new Error(`No se encontro la funcion de entrada '${entryPoint}' en ningun modulo.`);
}

export function validateEntryExport(link: ResolvedLink, entryPoint: string): void {
  for (const mod of link.order) {
    if (mod.module.exports.some((e) => e.name === entryPoint)) return;
  }
  throw new Error(`No se encontro la exportacion '${entryPoint}' en ningun modulo compilado.`);
}

export function generateCCode(link: ResolvedLink, entryPoint: string, wasi: boolean, importFuncTypes?: WasmImportFuncType[]): string {
  const modules = link.order;
  const moduleBuffers = buildModuleBuffers(modules);
  const neededGlobals = buildNeededGlobals(modules);

  const importTypeMap = new Map<string, WasmImportFuncType>();
  if (importFuncTypes) {
    for (const ft of importFuncTypes) {
      importTypeMap.set(`${ft.module}.${ft.name}`, ft);
    }
  }

  const hostFuncs = buildHostFunctionList(modules, importTypeMap);
  const entryModule = findEntryModule(link, entryPoint);

  let cpp = generatePreamble();
  cpp += generateStringReader();
  cpp += generateModuleBuffers(moduleBuffers);
  cpp += generateDefineExports(modules);
  cpp += generateMainStart(wasi);
  cpp += generateHostFunctionDefs(hostFuncs);
  cpp += generateGlobalDefs(neededGlobals);
  cpp += generateModuleCompilation(moduleBuffers);
  cpp += generateModuleInstantiation(modules);
  cpp += generateEntryCall(entryModule, entryPoint);

  return cpp;
}
