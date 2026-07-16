export default {
  id: 'validation-plugin',

  register(ctx) {
    ctx.pipeline.register('beforeModuleCompile', this.id, async (pipelineCtx) => {
      const files = pipelineCtx.sourceFiles ?? [];
      ctx.logger.info(`Validando ${files.length} archivo(s) fuente...`);

      for (const file of files) {
        const hasExport = /export\s+(function|class|const|let|var)\s/.test(file.sourceCode);
        if (!hasExport && ctx.config?.requireExports !== false) {
          ctx.logger.warn(`  ${file.fileName}: no tiene funciones exportadas`);
        } else {
          ctx.logger.detail(`  ${file.fileName}: OK`);
        }
      }

      ctx.logger.success('Validación completada');
    });

    ctx.logger.detail(`Plugin ${this.id} registrado`);
  },
};
