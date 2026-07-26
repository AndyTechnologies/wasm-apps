import { describe, it, expect, beforeEach } from 'vitest';
import { HostFunctionRegistry } from './host-function-registry.js';

describe('HostFunctionRegistry', () => {
  let registry: HostFunctionRegistry;

  beforeEach(() => {
    registry = new HostFunctionRegistry();
  });

  const dummyGenerator = () => 'return 0;';

  it('registra y recupera funciones', () => {
    registry.register('env', 'log', dummyGenerator);
    expect(registry.get('env', 'log')).toBe(dummyGenerator);
  });

  it('verifica existencia', () => {
    registry.register('env', 'log', dummyGenerator);
    expect(registry.has('env', 'log')).toBe(true);
    expect(registry.has('env', 'nonexistent')).toBe(false);
  });

  it('retorna todas las funciones registradas', () => {
    registry.register('env', 'log', dummyGenerator);
    registry.register('env', 'abort', dummyGenerator);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('busca por nombre ignorando módulo', () => {
    registry.register('env', 'log', dummyGenerator);
    expect(registry.hasByName('log')).toBe(true);
    expect(registry.hasByName('env.log')).toBe(true);
    expect(registry.hasByName('nonexistent')).toBe(false);
  });

  it('getByName retorna módulo y generador', () => {
    registry.register('env', 'log', dummyGenerator);
    const result = registry.getByName('log');
    expect(result).toBeDefined();
    expect(result!.module).toBe('env');
    expect(result!.generator).toBe(dummyGenerator);
  });

  it('retorna nombres de imports conocidos', () => {
    registry.register('env', 'log', dummyGenerator);
    registry.register('env', 'abort', dummyGenerator);
    const known = registry.getKnownHostImports();
    expect(known).toContain('env.log');
    expect(known).toContain('env.abort');
  });

  it('limpia el registro', () => {
    registry.register('env', 'log', dummyGenerator);
    registry.clear();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('request-path generator produces valid C++ body', () => {
    registry.register('env', 'request-path', (params, _results) => {
      if (params.length >= 1) {
        return `
    int32_t pathPtr = args[0].i32();
    std::string path = _readAsStringNT(caller, pathPtr);
    int32_t fd = FsRuntime::requestPath(path, _fs_allowed_roots, "wasm-module");
    results[0] = Val(fd);
    return std::monostate{};`;
      }
      return `results[0] = Val(int32_t(-2)); return std::monostate{};`;
    });

    const generator = registry.get('env', 'request-path');
    expect(generator).toBeDefined();

    const body = generator!(['i32'], ['i32']);
    expect(body).toContain('FsRuntime::requestPath');
    expect(body).toContain('_fs_allowed_roots');
    expect(body).toContain('_readAsStringNT');
    expect(body).toContain('results[0] = Val(fd)');
  });
});
