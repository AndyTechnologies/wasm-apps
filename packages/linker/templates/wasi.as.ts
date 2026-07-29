// WASI mid-level wrapper for AssemblyScript 0.28

// ── Raw WASI imports ──────────────────────────────

@external("wasi_snapshot_preview1", "fd_write")
declare function wasiFdWrite(fd: i32, iovs: usize, iovsLen: i32, nwritten: usize): i32;

@external("wasi_snapshot_preview1", "fd_read")
declare function wasiFdRead(fd: i32, iovs: usize, iovsLen: i32, nread: usize): i32;

@external("wasi_snapshot_preview1", "fd_close")
declare function wasiFdClose(fd: i32): i32;

@external("wasi_snapshot_preview1", "fd_seek")
declare function wasiFdSeek(fd: i32, offset: i64, whence: i32, newoffset: usize): i32;

@external("wasi_snapshot_preview1", "fd_prestat_get")
declare function wasiFdPrestatGet(fd: i32, buf: usize): i32;

@external("wasi_snapshot_preview1", "fd_prestat_dir_name")
declare function wasiFdPrestatDirName(fd: i32, buf: usize, len: i32): i32;

@external("wasi_snapshot_preview1", "path_open")
declare function wasiPathOpen(fd: i32, dirflags: i32, path: usize, pathLen: i32, oflags: i32, fsRightsBase: i64, fsRightsInheriting: i64, fdflags: i32, openedFd: usize): i32;

@external("wasi_snapshot_preview1", "path_filestat_get")
declare function wasiPathFilestatGet(fd: i32, flags: i32, path: usize, pathLen: i32, buf: usize): i32;

@external("wasi_snapshot_preview1", "path_unlink_file")
declare function wasiPathUnlinkFile(fd: i32, path: usize, pathLen: i32): i32;

@external("wasi_snapshot_preview1", "path_create_directory")
declare function wasiPathCreateDirectory(fd: i32, path: usize, pathLen: i32): i32;

@external("wasi_snapshot_preview1", "environ_get")
declare function wasiEnvironGet(environ: usize, environBuf: usize): i32;

@external("wasi_snapshot_preview1", "environ_sizes_get")
declare function wasiEnvironSizesGet(count: usize, bufSize: usize): i32;

@external("wasi_snapshot_preview1", "clock_time_get")
declare function wasiClockTimeGet(id: i32, precision: i64, time: usize): i32;

@external("wasi_snapshot_preview1", "proc_exit")
declare function wasiProcExit(code: i32): void;

// ── Types ─────────────────────────────────────────

export class Prestat {
  prNameLen: i32;
}

export class Filestat {
  stDev: i64;
  stIno: i64;
  stFiletype: i32;
  stNlink: i32;
  stSize: i64;
  stAtim: i64;
  stMtim: i64;
  stCtim: i64;
}

export const FILETYPE_DIRECTORY: i32 = 3;
export const FILETYPE_REGULAR_FILE: i32 = 4;

// ── I/O vector helpers ────────────────────────────

function makeIovec(data: usize, len: i32): usize {
  let buf = heap.alloc(8);
  store<usize>(buf, data, 0);
  store<i32>(buf, len, 4);
  // Second 4 bytes (padding/alignment)
  store<i32>(buf, 0, 8);
  return buf;
}

// ── Stdout/stderr ─────────────────────────────────

export function stdoutWrite(data: usize, len: i32): i32 {
  let iov = makeIovec(data, len);
  let nwritten = heap.alloc(4);
  let ret = wasiFdWrite(1, iov, 1, nwritten);
  return ret;
}

export function stdoutWriteStr(s: string): i32 {
  let buf = String.UTF8.encode(s);
  let arr = Uint8Array.wrap(buf);
  return stdoutWrite(arr.dataStart as usize, arr.length);
}

export function stderrWrite(data: usize, len: i32): i32 {
  let iov = makeIovec(data, len);
  let nwritten = heap.alloc(4);
  let ret = wasiFdWrite(2, iov, 1, nwritten);
  return ret;
}

// ── Low-level I/O ─────────────────────────────────

export function fdWrite(fd: i32, data: usize, len: i32): i32 {
  let iov = makeIovec(data, len);
  let nwritten = heap.alloc(4);
  let ret = wasiFdWrite(fd, iov, 1, nwritten);
  return ret == 0 ? load<i32>(nwritten) : -ret;
}

export function fdRead(fd: i32, buf: usize, len: i32): i32 {
  let iov = makeIovec(buf, len);
  let nread = heap.alloc(4);
  let ret = wasiFdRead(fd, iov, 1, nread);
  return ret == 0 ? load<i32>(nread) : -ret;
}

export function fdClose(fd: i32): i32 {
  return -wasiFdClose(fd);
}

