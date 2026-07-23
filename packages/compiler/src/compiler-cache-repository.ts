import { type ICacheRepository, type CacheInfo, type CompileResult } from '@wasm-apps/types';
import { getCached, saveToCache, computeKey, getCompileCacheInfo, clearCompileCache, deleteCacheEntry } from './disk-cache.js';
import type { CompileOptions } from '@wasm-apps/types';

export class CompilerCacheRepository implements ICacheRepository<CompileResult> {
  private currentOptions?: Partial<CompileOptions>;

  setOptions(options: Partial<CompileOptions>): void {
    this.currentOptions = options;
  }

  private buildKey(sourceCode: string): string {
    return computeKey(sourceCode, this.currentOptions || {});
  }

  async get(key: string): Promise<CompileResult | undefined> {
    const cached = getCached(key);
    return cached ?? undefined;
  }

  async set(key: string, value: CompileResult): Promise<void> {
    saveToCache(key, value);
  }

  async has(key: string): Promise<boolean> {
    const cached = getCached(key);
    return cached !== null;
  }

  async delete(key: string): Promise<void> {
    deleteCacheEntry(key);
  }

  async clear(): Promise<void> {
    clearCompileCache();
  }

  async info(): Promise<CacheInfo> {
    return getCompileCacheInfo();
  }

  getFromSource(sourceCode: string): CompileResult | null {
    const key = this.buildKey(sourceCode);
    return getCached(key);
  }

  saveFromSource(sourceCode: string, result: CompileResult): void {
    const key = this.buildKey(sourceCode);
    saveToCache(key, result);
  }
}
