// AS WASM example using high-level Console + FS API
import { log } from "./console";
import { readFile } from "./fs";

@external("wasi_snapshot_preview1", "fd_write")
declare function wasiFdWrite(fd: i32, iovs: usize, iovsLen: i32, nwritten: usize): i32;

export function _start(): void {
    log("Opening file...");
    let data = readFile("/mnt/data/greeting.txt");
    if (data != null) {
        let dataAddr = changetype<usize>(data!);
        let dataLen = data!.byteLength;
        let iovsAddr = heap.alloc(8);
        store<usize>(iovsAddr, dataAddr, 0);
        store<i32>(iovsAddr, dataLen, 4);
        store<i32>(iovsAddr, 0, 8);
        let nwritten = heap.alloc(4);
        wasiFdWrite(1, iovsAddr, 1, nwritten);
        // Add newline
        let nlAddr = heap.alloc(1);
        store<u8>(nlAddr, 10, 0);
        store<usize>(iovsAddr, nlAddr, 0);
        store<i32>(iovsAddr, 1, 4);
        store<i32>(iovsAddr, 0, 8);
        wasiFdWrite(1, iovsAddr, 1, nwritten);
    } else {
        log("(no mounted dir)");
    }
}