export function fdSeek(fd: i32, offset: i64, whence: i32): i64 {
  let newoffset = heap.alloc(8);
  let ret = wasiFdSeek(fd, offset, whence, newoffset);
  return ret == 0 ? load<i64>(newoffset) : -ret as i64;
}

// ── Preopen dir scanning ───────────────────────────

export function fdPrestatGet(fd: i32): Prestat | null {
  let buf = heap.alloc(4);
  let ret = wasiFdPrestatGet(fd, buf);
  if (ret != 0) return null;
  let p = new Prestat();
  p.prNameLen = load<i32>(buf);
  return p;
}

export function fdPrestatDirName(fd: i32): Array<u8> | null {
  let prestat = fdPrestatGet(fd);
  if (prestat == null) return null;
  let name = new Array<u8>(prestat!.prNameLen);
  let ret = wasiFdPrestatDirName(fd, name.dataStart as usize, prestat!.prNameLen);
  if (ret != 0) return null;
  // Trim trailing NUL
  while (name.length > 0 && name[name.length - 1] == 0) {
    name.pop();
  }
  return name;
}

// ── Path operations ────────────────────────────────

const RIGHTS_READ: i64 = 0x0000000000000001;
const RIGHTS_WRITE: i64 = 0x0000000000000002;

export function pathOpen(dirFd: i32, path: usize, pathLen: i32, forWrite: bool, create: bool): i32 {
  let oflags: i32 = 0;
  let rightsBase: i64 = RIGHTS_READ;
  if (forWrite) {
    oflags |= 0x02;
    rightsBase |= RIGHTS_WRITE;
  }
  if (create) {
    oflags |= 0x40;
    rightsBase |= RIGHTS_WRITE;
  }
  let openedFd = heap.alloc(4);
  let ret = wasiPathOpen(dirFd, 0, path, pathLen, oflags, rightsBase, rightsBase, 0, openedFd);
  return ret == 0 ? load<i32>(openedFd) : -ret;
}

export function pathFilestatGet(dirFd: i32, path: usize, pathLen: i32): Filestat | null {
  let buf = heap.alloc(56);  // 8 * 7 = 56 bytes
  let ret = wasiPathFilestatGet(dirFd, 0, path, pathLen, buf);
  if (ret != 0) return null;
  let fs = new Filestat();
  fs.stDev = load<i64>(buf, 0);
  fs.stIno = load<i64>(buf, 8);
  fs.stFiletype = load<i32>(buf, 16);
  fs.stNlink = load<i32>(buf, 20);
  fs.stSize = load<i64>(buf, 24);
  fs.stAtim = load<i64>(buf, 32);
  fs.stMtim = load<i64>(buf, 40);
  fs.stCtim = load<i64>(buf, 48);
  return fs;
}

export function pathUnlinkFile(dirFd: i32, path: usize, pathLen: i32): i32 {
  return -wasiPathUnlinkFile(dirFd, path, pathLen);
}

export function pathCreateDirectory(dirFd: i32, path: usize, pathLen: i32): i32 {
  return -wasiPathCreateDirectory(dirFd, path, pathLen);
}

// ── Convenience ────────────────────────────────────

export function statFile(dirFd: i32, path: string): i32 {
  let buf = String.UTF8.encode(path);
  let arr = Uint8Array.wrap(buf);
  let fs = pathFilestatGet(dirFd, arr.dataStart as usize, arr.length);
  return fs == null ? -1 : fs!.stFiletype;
}

export function fileSize(dirFd: i32, path: string): i64 {
  let buf = String.UTF8.encode(path);
  let arr = Uint8Array.wrap(buf);
  let fs = pathFilestatGet(dirFd, arr.dataStart as usize, arr.length);
  return fs == null ? -1 : fs!.stSize;
}

export function fileExists(dirFd: i32, path: string): bool {
  let buf = String.UTF8.encode(path);
  let arr = Uint8Array.wrap(buf);
  let fs = pathFilestatGet(dirFd, arr.dataStart as usize, arr.length);
  return fs != null;
}

// ── Environment ────────────────────────────────────

export function environGet(environ: usize, environBuf: usize): i32 {
  return -wasiEnvironGet(environ, environBuf);
}

export function environSizesGet(): StaticArray<i32> | null {
  let count = heap.alloc(4);
  let bufSize = heap.alloc(4);
  let ret = wasiEnvironSizesGet(count, bufSize);
  if (ret != 0) return null;
  let result = new StaticArray<i32>(2);
  result[0] = load<i32>(count);
  result[1] = load<i32>(bufSize);
  return result;
}

// ── Utility ────────────────────────────────────────

export function clockTime(id: i32, precision: i64): i64 {
  let time = heap.alloc(8);
  let ret = wasiClockTimeGet(id, precision, time);
  return ret == 0 ? load<i64>(time) : -1;
}

export function exit(code: i32): void {
  wasiProcExit(code);
}
