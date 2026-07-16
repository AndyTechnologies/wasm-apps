import { PipelinePhase, type PipelineContext, type PipelineHook } from '@wasm-apps/types';
import { logger } from '@wasm-apps/types';

interface HookEntry {
  pluginId: string;
  hook: PipelineHook;
  phase: PipelinePhase;
}

export class Pipeline {
  private hooks: HookEntry[] = [];

  register(phase: PipelinePhase, pluginId: string, hook: PipelineHook): void {
    this.hooks.push({ pluginId, hook, phase });
  }

  unregister(pluginId: string): void {
    this.hooks = this.hooks.filter(h => h.pluginId !== pluginId);
  }

  async runPhase(phase: PipelinePhase, context: PipelineContext): Promise<PipelineContext> {
    const phaseHooks = this.hooks.filter(h => h.phase === phase);
    if (phaseHooks.length === 0) return context;

    logger.detail(`  Pipeline [${phase}]: ${phaseHooks.length} hook(s)`);
    let currentContext = { ...context };
    for (const entry of phaseHooks) {
      logger.detail(`    → ${entry.pluginId}`);
      await entry.hook(currentContext);
    }
    return currentContext;
  }

  async runAll(context: PipelineContext): Promise<PipelineContext> {
    const phases = Object.values(PipelinePhase);
    let currentContext = context;
    for (const phase of phases) {
      currentContext = await this.runPhase(phase, currentContext);
    }
    return currentContext;
  }

  clear(): void {
    this.hooks = [];
  }
}

export const pipeline = new Pipeline();
