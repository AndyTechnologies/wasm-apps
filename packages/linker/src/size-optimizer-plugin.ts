import { PipelinePhase, logger, type PluginContext, type WasmPlugin, type PipelineContext } from '@wasm-apps/types';
import { stripWasm } from './strip-wasm.js';

const sizeOptimizerPlugin: WasmPlugin = {
  id: 'size-optimizer-plugin',

  register(ctx: PluginContext): void {
    const pipeline = ctx.pipeline;

    pipeline.register(PipelinePhase.BeforeCodeGen, this.id, async (pipelineCtx: PipelineContext) => {
      const modules = pipelineCtx.wasmModules;
      if (!modules || modules.length === 0) return;

      for (const mod of modules) {
        const originalSize = mod.buffer.length;
        const stripped = stripWasm(mod.buffer);
        if (stripped.length < originalSize) {
          mod.buffer = stripped;
          const saved = originalSize > 0
            ? ((1 - stripped.length / originalSize) * 100).toFixed(1)
            : '0.0';
          logger.detail(`  Stripped: ${mod.fileName} (${originalSize} → ${stripped.length} bytes, ${saved}% ahorrado)`);
        }
      }
    });
  },
};

export default sizeOptimizerPlugin;
