// Rust WASM example using high-level Console + FS API
#![no_std]
extern crate alloc;
use wasm_apps_bindings::{console, fs, wasi, wasm_setup};

wasm_setup!();

/// Reads the greeting file from the mounted data directory and writes its contents to standard output.
///
/// Logs a fallback message when the mounted directory or file is unavailable.
///
/// # Examples
///
/// ```
/// _start();
/// ```
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
