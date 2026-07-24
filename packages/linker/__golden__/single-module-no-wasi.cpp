#include <wasmtime.hh>
#include <iostream>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <unordered_map>
#include <unordered_set>
#include <random>
#include <string>
#include <cmath>
#include <limits>
#ifdef _MSC_VER
#include <intrin.h>
#endif

#ifdef _MSC_VER
static inline int _wasm_clz32(uint32_t x) {
  unsigned long leading_zero;
  _BitScanReverse(&leading_zero, x);
  return 31 - (int)leading_zero;
}
#else
static inline int _wasm_clz32(uint32_t x) {
  return x == 0 ? 32 : __builtin_clz(x);
}
#endif

static inline size_t _wasm_strnlen(const char* s, size_t maxlen) {
  size_t n = 0;
  while (n < maxlen && s[n]) ++n;
  return n;
}

using namespace wasmtime;

// Error handling helpers for wasmtime v46 API
template<typename T>
static T _check_result(wasmtime::Result<T>&& r, const char* what) {
  if (!r) {
    std::cerr << "LinkerError: " << what << " failed: "
              << r.err().message() << std::endl;
    std::exit(1);
  }
  return r.ok();
}

template<typename T>
static T _check_trap(wasmtime::TrapResult<T>&& r, const char* what) {
  if (!r) {
    std::cerr << "LinkerError: " << what << " failed: "
              << r.err_ref().message() << std::endl;
    std::exit(1);
  }
  return r.ok();
}

static std::mt19937 _wasm_rng(std::random_device{}());
static std::unordered_map<std::string, std::chrono::steady_clock::time_point> _wasm_timers;
static std::string _readAsString(Caller& caller, int32_t ptr) {
  if (ptr <= 0) return "";
  auto mem = caller.get_export("memory");
  if (!mem) return "";
  auto* memory = std::get_if<wasmtime::Memory>(&*mem);
  if (!memory) return "";
  auto ctx = caller.context();
  auto span = memory->data(ctx);
  auto* data = span.data();
  auto sz = span.size();
  if (ptr < 4 || (uint32_t)ptr > (uint32_t)sz) return "";
  int32_t len; std::memcpy(&len, data + ptr - 4, sizeof(len)); len >>= 1;
  if (len < 0 || len > 65536) return "";
  if (ptr + (int32_t)(len * 2) > (int32_t)sz) return "";
  uint16_t* chars = reinterpret_cast<uint16_t*>(data + ptr);
  std::string result;
  result.reserve(len + 1);
  for (int32_t i = 0; i < len; i++) {
    uint16_t c = chars[i];
    if (c == 0) break;
    if (c < 0x80) {
      result += (char)c;
    } else if (c < 0x800) {
      result += (char)(0xC0 | (c >> 6));
      result += (char)(0x80 | (c & 0x3F));
    } else {
      result += (char)(0xE0 | (c >> 12));
      result += (char)(0x80 | ((c >> 6) & 0x3F));
      result += (char)(0x80 | (c & 0x3F));
    }
  }
  return result;
}

static std::string _readAsStringNT(Caller& caller, int32_t ptr) {
  if (ptr <= 0) return "";
  auto mem = caller.get_export("memory");
  if (!mem) return "";
  auto* memory = std::get_if<wasmtime::Memory>(&*mem);
  if (!memory) return "";
  auto ctx = caller.context();
  auto span = memory->data(ctx);
  auto* data = span.data();
  auto sz = span.size();
  if (ptr >= (int32_t)sz) return "";
  size_t mlen = _wasm_strnlen(reinterpret_cast<const char*>(data + ptr), sz - ptr);
  return std::string(reinterpret_cast<const char*>(data + ptr), mlen);
}
const unsigned char wasm_bytes_0[] = {
    0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,0x01,0x02,0x03
};
const size_t wasm_len_0 = 11;

static int define_exports(Linker &linker, Store::Context ctx, Instance instance, const char* instance_label) {
  static std::unordered_set<std::string> _defined;
  if (std::strcmp(instance_label, "instance0") == 0) {
    if (_defined.find("_start") == _defined.end()) {
      _defined.insert("_start");
      auto exp = instance.get(ctx, "_start");
      if (!exp) { std::cerr << "Error obteniendo export _start" << std::endl; return 1; }
      auto result = linker.define(ctx, "env", "_start", *exp);
      if (!result) { std::cerr << "Error definiendo _start: " << result.err().message() << std::endl; return 1; }
    }
    return 0;
  }
  std::cerr << "Unknown instance label " << instance_label << std::endl; return 1;
}

int main(int argc, char *argv[]) {
    Engine engine;
    Store store(engine);
    auto ctx = store.context();
    Linker linker(engine);
    

  auto mod0 = Module::compile(engine, Span<uint8_t>(const_cast<uint8_t*>(wasm_bytes_0), wasm_len_0));
  if (!mod0) { std::cerr << "Error compilando modulo: " << mod0.err().message() << std::endl; return 1; }

  auto instance0 = _check_trap(linker.instantiate(ctx,
      _check_result(std::move(mod0), "compile module 0")),
      "instantiate module 0");
  if (define_exports(linker, ctx, instance0, "instance0") != 0) return 1;

  auto entry_exp = instance0.get(ctx, "_start");
  if (!entry_exp) { std::cerr << "Entry point _start no encontrado" << std::endl; return 1; }
  if (!std::get_if<Func>(&*entry_exp)) { std::cerr << "_start no es una funcion" << std::endl; return 1; }
  auto entry_func = std::get<Func>(*entry_exp);
  auto result = entry_func.call(ctx, {});
  if (!result) {
    std::cerr << "Error llamando a _start" << std::endl;
    return 1;
  }

  return 0;
}
