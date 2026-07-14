import os from 'node:os';
import { ResolvedLink, HostFuncDef, WasmImportFuncType } from '@wasm-apps/types';

const ABORT_BODY = `
    int32_t msgPtr = message;
    int32_t fnPtr = fileName;
    if (msgPtr > 0) {
      std::cerr << "ABORT: " << _readAsString(caller, msgPtr);
    }
    if (fnPtr > 0) {
      std::cerr << " in " << _readAsString(caller, fnPtr);
    }
    std::cerr << ":" << line << ":" << col << std::endl;
    std::exit(1);
    `;

const DEFAULT_HOST_FUNCS: HostFuncDef[] = [
  {
    module: 'env',
    name: 'abort',
    params: ['int32_t message', 'int32_t fileName', 'int32_t line', 'int32_t col'],
    paramsType: 'std::tuple<int32_t,int32_t,int32_t,int32_t>',
    body: ABORT_BODY,
  },
  {
    module: 'env',
    name: 'process.exit',
    params: ['int32_t code'],
    paramsType: 'std::tuple<int32_t>',
    body: `std::exit(code);`,
  },
];

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

interface EnvImpl {
  needsMemory: boolean;
  hasReturn: boolean;
  body: string;
}

const KNOWN_IMPLS: Record<string, EnvImpl> = {
  'seed': {
    needsMemory: false,
    hasReturn: true,
    body: `std::uniform_real_distribution<double> _dist(0.0, 1.0); results[0] = Val(_dist(_wasm_rng)); return std::monostate{};`,
  },
  'trace': {
    needsMemory: true,
    hasReturn: false,
    body: `TRACE_BODY`,
  },
  'console.log': {
    needsMemory: true,
    hasReturn: false,
    body: `std::cout`,
  },
  'console.debug': {
    needsMemory: true,
    hasReturn: false,
    body: `std::cout`,
  },
  'console.info': {
    needsMemory: true,
    hasReturn: false,
    body: `std::cout`,
  },
  'console.warn': {
    needsMemory: true,
    hasReturn: false,
    body: `std::cerr`,
  },
  'console.error': {
    needsMemory: true,
    hasReturn: false,
    body: `std::cerr`,
  },
  'console.time': {
    needsMemory: true,
    hasReturn: false,
    body: `_wasm_timers[label] = std::chrono::steady_clock::now();`,
  },
  'console.timeLog': {
    needsMemory: true,
    hasReturn: false,
    body: `{
      auto it = _wasm_timers.find(label);
      if (it != _wasm_timers.end()) {
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - it->second).count();
        std::cerr << label << ": " << elapsed << " ms" << std::endl;
      }
    }`,
  },
  'console.timeEnd': {
    needsMemory: true,
    hasReturn: false,
    body: `{
      auto it = _wasm_timers.find(label);
      if (it != _wasm_timers.end()) {
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - it->second).count();
        std::cerr << label << ": " << elapsed << " ms" << std::endl;
        _wasm_timers.erase(it);
      }
    }`,
  },
  'console.assert': {
    needsMemory: true,
    hasReturn: false,
    body: `CONSOLE_ASSERT`,
  },
  'Date.now': {
    needsMemory: false,
    hasReturn: true,
    body: `auto _now = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count(); results[0] = Val(double(_now)); return std::monostate{};`,
  },
  'performance.now': {
    needsMemory: false,
    hasReturn: true,
    body: `auto _now = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count(); results[0] = Val(double(_now)); return std::monostate{};`,
  },
  'crypto.getRandomValuesN': {
    needsMemory: true,
    hasReturn: true,
    body: `CRYPTO_RANDOM`,
  },
  'Math.random': {
    needsMemory: false,
    hasReturn: true,
    body: `std::uniform_real_distribution<double> _dist(0.0, 1.0); results[0] = Val(_dist(_wasm_rng)); return std::monostate{};`,
  },
  'Math.abs': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::abs(args[0].f64()))); return std::monostate{};` },
  'Math.acos': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::acos(args[0].f64()))); return std::monostate{};` },
  'Math.acosh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::acosh(args[0].f64()))); return std::monostate{};` },
  'Math.asin': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::asin(args[0].f64()))); return std::monostate{};` },
  'Math.asinh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::asinh(args[0].f64()))); return std::monostate{};` },
  'Math.atan': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::atan(args[0].f64()))); return std::monostate{};` },
  'Math.atan2': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::atan2(args[0].f64(), args[1].f64()))); return std::monostate{};` },
  'Math.atanh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::atanh(args[0].f64()))); return std::monostate{};` },
  'Math.cbrt': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::cbrt(args[0].f64()))); return std::monostate{};` },
  'Math.ceil': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::ceil(args[0].f64()))); return std::monostate{};` },
  'Math.clz32': { needsMemory: false, hasReturn: true, body: `uint32_t _v = (uint32_t)args[0].f64(); results[0] = Val(double(_v == 0 ? 32 : _wasm_clz32(_v))); return std::monostate{};` },
  'Math.cos': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::cos(args[0].f64()))); return std::monostate{};` },
  'Math.cosh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::cosh(args[0].f64()))); return std::monostate{};` },
  'Math.exp': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::exp(args[0].f64()))); return std::monostate{};` },
  'Math.expm1': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::expm1(args[0].f64()))); return std::monostate{};` },
  'Math.floor': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::floor(args[0].f64()))); return std::monostate{};` },
  'Math.fround': { needsMemory: false, hasReturn: true, body: `results[0] = Val(float((float)args[0].f64())); return std::monostate{};` },
  'Math.hypot': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::hypot(args[0].f64(), args[1].f64()))); return std::monostate{};` },
  'Math.imul': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double((double)((int32_t)args[0].f64() * (int32_t)args[1].f64()))); return std::monostate{};` },
  'Math.log': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::log(args[0].f64()))); return std::monostate{};` },
  'Math.log10': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::log10(args[0].f64()))); return std::monostate{};` },
  'Math.log1p': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::log1p(args[0].f64()))); return std::monostate{};` },
  'Math.log2': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::log2(args[0].f64()))); return std::monostate{};` },
  'Math.max': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::max(args[0].f64(), args[1].f64()))); return std::monostate{};` },
  'Math.min': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::min(args[0].f64(), args[1].f64()))); return std::monostate{};` },
  'Math.pow': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::pow(args[0].f64(), args[1].f64()))); return std::monostate{};` },
  'Math.round': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::round(args[0].f64()))); return std::monostate{};` },
  'Math.sign': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double((args[0].f64() > 0) ? 1.0 : (args[0].f64() < 0) ? -1.0 : (args[0].f64() == 0 ? 0.0 : std::numeric_limits<double>::quiet_NaN()))); return std::monostate{};` },
  'Math.sin': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::sin(args[0].f64()))); return std::monostate{};` },
  'Math.sinh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::sinh(args[0].f64()))); return std::monostate{};` },
  'Math.sqrt': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::sqrt(args[0].f64()))); return std::monostate{};` },
  'Math.tan': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::tan(args[0].f64()))); return std::monostate{};` },
  'Math.tanh': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::tanh(args[0].f64()))); return std::monostate{};` },
  'Math.trunc': { needsMemory: false, hasReturn: true, body: `results[0] = Val(double(std::trunc(args[0].f64()))); return std::monostate{};` },
  'Object.is': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(args[0].i32() == args[1].i32())); return std::monostate{};` },
  'Object.hasOwn': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Object.keys': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Object.values': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Object.entries': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Object.assign': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Object.getOwnPropertyNames': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Reflect.get': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Reflect.has': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Reflect.set': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'Reflect.apply': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
  'String.fromCodePoint': { needsMemory: false, hasReturn: true, body: `results[0] = Val(int32_t(0)); return std::monostate{};` },
};

