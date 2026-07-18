import { describe, it, expect, beforeEach } from 'vitest';
import { Pipeline } from './pipeline.js';

describe('Pipeline', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    pipeline = new Pipeline();
  });

  it('ejecuta hooks registrados en una fase', async () => {
    const calls: string[] = [];
    pipeline.register('beforeModuleCompile' as any, 'test-plugin', async () => {
      calls.push('hook-called');
    });
    const context = { options: { entry: '_start', wasi: false, moduleMatching: 'file-name' as const } };
    await pipeline.runPhase('beforeModuleCompile' as any, context);
    expect(calls).toEqual(['hook-called']);
  });

  it('no ejecuta hooks de otras fases', async () => {
    const calls: string[] = [];
    pipeline.register('beforeModuleCompile' as any, 'p1', () => {
      calls.push('p1');
    });
    pipeline.register('afterModuleCompile' as any, 'p2', () => {
      calls.push('p2');
    });
    const context = { options: { entry: '_start', wasi: false, moduleMatching: 'file-name' as const } };
    await pipeline.runPhase('beforeModuleCompile' as any, context);
    expect(calls).toEqual(['p1']);
  });

  it('retorna context sin cambios si no hay hooks', async () => {
    const context = { options: { entry: '_start', wasi: false, moduleMatching: 'file-name' as const } };
    const result = await pipeline.runPhase('beforeModuleCompile' as any, context);
    expect(result).toEqual(context);
  });

  it('elimina hooks al desregistrar un plugin', () => {
    pipeline.register('beforeModuleCompile' as any, 'test', async () => {});
    pipeline.unregister('test');
    expect(pipeline['hooks']).toHaveLength(0);
  });

  it('limpia todos los hooks', () => {
    pipeline.register('beforeModuleCompile' as any, 'p1', async () => {});
    pipeline.register('afterModuleCompile' as any, 'p2', async () => {});
    pipeline.clear();
    expect(pipeline['hooks']).toHaveLength(0);
  });
});
