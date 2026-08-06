// Console API — high-level wrappers over wasi:: for AssemblyScript

import { stdoutWrite, stderrWrite } from "./wasi";

/**
 * Writes a message followed by a newline to standard output.
 *
 * @param msg - The message to write
 */
export function log(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stdoutWrite(arr.dataStart as usize, arr.length);
}

/**
 * Writes a warning message to standard error.
 *
 * @param msg - The warning message to write
 */
export function warn(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stderrWrite(arr.dataStart as usize, arr.length);
}

/**
 * Writes an error message to standard error.
 *
 * @param msg - The error message to write
 */
export function error(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stderrWrite(arr.dataStart as usize, arr.length);
}

/**
 * Verifies a condition and terminates execution when it is false.
 *
 * @param cond - The condition to verify
 * @param msg - The message written to standard error when the condition is false
 */
export function assert(cond: bool, msg: string): void {
  if (!cond) {
    let full = "Assertion failed: " + msg + "\n";
    let buf = String.UTF8.encode(full);
    let arr = Uint8Array.wrap(buf);
    stderrWrite(arr.dataStart as usize, arr.length);
    unreachable();
  }
}
