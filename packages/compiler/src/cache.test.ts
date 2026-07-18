import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './cache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache(3);
  });

  it('almacena y recupera valores', () => {
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('retorna undefined para claves inexistentes', () => {
    expect(cache.get('no-existe')).toBeUndefined();
  });

  it('informa si una clave existe', () => {
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('elimina la entrada LRU cuando excede el tamaño máximo', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('promueve una clave al accederla (MRU)', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // promueve 'a'
    cache.set('d', 4);
    expect(cache.has('a')).toBe(true); // 'a' fue promovida
    expect(cache.has('b')).toBe(false); // 'b' fue la LRU
  });

  it('actualiza el valor si la clave ya existe', () => {
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.get('a')).toBe(2);
    expect(cache.size).toBe(1);
  });

  it('elimina una clave específica', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(1);
  });

  it('limpia toda la caché', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('usa MAX_MEMORY_CACHE_SIZE por defecto', () => {
    expect(MAX_MEMORY_CACHE_SIZE).toBe(100);
    const bigCache = new LRUCache<string, number>();
    expect(bigCache['maxSize']).toBe(100);
  });
});
