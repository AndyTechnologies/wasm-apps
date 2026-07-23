import { type ICacheRepository, type CacheInfo, LinkerError } from '@wasm-apps/types';
import { isBuildUpToDate, saveBuildManifest, getBuildCacheInfo, clearBuildCache } from './build-cache.js';

export interface BuildManifestOptions {
  entry: string;
  target?: string;
  wasi: boolean;
  moduleMatching: string;
  wasmtimePath?: string;
  wasmtimeVersion: string;
}

export class LinkerManifestRepository implements ICacheRepository<string> {
  private rootDir?: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir;
  }

  setRootDir(rootDir: string): void {
    this.rootDir = rootDir;
  }

  async get(_key: string): Promise<string | undefined> {
    throw new LinkerError('LinkerManifestRepository does not support get() by key. Use isUpToDate() to check cache validity.');
  }

  async set(_key: string, _value: string): Promise<void> {
    throw new LinkerError('LinkerManifestRepository does not support set(). Use save() with structured options.');
  }

  async has(key: string): Promise<boolean> {
    if (!key) return false;
    const parts = key.split('::');
    if (parts.length < 2) return false;
    const wasmFiles = parts[0].split(',');
    const output = parts[1];
    let options: Record<string, any> = {};
    try {
      options = JSON.parse(parts[2] || '{}');
    } catch {
      return false;
    }
    return isBuildUpToDate(wasmFiles, output, options as any, this.rootDir);
  }

  async delete(_key: string): Promise<void> {
    clearBuildCache(this.rootDir);
  }

  async clear(): Promise<void> {
    clearBuildCache(this.rootDir);
  }

  async info(): Promise<CacheInfo> {
    return getBuildCacheInfo(this.rootDir);
  }

  isUpToDate(
    wasmFiles: string[],
    output: string,
    options: {
      entry: string;
      target?: string;
      wasi: boolean;
      moduleMatching: string;
      wasmtimePath?: string;
      wasmtimeVersion: string;
    },
  ): Promise<boolean> {
    return isBuildUpToDate(wasmFiles, output, options, this.rootDir);
  }

  save(wasmFiles: string[], output: string, options: BuildManifestOptions): void {
    saveBuildManifest(wasmFiles, output, options, this.rootDir);
  }
}
