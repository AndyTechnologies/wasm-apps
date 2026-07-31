//! Bindings WASI/console/fs + allocator talc para Rust (no_std).
//!
//! Los consumidores importan `wasm_apps_bindings` como dependencia de path
//! (inyectada por `rust-strategy.ts`) y DEBEN invocar `wasm_setup!()` para
//! instalar el allocator global talc y el panic handler (D5).

#![no_std]

pub mod alloc;
pub mod console;
pub mod fs;
pub mod wasi;
