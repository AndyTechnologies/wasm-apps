// Rust WASM example using high-level Console + FS API
#![no_std]
extern crate alloc;
mod wasi;
mod console;
mod fs;

#[no_mangle]
pub extern "C" fn _start() {
    console::log("Opening file...");
    let data = fs::read_file(b"/mnt/data/greeting.txt");
    if let Ok(content) = &data {
        let _ = wasi::stdout_write(content);
        let _ = wasi::stdout_write(b"\n");
    } else {
        console::log("(no mounted dir)");
    }
}
