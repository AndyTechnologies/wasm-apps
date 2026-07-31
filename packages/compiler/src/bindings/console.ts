// Console API — high-level wrappers over wasi:: for AssemblyScript

import { stdoutWrite, stderrWrite } from "./wasi";

export function log(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stdoutWrite(arr.dataStart as usize, arr.length);
}

export function warn(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stderrWrite(arr.dataStart as usize, arr.length);
}

export function error(msg: string): void {
  let buf = String.UTF8.encode(msg + "\n");
  let arr = Uint8Array.wrap(buf);
  stderrWrite(arr.dataStart as usize, arr.length);
}

export function assert(cond: bool, msg: string): void {
  if (!cond) {
    let full = "Assertion failed: " + msg + "\n";
    let buf = String.UTF8.encode(full);
    let arr = Uint8Array.wrap(buf);
    stderrWrite(arr.dataStart as usize, arr.length);
    unreachable();
  }
}
