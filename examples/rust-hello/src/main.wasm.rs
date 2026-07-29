// Rust WASM example using high-level Console API
#![no_std]
mod wasi;
mod console;

#[no_mangle]
pub extern "C" fn _start() {
    console::log("Hola desde Rust WASM!");
}
