import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkerError } from '@wasm-apps/types';
import type { Stage, PipelineContext } from '@wasm-apps/types';

// Create simple mock stages for pipeline testing
function makeStage(name: string, output: any): Stage<any, any> {
  return {
    name,
    execute: vi.fn().mockResolvedValue(output),
  };
}

const mockContext: PipelineContext = {
  options: {
    entry: '_start',
    wasi: false,
    moduleMatching: 'file-name',
  },
};

describe('BuildPipeline stage lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs stages in order and passes output between them', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');

    const stage1 = makeStage('stage-1', { data: 'from-stage-1' });
    const stage2 = makeStage('stage-2', { data: 'from-stage-2' });
    const stage3 = makeStage('stage-3', { data: 'from-stage-3' });

    const pipeline = new BuildPipeline([stage1, stage2, stage3]);
    const result = await pipeline.run('initial-input', mockContext);

    expect(stage1.execute).toHaveBeenCalledWith('initial-input', mockContext);
    expect(stage2.execute).toHaveBeenCalledWith({ data: 'from-stage-1' }, mockContext);
    expect(stage3.execute).toHaveBeenCalledWith({ data: 'from-stage-2' }, mockContext);
    expect(result).toEqual({ data: 'from-stage-3' });
  });

  it('returns final output from pipeline', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');
    const pipeline = new BuildPipeline([makeStage('only-stage', 'result')]);

    const result = await pipeline.run('input', mockContext);
    expect(result).toBe('result');
  });

  it('addStage appends a stage to the pipeline', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');

    const pipeline = new BuildPipeline();
    pipeline.addStage(makeStage('added-stage', 'added-output'));

    const result = await pipeline.run('test', mockContext);
    expect(result).toBe('added-output');
  });
});

describe('BuildPipeline error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates error from second stage when first stage succeeds', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');

    const stage1 = makeStage('ok-stage', 'from-stage-1');
    const stage2: Stage<any, any> = {
      name: 'fail-stage',
      execute: vi.fn().mockRejectedValue(new LinkerError('Stage 2 failed')),
    };
    const stage3 = makeStage('never-reached', 'unused');

    const pipeline = new BuildPipeline([stage1, stage2, stage3]);

    await expect(pipeline.run('input', mockContext)).rejects.toThrow(LinkerError);
    // Stage 3 should never execute
    expect(stage3.execute).not.toHaveBeenCalled();
  });

  it('propagates error from first stage before any others execute', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');

    const stage1: Stage<any, any> = {
      name: 'fail-first',
      execute: vi.fn().mockRejectedValue(new Error('First stage failed')),
    };
    const stage2 = makeStage('never-run', 'unused');

    const pipeline = new BuildPipeline([stage1, stage2]);

    await expect(pipeline.run('input', mockContext)).rejects.toThrow('First stage failed');
    expect(stage2.execute).not.toHaveBeenCalled();
  });

  it('does not execute subsequent stages after a failure', async () => {
    const { BuildPipeline } = await import('./build-pipeline.js');
    const executedStages: string[] = [];

    const stage1: Stage<any, any> = {
      name: 'stage-1',
      execute: vi.fn().mockImplementation(async (input: any) => {
        executedStages.push('stage-1');
        if (input === 'trigger-fail') {
          throw new Error('Intentional failure');
        }
        return 'ok';
      }),
    };

    const stage2 = {
      name: 'stage-2',
      execute: vi.fn().mockImplementation(async () => {
        executedStages.push('stage-2');
        return 'done';
      }),
    };

    const pipeline = new BuildPipeline([stage1, stage2]);

    // Verify stage1 runs and fails, stage2 never runs
    await expect(pipeline.run('trigger-fail', mockContext)).rejects.toThrow('Intentional failure');
    expect(executedStages).toEqual(['stage-1']);
    expect(stage2.execute).not.toHaveBeenCalled();
  });
});
