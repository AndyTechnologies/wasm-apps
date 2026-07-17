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
});
