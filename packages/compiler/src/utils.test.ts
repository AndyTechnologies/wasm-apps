import { describe, it, expect } from 'vitest';
import { compareHash, hashString, parseExports, mergeAsConfig } from './utils.js';

describe('hashString', () => {
  it('genera un hash SHA-256 hex', () => {
    const hash = hashString('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('genera el mismo hash para la misma entrada', () => {
    expect(hashString('hola')).toBe(hashString('hola'));
  });

  it('genera hashes diferentes para entradas diferentes', () => {
    expect(hashString('hola')).not.toBe(hashString('adiós'));
  });
});

describe('compareHash', () => {
  it('retorna true para hashes iguales', () => {
    expect(compareHash('abc', 'abc')).toBe(true);
  });

  it('retorna false para hashes de diferente longitud', () => {
    expect(compareHash('abc', 'abcd')).toBe(false);
  });

  it('retorna false para hashes diferentes', () => {
    expect(compareHash('abc', 'abd')).toBe(false);
  });
});

describe('parseExports', () => {
  it('encuentra exports de función', () => {
    const source = 'export function add(a: i32): i32 { return a; }';
    const result = parseExports(source);
    expect(result).toEqual([{ name: 'add', kind: 'function' }]);
  });

  it('encuentra exports de clase', () => {
    const source = 'export class Foo { }';
    const result = parseExports(source);
    expect(result).toEqual([{ name: 'Foo', kind: 'class' }]);
  });

  it('encuentra exports de constante', () => {
    const source = 'export const PI: f64 = 3.14;';
    const result = parseExports(source);
    expect(result).toEqual([{ name: 'PI', kind: 'const' }]);
  });

  it('encuentra exports de enum', () => {
    const source = 'export enum Color { Red, Green, Blue }';
    const result = parseExports(source);
    expect(result).toEqual([{ name: 'Color', kind: 'enum' }]);
  });

  it('encuentra múltiples exports', () => {
    const source = `
      export function add(a: i32): i32 { return a; }
      export const PI: f64 = 3.14;
      export class Foo { }
    `;
    const result = parseExports(source);
    expect(result).toHaveLength(3);
  });

  it('retorna array vacío si no hay exports', () => {
    expect(parseExports('const x = 1;')).toEqual([]);
  });
});

describe('mergeAsConfig', () => {
  it('retorna objeto vacío si no hay configuración', () => {
    expect(mergeAsConfig({}, 'debug')).toEqual({});
  });

  it('mezcla defaults con target override', () => {
    const config = {
      options: { optimize: false, debug: true },
      targets: {
        debug: { debug: true, exportRuntime: true },
        release: { optimize: true, noAssert: true },
      },
    };
    const result = mergeAsConfig(config as any, 'release');
    expect(result.optimize).toBe(true);
    expect(result.noAssert).toBe(true);
    expect(result.debug).toBe(true); // por defecto
  });

  it('target override reemplaza defaults', () => {
    const config = {
      options: { optimize: false },
      targets: {
        release: { optimize: true },
      },
    };
    const result = mergeAsConfig(config as any, 'release');
    expect(result.optimize).toBe(true);
  });
});
