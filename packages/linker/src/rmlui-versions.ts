/**
 * Versiones pinadas de las dependencias RmlUI — fuente de verdad única (R-001).
 *
 * Este módulo NO importa nada más a propósito: scripts/rmlui-bindgen/index.mjs
 * lo importa directamente en runtime Node (type stripping) sin depender de la
 * build del monorepo ni de módulos con imports relativos.
 *
 * rmlui-dl.ts lo re-exporta para el resto del paquete linker.
 */
export const RMLUI_VERSION = '6.2';
export const SDL3_VERSION = '3.2.4';
