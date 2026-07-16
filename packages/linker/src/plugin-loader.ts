import path from 'node:path';
import { logger, type PluginConfig } from '@wasm-apps/types';
import { hostFunctionRegistry } from './host-function-registry.js';
import { pipeline } from './pipeline.js';

export interface PluginContext {
  hostFunctions: typeof hostFunctionRegistry;
  pipeline: typeof pipeline;
  config?: Record<string, unknown>;
  logger: typeof logger;
}

export interface WasmPlugin {
  id: string;
  register(ctx: PluginContext): void;
}

const DEFAULT_PLUGINS: PluginConfig[] = [
  { id: 'stdlib-plugin', enabled: true, config: {} },
];

export async function loadPlugins(pluginConfigs?: PluginConfig[]): Promise<void> {
  const configs = (pluginConfigs && pluginConfigs.length > 0) ? pluginConfigs : DEFAULT_PLUGINS;

  for (const cfg of configs) {
    if (!cfg.enabled) continue;

    const context: PluginContext = {
      hostFunctions: hostFunctionRegistry,
      pipeline,
      config: cfg.config,
      logger,
    };

    if (cfg.id === 'stdlib-plugin') {
      continue;
    }

    if (cfg.path) {
      const resolvedPath = path.resolve(cfg.path);
      try {
        const mod = await import(resolvedPath) as { default?: WasmPlugin; register?: (ctx: PluginContext) => void };
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
