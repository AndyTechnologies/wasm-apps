import { type IPluginManager, type ICompilerStrategy, type ILinkerStrategy, type ICodegenStrategy, type WasmPlugin, type PluginConfig } from '@wasm-apps/types';
import { loadPlugins } from './plugin-loader.js';

export class PluginManager implements IPluginManager {
  private compilers = new Map<string, ICompilerStrategy>();
  private linkers = new Map<string, ILinkerStrategy>();
  private codegens = new Map<string, ICodegenStrategy>();
  private wasmPlugins = new Map<string, WasmPlugin>();

  registerCompiler(plugin: ICompilerStrategy): void {
    this.compilers.set(plugin.name, plugin);
  }

  getCompiler(name: string): ICompilerStrategy | undefined {
    return this.compilers.get(name);
  }

  registerLinker(plugin: ILinkerStrategy): void {
    this.linkers.set(plugin.name, plugin);
  }

  getLinker(name: string): ILinkerStrategy | undefined {
    return this.linkers.get(name);
  }

  registerCodegen(plugin: ICodegenStrategy): void {
    this.codegens.set(plugin.name, plugin);
  }

  getCodegen(name: string): ICodegenStrategy | undefined {
    return this.codegens.get(name);
  }

  registerWasmPlugin(plugin: WasmPlugin): void {
    this.wasmPlugins.set(plugin.id, plugin);
  }

  getWasmPlugin(id: string): WasmPlugin | undefined {
    return this.wasmPlugins.get(id);
  }

  async loadWasmPlugins(configs?: PluginConfig[]): Promise<void> {
    await loadPlugins(configs);
  }

  getAvailableCompilers(): string[] {
    return Array.from(this.compilers.keys());
  }

  getAvailableLinkers(): string[] {
    return Array.from(this.linkers.keys());
  }

  getAvailableCodegens(): string[] {
    return Array.from(this.codegens.keys());
  }
}

export const pluginManager = new PluginManager();