function generateConsoleBody(name: string, stream: string, params: string[]): string {
  const readLabel = name === 'console.log' || name === 'console.debug' || name === 'console.info' || name === 'console.warn' || name === 'console.error';

  if (readLabel) {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    ${stream} << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    ${stream} << std::endl;
    return std::monostate{};`;
  }

  if (name === 'console.time' || name === 'console.timeLog' || name === 'console.timeEnd') {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string label = _readAsString(caller, _ptr);
    ${KNOWN_IMPLS[name]!.body}
    return std::monostate{};`;
    }
    return `return std::monostate{};`;
  }

  if (name === 'console.assert') {
    if (params.length >= 2) {
      return `
    int32_t _cond = args[0].i32();
    int32_t _ptr = args[1].i32();
    if (!_cond) {
      std::string _msg = _readAsString(caller, _ptr);
      std::cerr << "Assertion failed: " << _msg << std::endl;
    }
    return std::monostate{};`;
    }
    return `return std::monostate{};`;
  }

  return 'return std::monostate{};';
}

function generateTraceBody(params: string[]): string {
  return `
    int32_t _off = args[0].i32();
    std::string _msg = _readAsStringNT(caller, _off);
    int32_t _n = args[1].i32();
    std::cerr << "trace: " << _msg;
    for (int32_t _i = 0; _i < _n && _i < 5; _i++) {
      std::cerr << " " << args[2 + _i].f64();
    }
    std::cerr << std::endl;
    return std::monostate{};`;
}

