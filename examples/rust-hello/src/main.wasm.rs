// Rust WASM example using high-level Console API
#![no_std]

mod wasi;

mod console;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub extern "C" fn _start() {
    let _ = console::log("Hola desde Rust WASM!");
}
