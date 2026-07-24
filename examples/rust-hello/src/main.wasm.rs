#![no_main]

const STDOUT: i32 = 1;

#[link(wasm_import_module = "wasi_snapshot_preview1")]
extern "C" {
    fn fd_write(fd: i32, iovs: *const Iovec, iovs_len: i32, nwritten: *mut i32) -> i32;
}

struct Iovec {
    buf: *const u8,
    buf_len: usize,
}

#[no_mangle]
pub extern "C" fn _start() {
    let message = b"Hola desde Rust WASM!\n";
    let iov = Iovec {
        buf: message.as_ptr(),
        buf_len: message.len(),
    };
    let mut nwritten: i32 = 0;
    unsafe {
        fd_write(STDOUT, &iov as *const Iovec, 1, &mut nwritten as *mut i32);
    }
}
