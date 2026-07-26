import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PipelinePhase, type PluginContext, type WasmPlugin } from '@wasm-apps/types';
import type { PipelineContext, RmluiPluginConfig } from '@wasm-apps/types';
import { getRmluiCacheDir, getSdlIncludeDir, getRmluiIncludeDir, getGladIncludeDir } from './rmlui-dl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Module-level plugin state ────────────────────────────────────────────────
let isActive = false;
let activeTemplatePath: string | undefined;
let activeConfig: RmluiPluginConfig = {};

const RMLUI_VERSION = '1.0.0';

// ── Placeholder host function C++ bodies ─────────────────────────────────────

function placeholderScalarReturn(name: string, returnVal: string): string {
  return `
    std::cerr << "[rmlui] " << "${name}" << " called (placeholder)" << std::endl;
    results[0] = Val(${returnVal});
    return std::monostate{};`;
}

function placeholderVoidReturn(name: string): string {
  return `
    std::cerr << "[rmlui] " << "${name}" << " called (placeholder)" << std::endl;
    return std::monostate{};`;
}

// ── Plugin definition ────────────────────────────────────────────────────────

const rmluiPlugin: WasmPlugin = {
  id: 'rmlui-plugin',

  register(ctx: PluginContext): void {
    isActive = true;

    // --- Register RmlUI/SDL host functions (placeholders) ---

    ctx.hostFunctions.register('env', 'Rml_CreateContext', (_params, _results) => placeholderScalarReturn('Rml_CreateContext', 'int32_t(1)'));
    ctx.hostFunctions.register('env', 'Rml_CreateElement', (_params, _results) => placeholderScalarReturn('Rml_CreateElement', 'int32_t(2)'));
    ctx.hostFunctions.register('env', 'Rml_AppendChild', (_params, _results) => placeholderScalarReturn('Rml_AppendChild', 'int32_t(0)'));
    ctx.hostFunctions.register('env', 'Rml_SetAttribute', (_params, _results) => placeholderScalarReturn('Rml_SetAttribute', 'int32_t(0)'));
    ctx.hostFunctions.register('env', 'Rml_GetAttribute', (_params, _results) => placeholderScalarReturn('Rml_GetAttribute', 'int32_t(0)'));
    ctx.hostFunctions.register('env', 'Rml_AddEventListener', (_params, _results) => placeholderScalarReturn('Rml_AddEventListener', 'int32_t(0)'));
    ctx.hostFunctions.register('env', 'Rml_LoadDocument', (_params, _results) => placeholderScalarReturn('Rml_LoadDocument', 'int32_t(0)'));
    ctx.hostFunctions.register('env', 'Rml_ShowDocument', (_params, _results) => placeholderVoidReturn('Rml_ShowDocument'));
    ctx.hostFunctions.register('env', 'RmlUI_ProcessSdlEvents', (_params, _results) => placeholderVoidReturn('RmlUI_ProcessSdlEvents'));
    ctx.hostFunctions.register('env', 'RmlUI_Update', (_params, _results) => placeholderVoidReturn('RmlUI_Update'));
    ctx.hostFunctions.register('env', 'RmlUI_Render', (_params, _results) => placeholderVoidReturn('RmlUI_Render'));
    ctx.hostFunctions.register('env', 'RmlUI_Shutdown', (_params, _results) => placeholderVoidReturn('RmlUI_Shutdown'));

    // --- Register BeforeCodeGen hook: set template path ---

    ctx.pipeline.register(PipelinePhase.BeforeCodeGen, 'rmlui-plugin', (_pCtx: PipelineContext) => {
      activeTemplatePath = path.resolve(__dirname, '../templates-rmlui');
    });

    // --- Register BeforeLink hook: add RmlUI extra libs ---

    ctx.pipeline.register(PipelinePhase.BeforeLink, 'rmlui-plugin', (_pCtx: PipelineContext) => {
      const cacheDir = getRmluiCacheDir();
      const sdlIncludeDir = getSdlIncludeDir(cacheDir, RMLUI_VERSION);
      const rmluiIncludeDir = getRmluiIncludeDir(cacheDir, RMLUI_VERSION);
      const gladIncludeDir = getGladIncludeDir(cacheDir, RMLUI_VERSION);

      ctx.logger.detail(`[rmlui-plugin] Extra libs would be added from:
        SDL:  ${sdlIncludeDir}
        RmlUI: ${rmluiIncludeDir}
        GLAD: ${gladIncludeDir}`);
    });

    // --- Store config ---

    if (ctx.config) {
      activeConfig = ctx.config as unknown as RmluiPluginConfig;
    }

    ctx.logger.detail('RmlUI plugin registered (placeholder host functions)');
  },
};

export default rmluiPlugin;

/**
 * Devuelve la configuración activa del plugin RmlUI.
 * Útil para que otras partes del sistema consulten el estado del plugin.
 */
export function getRmluiConfig(): { isActive: boolean; config: RmluiPluginConfig; templatePath?: string } {
  return {
    isActive,
    config: activeConfig,
    templatePath: activeTemplatePath,
  };
}
