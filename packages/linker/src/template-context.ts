/**
 * Versión del contrato de NunjucksTemplateContext.
 * Incrementar cuando haya cambios breaking en la estructura del contexto.
 */
export const TEMPLATE_CONTEXT_VERSION = 1;

/**
 * Información de un export WASM con valores pre-computados para C++.
 */
export interface TemplateExportEntry {
  /** Nombre original del export. */
  name: string;
  /** Kind del export (function, memory, table, global). */
  kind: string;
  /** Nombre escapado para string literal C++ (e.g. "some-func" → "some-func"). */
  escapedName: string;
  /** Nombre sanitizado como identificador C++ (e.g. "some-func" → "some_func"). */
  safeName: string;
}

/**
 * Entrada de un módulo WASM en el contexto de template.
 * Describe los buffers de bytes y metadatos para generar el array
 * `wasm_bytes_N` y su longitud `wasm_len_N` en C++.
 */
export interface TemplateModuleEntry {
  /** Índice del módulo en orden de dependencias. */
  index: number;
  /** Nombre de la variable C++ que contiene los bytes del WASM (e.g. wasm_bytes_0). */
  varName: string;
  /** Nombre de la variable C++ que contiene la longitud (e.g. wasm_len_0). */
  lenVar: string;
  /** Nombre de la variable del módulo compilado (e.g. mod0). */
  moduleVar: string;
  /** Nombre de la variable de la instancia (e.g. instance0). */
  instanceVar: string;
  /** Representación hexadecimal de los bytes del WASM para incluir en el array C++. */
  bufferHex: string;
  /** Longitud del buffer WASM en bytes. */
  bufferLength: number;
  /** Lista de exports del módulo (para definir linking). */
  exports?: TemplateExportEntry[];
}

/**
 * Entrada de una función host en el contexto de template.
 * Describe cómo generar el código C++ para registrar una función
 * con `linker.define()`.
 */
export interface TemplateHostFunctionEntry {
  /** Módulo WASM donde se importa la función (e.g. "wasi_snapshot_preview1", "env"). */
  module: string;
  /** Nombre de la función importada. */
  name: string;
  /** Nombre del módulo escapado para string literal C++. */
  escapedModule: string;
  /** Nombre de la función escapado para string literal C++. */
  escapedName: string;
  /** Tipos de los parámetros (e.g. ["i32", "i32"]). */
  params: string[];
  /** Tipos de los resultados (e.g. ["i32"]). */
  results: string[];
  /** Cuerpo C++ de la función. */
  body: string;
  /** Expresión C++ para el tipo de función (FuncType::from_iters(...)). */
  funcTypeCpp: string;
}

/**
 * Entrada de un global en el contexto de template.
 * Describe cómo generar el código C++ para definir un global
 * con `linker.define(..., Global::wrap(...))`.
 */
export interface TemplateGlobalEntry {
  /** Módulo WASM donde se importa el global. */
  module: string;
  /** Nombre del global importado. */
  name: string;
  /** Nombre del módulo escapado para string literal C++. */
  escapedModule: string;
  /** Nombre del global escapado para string literal C++. */
  escapedName: string;
  /** Valor C++ para el global (e.g. "Val(double(3.1415))"). */
  cppValue: string;
}

/**
 * Contexto completo para renderizar templates Nunjucks de generación de C++.
 * Sustituye el paso de múltiples argumentos independientes en codegen.ts
 * por un único objeto estructurado.
 */
export interface NunjucksTemplateContext {
  /** Nombre del módulo/proyecto (para logging y naming). */
  moduleName: string;
  /** Variable de instancia del módulo que contiene el entry point (e.g. "instance0"). */
  entryPoint: string;
  /** Nombre de la función de entrada (e.g. "_start"). */
  entryFunctionName: string;
  /** entryFunctionName escapado para string literal C++. */
  escapedEntryFunctionName: string;
  /** Si se debe configurar WASI en el runtime. */
  wasi: boolean;
  /** Versión de Wasmtime C-API usada (para compatibilidad). */
  wasmtimeVersion: string;
  /** Lista de módulos WASM en orden de dependencias. */
  modules: TemplateModuleEntry[];
  /** Lista de funciones host a registrar. */
  hostFunctions: TemplateHostFunctionEntry[];
  /** Lista de globales a definir. */
  globals: TemplateGlobalEntry[];
}
