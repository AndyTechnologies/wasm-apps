import os from 'node:os';
import path from 'node:path';
import { type ICacheRepository, type CacheInfo, LinkerError, formatBytes } from '@wasm-apps/types';
import { CacheManager } from './cache.js';

export class DownloadCacheRepository implements ICacheRepository<string> {
  private manager: CacheManager;
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(os.homedir(), '.wasm-linker');
    this.manager = new CacheManager(this.cacheDir);
  }

  async get(_key: string): Promise<string | undefined> {
    throw new LinkerError('DownloadCacheRepository does not support get() by key. Use getCacheDir() to access the download path.');
  }

  async set(_key: string, _value: string): Promise<void> {
    throw new LinkerError('DownloadCacheRepository does not support set(). Downloads are managed internally.');
  }

  async has(_key: string): Promise<boolean> {
    return this.manager.exists();
  }

  async delete(_key: string): Promise<void> {
    this.manager.clear();
  }

  async clear(): Promise<void> {
    this.manager.clear();
  }

  async info(): Promise<CacheInfo> {
    const summary = this.manager.summarize();
    return {
      path: this.cacheDir,
      exists: this.manager.exists(),
      size: summary.sizeBytes,
      humanSize: formatBytes(summary.sizeBytes),
      entries: summary.fileCount,
    };
  }

  getCacheDir(): string {
    return this.cacheDir;
  }

  getManager(): CacheManager {
    return this.manager;
  }
}
