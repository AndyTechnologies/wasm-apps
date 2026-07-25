import { execFile as cpExecFile } from 'node:child_process';

/**
 * Wrapper para execFile que retorna una Promise con { stdout, stderr }.
 *
 * `await execFile(...)` de `node:child_process` retorna un ChildProcess
 * inmediatamente sin esperar a que el proceso termine. Este wrapper usa
 * el callback API internamente para esperar la terminación real.
 *
 * En tests, execFile suele ser un mock de vitest que retorna una Promise
 * directamente. runExecFile detecta ese caso y lo maneja también.
 */
export function runExecFile(cmd: string, args: string[], options?: Record<string, unknown>): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const result = cpExecFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
    // En tests, execFile suele ser un mock que retorna una Promise.
    // Detectamos ese caso y resolvemos desde allí también.
    if (result instanceof Promise) {
      result.then(
        (val: any) => resolve({ stdout: String(val?.stdout ?? ''), stderr: String(val?.stderr ?? '') }),
        (err: any) => reject(err),
      );
    }
  });
}
