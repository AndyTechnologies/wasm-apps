// Console API local copy for AS examples

@external("wasi_snapshot_preview1", "fd_write")
declare function wasiFdWrite(fd: i32, iovs: usize, iovsLen: i32, nwritten: usize): i32;

export function log(msg: string): void {
    let buf = String.UTF8.encode(msg + "\n");
    let arr = Uint8Array.wrap(buf);
    let iovsAddr = heap.alloc(8);
    store<usize>(iovsAddr, arr.dataStart as usize, 0);
    store<i32>(iovsAddr, arr.length, 4);
    store<i32>(iovsAddr, 0, 8);
    let nwritten = heap.alloc(4);
    wasiFdWrite(1, iovsAddr, 1, nwritten);
}

export function warn(msg: string): void {
    let buf = String.UTF8.encode(msg + "\n");
    let arr = Uint8Array.wrap(buf);
    let iovsAddr = heap.alloc(8);
    store<usize>(iovsAddr, arr.dataStart as usize, 0);
    store<i32>(iovsAddr, arr.length, 4);
    store<i32>(iovsAddr, 0, 8);
    let nwritten = heap.alloc(4);
    wasiFdWrite(2, iovsAddr, 1, nwritten);
}

export function error(msg: string): void {
    let buf = String.UTF8.encode(msg + "\n");
    let arr = Uint8Array.wrap(buf);
    let iovsAddr = heap.alloc(8);
    store<usize>(iovsAddr, arr.dataStart as usize, 0);
    store<i32>(iovsAddr, arr.length, 4);
    store<i32>(iovsAddr, 0, 8);
    let nwritten = heap.alloc(4);
    wasiFdWrite(2, iovsAddr, 1, nwritten);
}

export function assert(cond: bool, msg: string): void {
    if (!cond) {
        let full = "Assertion failed: " + msg + "\n";
        let buf = String.UTF8.encode(full);
        let arr = Uint8Array.wrap(buf);
        let iovsAddr = heap.alloc(8);
        store<usize>(iovsAddr, arr.dataStart as usize, 0);
        store<i32>(iovsAddr, arr.length, 4);
        store<i32>(iovsAddr, 0, 8);
        let nwritten = heap.alloc(4);
        wasiFdWrite(2, iovsAddr, 1, nwritten);
        unreachable();
    }
}
