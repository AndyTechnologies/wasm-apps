export const MAX_MEMORY_CACHE_SIZE = 100;

/**
 * Caché LRU (Least Recently Used) en memoria.
 * Expulsa la entrada más antigua cuando se supera el límite de tamaño.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;

  constructor(private maxSize: number = MAX_MEMORY_CACHE_SIZE) {
    this.cache = new Map();
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  /** Recupera un valor, promoviéndolo a la posición MRU. */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }

  /** Almacena un valor. Expulsa la entrada LRU si el tamaño supera el máximo. */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const lru = this.cache.keys().next().value;
      if (lru !== undefined) this.cache.delete(lru);
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
