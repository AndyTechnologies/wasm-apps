import pc from 'picocolors';

export interface Logger {
  /** Muestra un mensaje informativo (cian). */
  info(msg: string): void;
  /** Muestra un mensaje de éxito (verde). */
  success(msg: string): void;
  /** Muestra un mensaje de advertencia (amarillo). */
  warn(msg: string): void;
  /** Muestra un mensaje de error (rojo). */
  error(msg: string): void;
  /** Muestra un encabezado de paso (azul negrita). */
  step(msg: string): void;
  /** Muestra un mensaje de detalle (atenuado/gris). */
  detail(msg: string): void;
}

export const logger: Logger = {
  info(msg) {
    console.log(pc.cyan(msg));
  },
  success(msg) {
    console.log(pc.green(msg));
  },
  warn(msg) {
    console.warn(pc.yellow(msg));
  },
  error(msg) {
    console.error(pc.red(msg));
  },
  step(msg) {
    console.log(pc.bold(pc.blue(msg)));
  },
  detail(msg) {
    console.log(pc.dim(msg));
  },
};

/** Retorna un string coloreado según un estado booleano. */
export function colorizeByStatus(success: boolean, okMsg: string, failMsg: string): string {
  return success ? pc.green(okMsg) : pc.red(failMsg);
}

/** Formatea un contador de bytes a un string legible (ej. "1.5 KB"). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
