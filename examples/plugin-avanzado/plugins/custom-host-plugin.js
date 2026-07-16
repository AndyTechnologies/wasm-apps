import fs from 'node:fs';

export default {
  id: 'custom-host-plugin',

  register(ctx) {
    // 1. Registrar función host personalizada
    //    Toma un i32, lo multiplica por 2 y lo devuelve
    ctx.hostFunctions.register('env', 'multiply_by_two', (_params, _results) => {
      return `
        int32_t val = args[0].i32();
        results[0] = Val(val * 2);
        return std::monostate{};
      `;
    });

    // 2. Hook: logear archivos fuente
    ctx.pipeline.register('beforeModuleCompile', this.id, async (pipelineCtx) => {
      const files = pipelineCtx.sourceFiles ?? [];
      ctx.logger.info(`Preparando compilación de ${files.length} módulo(s):`);
      for (const f of files) {
        ctx.logger.detail(`  - ${f.fileName}`);
      }
    });

    // 3. Hook: mostrar tamaño del binario
    ctx.pipeline.register('afterLink', this.id, async (pipelineCtx) => {
      if (pipelineCtx.outputPath && fs.existsSync(pipelineCtx.outputPath)) {
        const stats = fs.statSync(pipelineCtx.outputPath);
        ctx.logger.success(`Binario generado: ${(stats.size / 1024).toFixed(1)} KB`);
      }
    });

    ctx.logger.detail(`Plugin ${this.id} registrado`);
  },
};
