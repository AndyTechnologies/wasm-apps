import fs from 'node:fs';

export default {
  id: 'metrics-plugin',

  register(ctx) {
    const startTime = Date.now();
    let moduleCount = 0;

    ctx.pipeline.register('beforeModuleCompile', this.id, async (pipelineCtx) => {
      moduleCount = pipelineCtx.sourceFiles?.length ?? 0;
      ctx.logger.step(`Iniciando compilación de ${moduleCount} módulo(s)...`);
    });

    ctx.pipeline.register('afterModuleCompile', this.id, async (pipelineCtx) => {
      const wasmModules = pipelineCtx.wasmModules ?? [];
      for (const mod of wasmModules) {
        const sizeKB = (mod.buffer.byteLength / 1024).toFixed(1);
        ctx.logger.detail(`  ${mod.fileName}: ${sizeKB} KB WASM`);
      }
    });

    ctx.pipeline.register('afterLink', this.id, async (pipelineCtx) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      let binarySize = 'desconocido';
      if (pipelineCtx.outputPath && fs.existsSync(pipelineCtx.outputPath)) {
        const stats = fs.statSync(pipelineCtx.outputPath);
        binarySize = (stats.size / 1024).toFixed(1) + ' KB';
      }

      ctx.logger.success(`Compilación completada en ${elapsed}s`);
      ctx.logger.info(`  Módulos: ${moduleCount}`);
      ctx.logger.info(`  Binario: ${binarySize}`);

      if (ctx.config?.logLevel === 'detailed') {
        ctx.logger.detail(`  Timestamp: ${new Date().toISOString()}`);
      }
    });

    ctx.logger.detail(`Plugin ${this.id} registrado`);
  },
};
