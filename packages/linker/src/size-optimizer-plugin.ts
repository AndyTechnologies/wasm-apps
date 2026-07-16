import { PipelinePhase, logger, type PluginContext, type WasmPlugin, type PipelineContext } from '@wasm-apps/types';
import { execFileSync } from 'node:child_process';

async function findWasmOpt(): Promise<string | null> {
  const candidates = ['wasm-opt'];
  const commandExists = (await import('command-exists')).default;
  for (const cmd of candidates) {
    try {
      await commandExists(cmd);
      return cmd;
    } catch {
      continue;
    }
  }
  return null;
}

function getOptimizeFlags(level?: string): string[] {
  const flags = ['--strip-debug', '--strip-producers', '--converge'];
  if (level === 'z') {
    flags.unshift('-Oz');
  } else if (level === 's') {
    flags.unshift('-Os');
  } else if (level === '0') {
    flags.unshift('-O0');
  } else if (level === '1') {
    flags.unshift('-O1');
  } else if (level === '2') {
    flags.unshift('-O2');
  } else {
    flags.unshift('-Oz');
  }
  return flags;
}

const sizeOptimizerPlugin: WasmPlugin = {
  id: 'size-optimizer-plugin',

  register(ctx: PluginContext): void {
    const pipeline = ctx.pipeline;

    pipeline.register(PipelinePhase.BeforeCodeGen, this.id, async (pipelineCtx: PipelineContext) => {
      const wasmOptPath = await findWasmOpt();
      if (!wasmOptPath) {
        logger.warn('size-optimizer: wasm-opt no encontrado en PATH. Instala Binaryen.');
        return;
      }

      const optLevel = ctx.config?.optimizeLevel as string | undefined;
      const flags = getOptimizeFlags(optLevel);

      logger.detail(`size-optimizer: ${wasmOptPath} ${flags.join(' ')}`);

      const modules = pipelineCtx.wasmModules;
      if (!modules || modules.length === 0) return;

      const fs = await import('node:fs');

      for (const mod of modules) {
        const inPath = mod.fileName;
        const tmpPath = inPath + '.opt.wasm';
        try {
          execFileSync(wasmOptPath, [...flags, inPath, '-o', tmpPath], { stdio: 'pipe' });
          const originalSize = mod.buffer.length;
          const optimized = fs.readFileSync(tmpPath);
          mod.buffer = optimized;
          fs.unlinkSync(tmpPath);
          const saved = originalSize > 0 ? ((1 - mod.buffer.length / originalSize) * 100).toFixed(1) : '0.0';
          logger.detail(`  Optimizado: ${mod.fileName} (${originalSize} → ${mod.buffer.length} bytes, ${saved}% ahorrado)`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn(`  Error en wasm-opt para ${mod.fileName}: ${message}`);
          if (fs.existsSync(tmpPath)) {
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
          }
        }
      }
    });
  },
};

export default sizeOptimizerPlugin;
