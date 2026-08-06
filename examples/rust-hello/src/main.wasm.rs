// Rust WASM example using high-level Console API
#![no_std]
use wasm_apps_bindings::{console, wasm_setup};

wasm_setup!();

/// Logs a greeting message when the WebAssembly module starts.
///
/// # Examples
///
/// ```
/// _start();
/// ```
#[no_mangle]
pub extern "C" fn _start() {
    console::log("Hola desde Rust WASM!");
}
