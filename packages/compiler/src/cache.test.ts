import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache, MAX_MEMORY_CACHE_SIZE } from './cache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3);
  });

  it('stores and retrieves values', () => {
    cache.set('a', '1');
    expect(cache.get('a')).toBe('1');
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('evicts least recently used when full', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('promotes accessed keys to most recent', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a');
    cache.set('d', '4');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  it('has correct max size', () => {
    expect(MAX_MEMORY_CACHE_SIZE).toBe(50);
  });
});
