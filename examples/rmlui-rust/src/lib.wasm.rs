//! RmlUI Rust Example
//!
//! Demonstrates calling env.Rml_* host functions from Rust WASM.
//! The raw FFI declarations mirror the C ABI in rmlui-abi.h.
//! In a real project, use the generated rmlui_bindings.rs crate instead.

#![no_main]
#![no_std]

// Instala el allocator talc y el panic handler (requerido por no_std WASM).
use wasm_apps_bindings::wasm_setup;
wasm_setup!();

use core::ffi::c_char;

// ── Raw extern "C" declarations ─────────────────────────────────────────
// These are resolved by wasmtime at runtime via the RmlUI plugin's
// host function registrations.

#[link(wasm_import_module = "env")]
extern "C" {
    fn Rml_CreateContext(name: *const c_char, w: i32, h: i32) -> i32;
    fn Rml_ReleaseContext(ctx: i32);
    fn Rml_LoadDocument(ctx: i32, path: *const c_char) -> i32;
    fn Rml_ShowDocument(doc: i32);
    fn Rml_CreateElement(tag: *const c_char) -> i32;
    fn Rml_AppendChild(parent: i32, child: i32) -> i32;
    fn Rml_SetAttribute(el: i32, name: *const c_char, value: *const c_char) -> i32;
    fn Rml_SetTextContent(el: i32, text: *const c_char) -> i32;
    fn Rml_GetBody(ctx: i32) -> i32;
}

// ── Entry point ─────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn _start() {
    // 1. Create the RmlUI context
    let ctx = unsafe { Rml_CreateContext(b"main\0".as_ptr() as *const c_char, 1024, 768) };
    if ctx < 0 {
        return; // Context creation failed
    }

    // 2. Load the RML document
    let doc = unsafe { Rml_LoadDocument(ctx, b"ui/main.rml\0".as_ptr() as *const c_char) };
    if doc > 0 {
        unsafe { Rml_ShowDocument(doc) };

        // 3. Dynamically add a greeting paragraph to the body
        let body = unsafe { Rml_GetBody(ctx) };
        if body > 0 {
            let el = unsafe { Rml_CreateElement(b"p\0".as_ptr() as *const c_char) };
            if el > 0 {
                unsafe {
                    Rml_SetTextContent(
                        el,
                        b"Hello from Rust WASM!\0".as_ptr() as *const c_char,
                    );
                    Rml_SetAttribute(
                        el,
                        b"class\0".as_ptr() as *const c_char,
                        b"wasm-greeting\0".as_ptr() as *const c_char,
                    );
                    Rml_AppendChild(body, el);
                }
            }
        }
    }

    // The host loop keeps running after _start returns.
    // Document stays visible until the window is closed.
}