function generateCryptoBody(): string {
  return `
    int32_t _len = args[0].i32();
    auto _mem = caller.get_export("memory");
    if (!_mem) return Trap("crypto.getRandomValuesN: memory not found");
    auto* _memory = std::get_if<wasmtime::Memory>(&*_mem);
    if (!_memory) return Trap("crypto.getRandomValuesN: not a memory");
    auto _ctx2 = caller.context();
    auto _span = _memory->data(_ctx2);
    auto* _data = _span.data();
    auto _sz = _span.size();
    int32_t allocSz = 8 + (_len > 0 ? _len : 0);
    (void)allocSz; (void)_data; (void)_sz;
    results[0] = Val(int32_t(0));
    return std::monostate{};`;
}

function generateEnvStubBody(name: string, params: string[], results: string[]): string {
  const known = KNOWN_IMPLS[name];

  if (name === 'trace') return generateTraceBody(params);
  if (name.startsWith('console.')) {
    const entry = known;
    if (!entry) {
      const baseName = name.replace('console.', '');
      if (['log', 'debug', 'info', 'warn', 'error', 'time', 'timeLog', 'timeEnd', 'assert'].includes(baseName)) {
        return generateConsoleBody(name, baseName === 'warn' || baseName === 'error' ? 'std::cerr' : 'std::cout', params);
      }
      return defaultResultCode(results);
    }
    const stream = entry.body === 'std::cout' ? 'std::cout' : 'std::cerr';
    return generateConsoleBody(name, stream, params);
  }
  if (name === 'crypto.getRandomValuesN') return generateCryptoBody();

  if (known) {
    const b = known.body;
    if (b === 'TRACE_BODY') return generateTraceBody(params);
    if (b === 'CONSOLE_ASSERT') return generateConsoleBody(name, 'std::cerr', params);
    if (b === 'CRYPTO_RANDOM') return generateCryptoBody();
    return b;
  }

  return defaultResultCode(results);
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
  hostFuncs?: HostFuncDef[],
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

  const allHostFuncs = [...(hostFuncs ?? []), ...DEFAULT_HOST_FUNCS];

  const neededHostFuncs = new Map<string, HostFuncDef>();
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

      if (imp.kind !== 'function') continue;

      const key = `${imp.module}.${imp.name}`;
      const hf = allHostFuncs.find(h => h.module === imp.module && h.name === imp.name);
      if (hf) {
        neededHostFuncs.set(key, hf);
      }
    }
  }

  const importTypeMap = new Map<string, WasmImportFuncType>();
  if (importFuncTypes) {
    for (const ft of importFuncTypes) {
      importTypeMap.set(`${ft.module}.${ft.name}`, ft);
    }
  }

  const envStubs: Array<{ name: string; params: string[]; results: string[] }> = [];
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.module !== 'env') continue;
      if (imp.kind !== 'function') continue;
      const key = `env.${imp.name}`;
      if (neededHostFuncs.has(key)) continue;
      const ft = importTypeMap.get(key);
      if (!ft) continue;
      if (!envStubs.some(s => s.name === imp.name)) {
        envStubs.push({ name: imp.name, params: ft.params, results: ft.results });
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
  for (const mod of modules) {
    const exports = mod.module.exports;
    if (exports.length === 0) continue;
    cpp += `  if (std::strcmp(instance_label, "instance${mod.index}") == 0) {\n`;
    for (const exp of exports) {
      const safeName = sanitizeIdentifier(exp.name);
      cpp += `    {\n`;
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

  for (const [, hf] of neededHostFuncs) {
    cpp += `\n  linker.func_wrap("${hf.module}", "${hf.name}", [](Caller caller`;
    for (const p of hf.params) {
      cpp += `, ${p}`;
    }
    cpp += ') -> std::monostate {\n';
    if (hf.body) {
      cpp += `${hf.body}\n`;
    }
    cpp += '    return std::monostate{};\n  }).unwrap();\n';
  }

  for (const stub of envStubs) {
    const funcType = funcTypeCpp(stub.params, stub.results);
    const body = generateEnvStubBody(stub.name, stub.params, stub.results);
    cpp += `
  {
    auto ty = ${funcType};
    linker.define(ctx, "env", "${stub.name}",
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
