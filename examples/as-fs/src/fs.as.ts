// FS API local copy for AS examples

@external("wasi_snapshot_preview1", "fd_write")
declare function wasiFdWrite(fd: i32, iovs: usize, iovsLen: i32, nwritten: usize): i32;
@external("wasi_snapshot_preview1", "fd_read")
declare function wasiFdRead(fd: i32, iovs: usize, iovsLen: i32, nread: usize): i32;
@external("wasi_snapshot_preview1", "fd_close")
declare function wasiFdClose(fd: i32): i32;
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

class Prestat { prNameLen: i32; }

function readIovec(fd: i32, bufAddr: usize, len: i32): i32 {
    let iovsAddr = heap.alloc(8);
    store<usize>(iovsAddr, bufAddr, 0);
    store<i32>(iovsAddr, len, 4);
    store<i32>(iovsAddr, 0, 8);
    let nread = heap.alloc(4);
    let ret = wasiFdRead(fd, iovsAddr, 1, nread);
    return ret == 0 ? load<i32>(nread) : -ret;
}

function resolvePath(path: string): StaticArray<i32> | null {
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let pathLen = pathArr.length;

    for (let fd: i32 = 3; fd <= 63; fd++) {
        let prestatBuf = heap.alloc(4);
        let ret = wasiFdPrestatGet(fd, prestatBuf);
        if (ret != 0) continue;
        let dirLen = load<i32>(prestatBuf);
        if (dirLen == 0) continue;
        let dirName = heap.alloc(dirLen);
        ret = wasiFdPrestatDirName(fd, dirName, dirLen);
        if (ret != 0) continue;
        // Trim trailing slashes
        let actualDirLen = dirLen;
        while (actualDirLen > 0 && load<u8>(dirName + actualDirLen - 1) == 47) { actualDirLen--; }

        if (pathLen > actualDirLen && pathArr[actualDirLen] == 47) {
            let match = true;
            for (let i: i32 = 0; i < actualDirLen; i++) {
                if (load<u8>(dirName + i) != pathArr[i]) { match = false; break; }
            }
            if (match) {
                let result = new StaticArray<i32>(2);
                result[0] = fd;
                result[1] = actualDirLen + 1;
                return result;
            }
        } else if (pathLen == actualDirLen) {
            let match = true;
            for (let i: i32 = 0; i < actualDirLen; i++) {
                if (load<u8>(dirName + i) != pathArr[i]) { match = false; break; }
            }
            if (match) {
                let result = new StaticArray<i32>(2);
                result[0] = fd;
                result[1] = pathLen;
                return result;
            }
        }
    }
    return null;
}

export function readFile(path: string): ArrayBuffer | null {
    let r = resolvePath(path);
    if (r == null) return null;
    let dirFd = r[0];
    let relOffset = r[1];
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let relAddr = pathArr.dataStart as usize + relOffset;
    let relLen = pathArr.length - relOffset;

    let openedFdAddr = heap.alloc(4);
    let ret = wasiPathOpen(dirFd, 0, relAddr, relLen, 1, 0x0000000000000001, 0x0000000000000001, 0, openedFdAddr);
    if (ret != 0) return null;
    let openedFd = load<i32>(openedFdAddr);

    let buf = new ArrayBuffer(65536);
    let bufAddr = changetype<usize>(buf);
    let n = readIovec(openedFd, bufAddr, 65536);
    wasiFdClose(openedFd);
    if (n < 0) return null;
    let result = new ArrayBuffer(n);
    memory.copy(changetype<usize>(result), bufAddr, n);
    return result;
}

export function writeFile(path: string, data: ArrayBuffer): bool {
    let r = resolvePath(path);
    if (r == null) return false;
    let dirFd = r[0];
    let relOffset = r[1];
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let relAddr = pathArr.dataStart as usize + relOffset;
    let relLen = pathArr.length - relOffset;

    let openedFdAddr = heap.alloc(4);
    let ret = wasiPathOpen(dirFd, 0, relAddr, relLen, 2 | 0x40 | 0x200, 0x0000000000000003, 0x0000000000000003, 0, openedFdAddr);
    if (ret != 0) return false;
    let openedFd = load<i32>(openedFdAddr);

    let dataAddr = changetype<usize>(data);
    let dataLen = data.byteLength;
    let iovsAddr = heap.alloc(8);
    store<usize>(iovsAddr, dataAddr, 0);
    store<i32>(iovsAddr, dataLen, 4);
    store<i32>(iovsAddr, 0, 8);
    let nwritten = heap.alloc(4);
    ret = wasiFdWrite(openedFd, iovsAddr, 1, nwritten);
    wasiFdClose(openedFd);
    return ret == 0;
}

export function exists(path: string): bool {
    let r = resolvePath(path);
    if (r == null) return false;
    let dirFd = r[0];
    let relOffset = r[1];
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let relAddr = pathArr.dataStart as usize + relOffset;
    let relLen = pathArr.length - relOffset;
    let stBuf = heap.alloc(56);
    let ret = wasiPathFilestatGet(dirFd, 0, relAddr, relLen, stBuf);
    return ret == 0;
}

export function unlink(path: string): bool {
    let r = resolvePath(path);
    if (r == null) return false;
    let relOffset = r[1];
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let relAddr = pathArr.dataStart as usize + relOffset;
    let relLen = pathArr.length - relOffset;
    return wasiPathUnlinkFile(r[0], relAddr, relLen) == 0;
}

export function mkdir(path: string): bool {
    let r = resolvePath(path);
    if (r == null) return false;
    let relOffset = r[1];
    let pathBytes = String.UTF8.encode(path);
    let pathArr = Uint8Array.wrap(pathBytes);
    let relAddr = pathArr.dataStart as usize + relOffset;
    let relLen = pathArr.length - relOffset;
    return wasiPathCreateDirectory(r[0], relAddr, relLen) == 0;
}
