import { PipelinePhase, type PipelineContext, type PipelineHook } from '@wasm-apps/types';
import { logger } from '@wasm-apps/types';

interface HookEntry {
  pluginId: string;
  hook: PipelineHook;
  phase: PipelinePhase;
}

function deepCloneContext(ctx: PipelineContext): PipelineContext {
  return structuredClone(ctx);
}

/**
 * Pipeline de fases del toolchain WASM.
 *
 * Permite que plugins se registren en fases específicas del pipeline
 * (BeforeModuleCompile, AfterModuleCompile, BeforeCodeGen, etc.)
 * y se ejecuten en orden durante el build.
 */
export class Pipeline {
  private hooks: HookEntry[] = [];

  /** Registra un hook para una fase del pipeline. */
  register(phase: PipelinePhase, pluginId: string, hook: PipelineHook): void {
    this.hooks.push({ pluginId, hook, phase });
  }

  /** Elimina todos los hooks de un plugin. */
  unregister(pluginId: string): void {
    this.hooks = this.hooks.filter((h) => h.pluginId !== pluginId);
  }

  /** Ejecuta todos los hooks registrados para una fase específica. */
  async runPhase(phase: PipelinePhase, context: PipelineContext): Promise<PipelineContext> {
    const phaseHooks = this.hooks.filter((h) => h.phase === phase);
    if (phaseHooks.length === 0) return context;

    logger.detail(`  Pipeline [${phase}]: ${phaseHooks.length} hook(s)`);
    const currentContext = deepCloneContext(context);
    for (const entry of phaseHooks) {
      logger.detail(`    → ${entry.pluginId}`);
      await entry.hook(currentContext);
    }
    return currentContext;
  }

  /** Ejecuta todos los hooks de todas las fases en orden. */
  async runAll(context: PipelineContext): Promise<PipelineContext> {
    const phases = Object.values(PipelinePhase);
    let currentContext = context;
    for (const phase of phases) {
      currentContext = await this.runPhase(phase, currentContext);
    }
    return currentContext;
  }

  /** Elimina todos los hooks registrados. */
  clear(): void {
    this.hooks = [];
  }
}

/** Instancia global singleton del pipeline usada en todo el toolchain. */
export const pipeline = new Pipeline();
