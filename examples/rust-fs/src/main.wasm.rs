// Rust WASM example using high-level Console + FS API
#![no_std]

mod console;
mod fs;
mod wasi;
use console::*;

#[panic_handler]
fn panic(_: &core::panic::PanickInfo) -> ! {
    loop {}
}

#[no_mangle]
pub extern "C" fn _start() {
    let _ = log("Opening file...");
    let data = fs::read_file(b"/mnt/data/greeting.txt");
    if let Ok(content) = data {
        let _ = wasi::stdout_write(&content);
        let _ = wasi::stdout_write(b"\n");
    }
}
