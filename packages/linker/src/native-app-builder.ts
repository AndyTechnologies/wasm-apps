import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  type ILinkerStrategy,
  type ICodegenStrategy,
  type ModuleMatchingStrategy,
  type WasmModuleInfo,
  type CacheInfo,
  LinkerError,
  logger,
} from '@wasm-apps/types';
import { parseWasmModule } from './wasm-io.js';
import { WasmtimeLinkerStrategy } from './wasmtime-linker-strategy.js';
import { DefaultCodegenStrategy } from './default-codegen-strategy.js';
import { isBuildUpToDate, saveBuildManifest } from './build-cache.js';

export class NativeAppBuilder {
  private wasmPaths: string[] = [];
  private resolvedModules: WasmModuleInfo[] = [];
  private entry = '_start';
  private target?: string;
  private wasi = false;
  private moduleMatching: ModuleMatchingStrategy = 'file-name';
  private wasmtimeVersion: string;
  private wasmtimePath?: string;
  private outputPath?: string;
  private linkerStrategy: ILinkerStrategy;
  private codegenStrategy: ICodegenStrategy;
  private validateBeforeBuild = true;

  constructor(linkerStrategy?: ILinkerStrategy, codegenStrategy?: ICodegenStrategy, wasmtimeVersion?: string) {
    this.linkerStrategy = linkerStrategy || new WasmtimeLinkerStrategy();
    this.codegenStrategy = codegenStrategy || new DefaultCodegenStrategy();
    this.wasmtimeVersion = wasmtimeVersion || '46.0.1';
  }

  addWasmModule(wasmPath: string): this {
    this.wasmPaths.push(path.resolve(wasmPath));
    return this;
  }

  addWasmModules(paths: string[]): this {
    for (const p of paths) {
      this.addWasmModule(p);
    }
    return this;
  }

  setEntry(name: string): this {
    this.entry = name;
    return this;
  }

  setTarget(target: string): this {
    this.target = target;
    return this;
  }

  setWasi(enabled: boolean): this {
    this.wasi = enabled;
    return this;
  }

  setModuleMatching(strategy: ModuleMatchingStrategy): this {
    this.moduleMatching = strategy;
    return this;
  }

  setWasmtimePath(wtPath: string): this {
    this.wasmtimePath = wtPath;
    return this;
  }

  setWasmtimeVersion(version: string): this {
    this.wasmtimeVersion = version;
    return this;
  }

  setOutputPath(output: string): this {
    this.outputPath = path.resolve(output);
    return this;
  }

  setValidateBeforeBuild(validate: boolean): this {
    this.validateBeforeBuild = validate;
    return this;
  }

  setLinkerStrategy(strategy: ILinkerStrategy): this {
    this.linkerStrategy = strategy;
    return this;
  }

  setCodegenStrategy(strategy: ICodegenStrategy): this {
    this.codegenStrategy = strategy;
    return this;
  }

  private resolveWasmtimePath(): string | undefined {
    if (this.wasmtimePath) return this.wasmtimePath;
    const cacheDir = path.join(os.homedir(), '.wasm-linker');
    let entries: string[];
    try {
      entries = fs.readdirSync(cacheDir).filter((e) => e.startsWith('wasmtime-v') && e.endsWith('-c-api'));
    } catch {
      return undefined;
    }
    const versioned = entries.filter((e) => /^wasmtime-v\d+\.\d+\.\d+-c-api$/.test(e));
    if (versioned.length === 0) return undefined;
    versioned.sort((a, b) => {
      const va = a.match(/wasmtime-v([\d.]+)/)![1];
      const vb = b.match(/wasmtime-v([\d.]+)/)![1];
      const pa = va.split('.').map(Number);
      const pb = vb.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const cmp = (pa[i] || 0) - (pb[i] || 0);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return path.join(cacheDir, versioned[versioned.length - 1]);
  }

  private validate(): void {
    if (this.wasmPaths.length === 0) {
      throw new LinkerError('No WASM modules added. Call addWasmModule() first.');
    }
    if (!this.outputPath) {
      throw new LinkerError('No output path set. Call setOutputPath() first.');
    }
    for (const wasmPath of this.wasmPaths) {
      if (!fs.existsSync(wasmPath)) {
        throw new LinkerError(`WASM module not found: ${wasmPath}`);
      }
    }
  }

  async isCacheUpToDate(): Promise<boolean> {
    if (!this.outputPath) return false;
    const resolvedPath = this.resolveWasmtimePath();
    return isBuildUpToDate(this.wasmPaths, this.outputPath, {
      entry: this.entry,
      target: this.target,
      wasi: this.wasi,
      moduleMatching: this.moduleMatching,
      wasmtimePath: resolvedPath || undefined,
      wasmtimeVersion: this.wasmtimeVersion,
    });
  }

  async build(quiet = false): Promise<string> {
    if (this.validateBeforeBuild) {
      this.validate();
    }

    const outputPath = this.outputPath!;
    const resolvedWasmtimePath = this.resolveWasmtimePath();

    if (!resolvedWasmtimePath && !quiet) {
      logger.warn('Wasmtime C-API not found in cache. Run setup first or set wasmtimePath.');
    }

    if (!quiet) {
      const cacheOk = await this.isCacheUpToDate();
      if (cacheOk) {
        logger.success(`Build up-to-date: ${outputPath}`);
        return outputPath;
      }
    }

    if (!quiet) logger.step('Parsing WASM modules...');

    this.resolvedModules = [];
    const allImportFuncTypes = [];

    for (const wasmPath of this.wasmPaths) {
      const module = parseWasmModule(wasmPath);
      this.resolvedModules.push(module);
      if (module.importFuncTypes) {
        allImportFuncTypes.push(...module.importFuncTypes);
      }
    }

    if (!quiet) {
      for (const mod of this.resolvedModules) {
        const funcExports = mod.exports.filter((e) => e.kind === 'function').map((e) => e.name);
        const funcImports = mod.imports.filter((i) => i.kind === 'function').map((i) => `${i.module}.${i.name}`);
        logger.detail(`  ${mod.fileName}: ${funcExports.length} exports, ${funcImports.length} imports`);
      }
    }

    if (!quiet) logger.step('Linking native binary...');

    const nativeOptions = {
      inputPaths: this.wasmPaths,
      output: outputPath,
      target: this.target,
      entry: this.entry,
      wasi: this.wasi,
      moduleMatching: this.moduleMatching,
      wasmtimePath: resolvedWasmtimePath,
    };

    const result = await this.linkerStrategy.link(this.resolvedModules, nativeOptions);

    saveBuildManifest(this.wasmPaths, outputPath, {
      entry: this.entry,
      target: this.target || '',
      wasi: this.wasi,
      moduleMatching: this.moduleMatching,
      wasmtimePath: resolvedWasmtimePath || '',
      wasmtimeVersion: this.wasmtimeVersion,
    });

    if (!quiet) logger.success(`Built: ${outputPath}`);
    return result;
  }
}
