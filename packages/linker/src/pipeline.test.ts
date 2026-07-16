import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from './pipeline.js';
import { PipelinePhase } from '@wasm-apps/types';

describe('Pipeline', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    pipeline = new Pipeline();
  });

  it('registers and runs a hook', async () => {
    const hook = vi.fn();
    pipeline.register(PipelinePhase.BeforeCodeGen, 'test-plugin', hook);
    const ctx = {} as any;
    await pipeline.runPhase(PipelinePhase.BeforeCodeGen, ctx);
    expect(hook).toHaveBeenCalledOnce();
  });

  it('runs registered hooks in order', async () => {
    const order: number[] = [];
    pipeline.register(PipelinePhase.BeforeCodeGen, 'p1', async () => { order.push(1); });
    pipeline.register(PipelinePhase.BeforeCodeGen, 'p2', async () => { order.push(2); });
    await pipeline.runPhase(PipelinePhase.BeforeCodeGen, {} as any);
    expect(order).toEqual([1, 2]);
  });

  it('does not run hooks from other phases', async () => {
    const hook = vi.fn();
    pipeline.register(PipelinePhase.AfterCodeGen, 'p', hook);
    await pipeline.runPhase(PipelinePhase.BeforeCodeGen, {} as any);
    expect(hook).not.toHaveBeenCalled();
  });

  it('passes context to hooks', async () => {
    const hook = vi.fn();
    pipeline.register(PipelinePhase.BeforeLink, 'p', hook);
    const ctx = { outputPath: '/out/bin' } as any;
    await pipeline.runPhase(PipelinePhase.BeforeLink, ctx);
    expect(hook).toHaveBeenCalledWith(ctx);
  });

  it('handles sync hooks', async () => {
    const hook = vi.fn();
    pipeline.register(PipelinePhase.AfterBundle, 'p', hook);
    await pipeline.runPhase(PipelinePhase.AfterBundle, {} as any);
    expect(hook).toHaveBeenCalled();
  });

  it('runs all phases in order via runAll', async () => {
    const phases: string[] = [];
    for (const phase of Object.values(PipelinePhase)) {
      pipeline.register(phase, 'recorder', async () => { phases.push(phase); });
    }
    await pipeline.runAll({} as any);
    expect(phases).toEqual(Object.values(PipelinePhase));
  });

  it('unregisters a hook', async () => {
    const hook = vi.fn();
    pipeline.register(PipelinePhase.BeforeCodeGen, 'to-remove', hook);
    pipeline.unregister('to-remove');
    await pipeline.runPhase(PipelinePhase.BeforeCodeGen, {} as any);
    expect(hook).not.toHaveBeenCalled();
  });
});
