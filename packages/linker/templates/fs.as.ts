// FS API — high-level wrappers over wasi:: for AssemblyScript

import {
  pathOpen, pathFilestatGet, pathUnlinkFile, pathCreateDirectory,
  fdPrestatGet, fdPrestatDirName, fdRead, fdClose, fdWrite
} from "./wasi";

// ── ResolvedPath helper (AS has no tuple return) ───

class ResolvedPath {
  dirFd: i32;
  relative: Array<u8>;

  constructor(dirFd: i32, relative: Array<u8>) {
    this.dirFd = dirFd;
    this.relative = relative;
  }
}

/**
 * Resolves a path against an available preopened directory.
 *
 * @param path - The path to resolve.
 * @returns The matching directory descriptor and relative path, or `null` if no preopened directory matches.
 */
function resolvePath(path: string): ResolvedPath | null {
  let pathBytes = String.UTF8.encode(path);
  let pathArr = Uint8Array.wrap(pathBytes);
  let pathLen = pathArr.length;

  for (let fd: i32 = 3; fd <= 63; fd++) {
    // Get prestat
    let prestat = fdPrestatGet(fd);
    if (prestat == null) continue;

    // Get dir name
    let dirName = fdPrestatDirName(fd);
    if (dirName == null) continue;

    let dirLen = dirName!.length;
    // Trim trailing slashes
    while (dirLen > 0 && dirName![dirLen - 1] == 47) {  // '/'
      dirLen--;
    }

    // Check prefix match
    if (pathLen > dirLen && pathArr[dirLen] == 47) {  // '/'
      let match = true;
      for (let i: i32 = 0; i < dirLen; i++) {
        if (dirName![i] != pathArr[i]) { match = false; break; }
      }
      if (match) {
        let rel = new Array<u8>(pathLen - dirLen - 1);
        for (let i: i32 = 0; i < rel.length; i++) {
          rel[i] = pathArr[dirLen + 1 + i];
        }
        return new ResolvedPath(fd, rel);
      }
    } else if (pathLen == dirLen) {
      let match = true;
      for (let i: i32 = 0; i < dirLen; i++) {
        if (dirName![i] != pathArr[i]) { match = false; break; }
      }
      if (match) {
        return new ResolvedPath(fd, new Array<u8>(0));
      }
    }
  }

  return null;
}

/**
 * Reads the contents of a file.
 *
 * @param path - The path of the file to read
 * @returns The file contents, or `null` if the path cannot be resolved or the file cannot be opened or read
 */

export function readFile(path: string): ArrayBuffer | null {
  let rp = resolvePath(path);
  if (rp == null) return null;

  let relAddr = rp!.relative.dataStart as usize;
  let relLen = rp!.relative.length as i32;

  let openedFd = pathOpen(rp!.dirFd, relAddr, relLen, false, false);
  if (openedFd < 0) return null;

  // Read up to 64KB
  let buf = new ArrayBuffer(65536);
  let bufAddr = changetype<usize>(buf);
  let n = fdRead(openedFd, bufAddr, 65536);
  fdClose(openedFd);

  if (n < 0) return null;
  // Truncate to actual bytes read
  let result = new ArrayBuffer(n);
  memory.copy(changetype<usize>(result), bufAddr, n);
  return result;
}

/**
 * Writes data to a file at the specified path.
 *
 * @param path - The path of the file to write
 * @param data - The contents to write to the file
 * @returns `true` if the file is opened and written successfully, `false` otherwise
 */
export function writeFile(path: string, data: ArrayBuffer): bool {
  let rp = resolvePath(path);
  if (rp == null) return false;

  let relAddr = rp!.relative.dataStart as usize;
  let relLen = rp!.relative.length as i32;

  let openedFd = pathOpen(rp!.dirFd, relAddr, relLen, true, true);
  if (openedFd < 0) return false;

  let dataAddr = changetype<usize>(data);
  let dataLen = data.byteLength;
  let ret = fdWrite(openedFd, dataAddr, dataLen);
  fdClose(openedFd);
  return ret >= 0;
}

/**
 * Checks whether a filesystem entry exists at the specified path.
 *
 * @param path - The path to check
 * @returns `true` if metadata is available for the path, `false` otherwise
 */
export function exists(path: string): bool {
  let rp = resolvePath(path);
  if (rp == null) return false;

  let relAddr = rp!.relative.dataStart as usize;
  let relLen = rp!.relative.length as i32;

  let fs = pathFilestatGet(rp!.dirFd, relAddr, relLen);
  return fs != null;
}

/**
 * Removes a file at the specified path.
 *
 * @param path - The path of the file to remove
 * @returns `true` if the file was removed successfully, `false` otherwise
 */
export function unlink(path: string): bool {
  let rp = resolvePath(path);
  if (rp == null) return false;

  let relAddr = rp!.relative.dataStart as usize;
  let relLen = rp!.relative.length as i32;

  return pathUnlinkFile(rp!.dirFd, relAddr, relLen) == 0;
}

/**
 * Creates a directory at the specified path.
 *
 * @param path - The path of the directory to create
 * @returns `true` if the directory is created successfully, `false` otherwise
 */
export function mkdir(path: string): bool {
  let rp = resolvePath(path);
  if (rp == null) return false;

  let relAddr = rp!.relative.dataStart as usize;
  let relLen = rp!.relative.length as i32;

  return pathCreateDirectory(rp!.dirFd, relAddr, relLen) == 0;
}
