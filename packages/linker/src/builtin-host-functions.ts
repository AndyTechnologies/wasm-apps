import type { HostFunctionRegistry } from './host-function-registry.js';

export function registerBuiltinHostFunctions(registry: HostFunctionRegistry): void {

  registry.register('env', 'abort', (_params, _results) => `
    int32_t msgPtr = args[0].i32();
    int32_t fnPtr = args[1].i32();
    if (msgPtr > 0) {
      std::cerr << "ABORT: " << _readAsString(caller, msgPtr);
    }
    if (fnPtr > 0) {
      std::cerr << " in " << _readAsString(caller, fnPtr);
    }
    std::cerr << ":" << args[2].i32() << ":" << args[3].i32() << std::endl;
    std::exit(1);
    `);

  registry.register('env', 'process.exit', (_params, _results) => `
    std::exit(args[0].i32());`);

  registry.register('env', 'seed', (_params, _results) => `
    std::uniform_real_distribution<double> _dist(0.0, 1.0); results[0] = Val(_dist(_wasm_rng)); return std::monostate{};`);

  registry.register('env', 'trace', (_params, _results) => `
    int32_t _off = args[0].i32();
    std::string _msg = _readAsStringNT(caller, _off);
    int32_t _n = args[1].i32();
    std::cerr << "trace: " << _msg;
    for (int32_t _i = 0; _i < _n && _i < 5; _i++) {
      std::cerr << " " << args[2 + _i].f64();
    }
    std::cerr << std::endl;
    return std::monostate{};`);

  registry.register('env', 'console.log', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    std::cout << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    std::cout << std::endl;
    return std::monostate{};`;
  });

  registry.register('env', 'console.debug', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    std::cout << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    std::cout << std::endl;
    return std::monostate{};`;
  });

  registry.register('env', 'console.info', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    std::cout << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    std::cout << std::endl;
    return std::monostate{};`;
  });

  registry.register('env', 'console.warn', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    std::cerr << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    std::cerr << std::endl;
    return std::monostate{};`;
  });

  registry.register('env', 'console.error', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string _str = _readAsString(caller, _ptr);
    std::cerr << _str << std::endl;
    return std::monostate{};`;
    }
    return `
    std::cerr << std::endl;
    return std::monostate{};`;
  });

  registry.register('env', 'console.time', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string label = _readAsString(caller, _ptr);
    _wasm_timers[label] = std::chrono::steady_clock::now();
    return std::monostate{};`;
    }
    return `return std::monostate{};`;
  });

  registry.register('env', 'console.timeLog', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string label = _readAsString(caller, _ptr);
    {
      auto it = _wasm_timers.find(label);
      if (it != _wasm_timers.end()) {
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - it->second).count();
        std::cerr << label << ": " << elapsed << " ms" << std::endl;
      }
    }
    return std::monostate{};`;
    }
    return `return std::monostate{};`;
  });

  registry.register('env', 'console.timeEnd', (params, _results) => {
    if (params.length >= 1) {
      return `
    int32_t _ptr = args[0].i32();
    std::string label = _readAsString(caller, _ptr);
    {
      auto it = _wasm_timers.find(label);
      if (it != _wasm_timers.end()) {
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - it->second).count();
        std::cerr << label << ": " << elapsed << " ms" << std::endl;
        _wasm_timers.erase(it);
      }
    }
    return std::monostate{};`;
    }
    return `return std::monostate{};`;
  });

  registry.register('env', 'console.assert', (params, _results) => {
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
  });

  registry.register('env', 'Date.now', (_params, _results) => `
    auto _now = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count(); results[0] = Val(double(_now)); return std::monostate{};`);

  registry.register('env', 'performance.now', (_params, _results) => `
    auto _now = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count(); results[0] = Val(double(_now)); return std::monostate{};`);

  registry.register('env', 'crypto.getRandomValuesN', (_params, _results) => `
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
    return std::monostate{};`);

  registry.register('env', 'Math.random', (_params, _results) => `
    std::uniform_real_distribution<double> _dist(0.0, 1.0); results[0] = Val(_dist(_wasm_rng)); return std::monostate{};`);

  registry.register('env', 'Math.abs', (_params, _results) => `results[0] = Val(double(std::abs(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.acos', (_params, _results) => `results[0] = Val(double(std::acos(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.acosh', (_params, _results) => `results[0] = Val(double(std::acosh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.asin', (_params, _results) => `results[0] = Val(double(std::asin(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.asinh', (_params, _results) => `results[0] = Val(double(std::asinh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.atan', (_params, _results) => `results[0] = Val(double(std::atan(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.atan2', (_params, _results) => `results[0] = Val(double(std::atan2(args[0].f64(), args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.atanh', (_params, _results) => `results[0] = Val(double(std::atanh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.cbrt', (_params, _results) => `results[0] = Val(double(std::cbrt(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.ceil', (_params, _results) => `results[0] = Val(double(std::ceil(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.clz32', (_params, _results) => `uint32_t _v = (uint32_t)args[0].f64(); results[0] = Val(double(_v == 0 ? 32 : _wasm_clz32(_v))); return std::monostate{};`);
  registry.register('env', 'Math.cos', (_params, _results) => `results[0] = Val(double(std::cos(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.cosh', (_params, _results) => `results[0] = Val(double(std::cosh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.exp', (_params, _results) => `results[0] = Val(double(std::exp(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.expm1', (_params, _results) => `results[0] = Val(double(std::expm1(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.floor', (_params, _results) => `results[0] = Val(double(std::floor(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.fround', (_params, _results) => `results[0] = Val(float((float)args[0].f64())); return std::monostate{};`);
  registry.register('env', 'Math.hypot', (_params, _results) => `results[0] = Val(double(std::hypot(args[0].f64(), args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.imul', (_params, _results) => `results[0] = Val(double((double)((int32_t)args[0].f64() * (int32_t)args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.log', (_params, _results) => `results[0] = Val(double(std::log(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.log10', (_params, _results) => `results[0] = Val(double(std::log10(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.log1p', (_params, _results) => `results[0] = Val(double(std::log1p(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.log2', (_params, _results) => `results[0] = Val(double(std::log2(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.max', (_params, _results) => `results[0] = Val(double(std::max(args[0].f64(), args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.min', (_params, _results) => `results[0] = Val(double(std::min(args[0].f64(), args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.pow', (_params, _results) => `results[0] = Val(double(std::pow(args[0].f64(), args[1].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.round', (_params, _results) => `results[0] = Val(double(std::round(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.sign', (_params, _results) => `results[0] = Val(double((args[0].f64() > 0) ? 1.0 : (args[0].f64() < 0) ? -1.0 : (args[0].f64() == 0 ? 0.0 : std::numeric_limits<double>::quiet_NaN()))); return std::monostate{};`);
  registry.register('env', 'Math.sin', (_params, _results) => `results[0] = Val(double(std::sin(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.sinh', (_params, _results) => `results[0] = Val(double(std::sinh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.sqrt', (_params, _results) => `results[0] = Val(double(std::sqrt(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.tan', (_params, _results) => `results[0] = Val(double(std::tan(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.tanh', (_params, _results) => `results[0] = Val(double(std::tanh(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Math.trunc', (_params, _results) => `results[0] = Val(double(std::trunc(args[0].f64()))); return std::monostate{};`);
  registry.register('env', 'Object.is', (_params, _results) => `results[0] = Val(int32_t(args[0].i32() == args[1].i32())); return std::monostate{};`);
  registry.register('env', 'Object.hasOwn', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Object.keys', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Object.values', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Object.entries', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Object.assign', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Object.getOwnPropertyNames', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Reflect.get', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Reflect.has', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Reflect.set', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'Reflect.apply', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
  registry.register('env', 'String.fromCodePoint', (_params, _results) => `results[0] = Val(int32_t(0)); return std::monostate{};`);
}
