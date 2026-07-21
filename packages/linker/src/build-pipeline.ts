import path from 'node:path';
import fs from 'node:fs';
import {
  type Stage,
  type PipelineContext,
  type WasmModuleInfo,
  type WasmImportFuncType,
  type ModuleMatchingStrategy,
  type ResolvedLink,
  LinkerError,
  logger,
} from '@wasm-apps/types';
import { resolveDependencies } from './linker.js';
import { generateCCode } from './codegen.js';
import { compileCpp } from './compiler.js';
import { parseWasmModule } from './wasm-io.js';
import { NativeAppBuilder } from './native-app-builder.js';

export interface ParsedModulesOutput {
  modules: WasmModuleInfo[];
  importFuncTypes: WasmImportFuncType[];
}

export class ParseModulesStage implements Stage<string[], ParsedModulesOutput> {
  readonly name = 'parse-modules';

  async execute(input: string[], _context: PipelineContext): Promise<ParsedModulesOutput> {
    const modules: WasmModuleInfo[] = [];
    const allImportFuncTypes: WasmImportFuncType[] = [];
    for (const inputPath of input) {
      const mod = parseWasmModule(inputPath);
      modules.push(mod);
      if (mod.importFuncTypes) {
        allImportFuncTypes.push(...mod.importFuncTypes);
      }
    }
    return { modules, importFuncTypes: allImportFuncTypes };
  }
}

export class ResolveDependenciesStage implements Stage<ParsedModulesOutput, { resolved: ResolvedLink; importFuncTypes: WasmImportFuncType[] }> {
  readonly name = 'resolve-dependencies';
  private moduleMatching: ModuleMatchingStrategy;

  constructor(moduleMatching: ModuleMatchingStrategy = 'file-name') {
    this.moduleMatching = moduleMatching;
  }

  async execute(input: ParsedModulesOutput, _context: PipelineContext): Promise<{ resolved: ResolvedLink; importFuncTypes: WasmImportFuncType[] }> {
    const resolved = resolveDependencies(input.modules, this.moduleMatching);
    return { resolved, importFuncTypes: input.importFuncTypes };
  }
}

export class GenerateCodeStage implements Stage<{ resolved: ResolvedLink; importFuncTypes: WasmImportFuncType[] }, string> {
  readonly name = 'generate-code';
  private entry: string;
  private wasi: boolean;

  constructor(entry: string = '_start', wasi: boolean = false) {
    this.entry = entry;
    this.wasi = wasi;
  }

  async execute(input: { resolved: ResolvedLink; importFuncTypes: WasmImportFuncType[] }, _context: PipelineContext): Promise<string> {
    return generateCCode(input.resolved, this.entry, this.wasi, input.importFuncTypes.length > 0 ? input.importFuncTypes : undefined);
  }
}

export class CompileCppStage implements Stage<string, string> {
  readonly name = 'compile-cpp';
  private outputPath: string;
  private wasmtimePath?: string;
  private target?: string;
  private entry: string;
  private wasi: boolean;
  private moduleMatching: ModuleMatchingStrategy;

  constructor(
    outputPath: string,
    options: {
      wasmtimePath?: string;
      target?: string;
      entry?: string;
      wasi?: boolean;
      moduleMatching?: ModuleMatchingStrategy;
    } = {},
  ) {
    this.outputPath = outputPath;
    this.wasmtimePath = options.wasmtimePath;
    this.target = options.target;
    this.entry = options.entry || '_start';
    this.wasi = options.wasi || false;
    this.moduleMatching = options.moduleMatching || 'file-name';
  }

  async execute(input: string, _context: PipelineContext): Promise<string> {
    const outDir = path.dirname(this.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    await compileCpp(input, this.outputPath, {
      inputPaths: [],
      output: this.outputPath,
      entry: this.entry,
      wasi: this.wasi,
      moduleMatching: this.moduleMatching,
      wasmtimePath: this.wasmtimePath,
      target: this.target,
    });

    return this.outputPath;
  }
}

export class BuildPipeline {
  private stages: Stage<any, any>[] = [];

  constructor(stages?: Stage<any, any>[]) {
    if (stages) {
      this.stages = stages;
    }
  }

  addStage(stage: Stage<any, any>): this {
    this.stages.push(stage);
    return this;
  }

  async run(initialInput: any, context?: PipelineContext): Promise<any> {
    let currentInput = initialInput;

    for (const stage of this.stages) {
      logger.step(`Pipeline: ${stage.name}...`);
      currentInput = await stage.execute(currentInput, context || ({} as PipelineContext));
    }

    return currentInput;
  }

  static createDefaultPipeline(
    outputPath: string,
    options: {
      entry?: string;
      wasi?: boolean;
      moduleMatching?: ModuleMatchingStrategy;
      wasmtimePath?: string;
      target?: string;
    } = {},
  ): BuildPipeline {
    return new BuildPipeline([
      new ParseModulesStage(),
      new ResolveDependenciesStage(options.moduleMatching || 'file-name'),
      new GenerateCodeStage(options.entry || '_start', options.wasi || false),
      new CompileCppStage(outputPath, options),
    ]);
  }

  static builder(): NativeAppBuilder {
    return new NativeAppBuilder();
  }
}
