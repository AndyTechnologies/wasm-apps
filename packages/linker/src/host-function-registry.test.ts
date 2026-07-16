import { describe, it, expect, beforeEach } from 'vitest';
import { HostFunctionRegistry } from './host-function-registry.js';

describe('HostFunctionRegistry', () => {
  let registry: HostFunctionRegistry;

  beforeEach(() => {
    registry = new HostFunctionRegistry();
  });

  it('registers and retrieves a function', () => {
    const gen = () => 'return 42;';
    registry.register('env', 'get_answer', gen);
    expect(registry.get('env', 'get_answer')).toBe(gen);
  });

  it('returns undefined for unregistered function', () => {
    expect(registry.get('env', 'nonexistent')).toBeUndefined();
  });

  it('checks existence with has()', () => {
    registry.register('env', 'exists', () => '');
    expect(registry.has('env', 'exists')).toBe(true);
    expect(registry.has('env', 'missing')).toBe(false);
  });

  it('checks existence with hasByName() across modules', () => {
    registry.register('math.wasm', 'add', () => '');
    expect(registry.hasByName('add')).toBe(true);
    expect(registry.hasByName('subtract')).toBe(false);
  });

  it('gets function with getByName() across modules', () => {
    const gen = () => 'return 1;';
    registry.register('other', 'fn', gen);
    const entry = registry.getByName('fn');
    expect(entry).toBeDefined();
    expect(entry!.generator).toBe(gen);
    expect(registry.getByName('missing')).toBeUndefined();
  });

  it('overwrites existing registration', () => {
    const gen1 = () => 'return 1;';
    const gen2 = () => 'return 2;';
    registry.register('env', 'x', gen1);
    registry.register('env', 'x', gen2);
    expect(registry.get('env', 'x')).toBe(gen2);
  });

  it('handles same name in different modules', () => {
    const genA = () => 'module a';
    const genB = () => 'module b';
    registry.register('a', 'foo', genA);
    registry.register('b', 'foo', genB);
    expect(registry.get('a', 'foo')).toBe(genA);
    expect(registry.get('b', 'foo')).toBe(genB);
  });

  it('getAll returns all registered functions', () => {
    registry.register('env', 'a', () => '1');
    registry.register('env', 'b', () => '2');
    expect(registry.getAll()).toHaveLength(2);
  });

  it('clear removes all registrations', () => {
    registry.register('env', 'x', () => '');
    registry.clear();
    expect(registry.has('env', 'x')).toBe(false);
  });
});
