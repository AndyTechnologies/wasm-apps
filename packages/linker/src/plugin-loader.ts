import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger, type PluginConfig, type PluginContext, type WasmPlugin } from '@wasm-apps/types';
import { hostFunctionRegistry } from './host-function-registry.js';
import { pipeline } from './pipeline.js';

const DEFAULT_PLUGINS: PluginConfig[] = [
  { id: 'stdlib-plugin', enabled: true, config: {} },
  { id: 'size-optimizer-plugin', enabled: true, config: {} },
];

function createContext(cfg: PluginConfig): PluginContext {
  return {
    hostFunctions: hostFunctionRegistry,
    pipeline,
    config: cfg.config,
    logger,
  };
}

function registerPlugin(plugin: WasmPlugin, context: PluginContext): void {
  plugin.register(context);
  logger.detail(`Plugin cargado: ${plugin.id}`);
}

export async function loadPlugins(pluginConfigs?: PluginConfig[]): Promise<void> {
  const configs = (pluginConfigs && pluginConfigs.length > 0) ? pluginConfigs : DEFAULT_PLUGINS;

  for (const cfg of configs) {
    if (!cfg.enabled) continue;

    const context = createContext(cfg);

    if (cfg.id === 'stdlib-plugin') {
      continue;
    }

    if (cfg.id === 'size-optimizer-plugin') {
      const { default: sizePlugin } = await import('./size-optimizer-plugin.js');
      registerPlugin(sizePlugin, context);
      continue;
    }

    if (cfg.path) {
      const resolvedPath = path.resolve(cfg.path);
      try {
        const mod = await import(pathToFileURL(resolvedPath).href) as { default?: WasmPlugin; register?: (ctx: PluginContext) => void };
        const plugin: WasmPlugin | undefined = mod.default || (mod as unknown as WasmPlugin);
        if (plugin && typeof plugin.register === 'function') {
          plugin.register(context);
          logger.detail(`Plugin cargado: ${cfg.id} desde ${resolvedPath}`);
        } else if (typeof mod.register === 'function') {
          mod.register(context);
          logger.detail(`Plugin cargado: ${cfg.id} desde ${resolvedPath}`);
        } else {
          logger.warn(`Plugin ${cfg.id}: no exporta funcion register()`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`Error cargando plugin ${cfg.id} desde ${resolvedPath}: ${message}`);
      }
    }
  }
}
