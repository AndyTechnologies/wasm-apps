import type { PluginContext, WasmPlugin, PipelineContext } from '@wasm-apps/types';
import { PipelinePhase } from '@wasm-apps/types';
import { treeShake } from './tree-shake.js';

const plugin: WasmPlugin = {
  id: 'tree-shake',
  register(ctx: PluginContext): void {
    ctx.pipeline.register(PipelinePhase.BeforeCodeGen, 'tree-shake', async (pCtx: PipelineContext) => {
      if (!pCtx.wasmModules) return;

      let totalRemoved = 0;
      let totalOriginalSize = 0;

      for (const mod of pCtx.wasmModules) {
        const originalSize = mod.buffer.length;
        totalOriginalSize += originalSize;
        const treeShaken = treeShake(Buffer.from(mod.buffer));
        if (treeShaken.length < originalSize) {
          const removed = originalSize - treeShaken.length;
          totalRemoved += removed;
          mod.buffer = Buffer.from(treeShaken);
        }
      }

      if (totalRemoved > 0) {
        const pct = ((totalRemoved / totalOriginalSize) * 100).toFixed(1);
        ctx.logger.info(`Tree-shaking: ${(totalRemoved / 1024).toFixed(1)}KB eliminados (${pct}%)`);
      }
    });
  },
};

export default plugin;
