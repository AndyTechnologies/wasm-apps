import { type ICacheRepository, type CacheInfo, type CompileResult } from '@wasm-apps/types';
import { getCached, saveToCache, computeKey, computeToolchainKey, getCompileCacheInfo, clearCompileCache, deleteCacheEntry } from './disk-cache.js';
import type { CompileOptions } from '@wasm-apps/types';

export class CompilerCacheRepository implements ICacheRepository<CompileResult> {
  private currentOptions?: Partial<CompileOptions>;
  private currentToolchainId?: string;

  setOptions(options: Partial<CompileOptions>): void {
    this.currentOptions = options;
  }

  /**
   * Establece el toolchainId para usar en la generación de claves de caché.
   * Cuando se establece, buildKey() usa computeToolchainKey() en lugar de computeKey().
   */
  setToolchainId(id: string): void {
    this.currentToolchainId = id;
  }

  private buildKey(sourceCode: string): string {
    if (this.currentToolchainId) {
      return computeToolchainKey(sourceCode, this.currentToolchainId, this.currentOptions || {});
    }
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

  /**
   * Obtiene un resultado de caché usando sourceCode + toolchainId.
   * Si toolchainId difiere del actual, lo establece temporalmente.
   */
  getFromSourceWithToolchain(sourceCode: string, toolchainId: string): CompileResult | null {
    const key = computeToolchainKey(sourceCode, toolchainId, this.currentOptions || {});
    return getCached(key);
  }

  /**
   * Guarda un resultado en caché usando sourceCode + toolchainId.
   */
  saveFromSourceWithToolchain(sourceCode: string, toolchainId: string, result: CompileResult): void {
    const key = computeToolchainKey(sourceCode, toolchainId, this.currentOptions || {});
    saveToCache(key, result);
  }
}
