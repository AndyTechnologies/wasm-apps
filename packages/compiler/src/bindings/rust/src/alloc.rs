//! Allocator talc v5 + macro `wasm_setup!()` (D1/D2).
//!
//! D2: solo `#[macro_export]` — `pub use alloc::wasm_setup;` es imposible en
//! stable Rust (E0432/E0255). La macro referencia `$crate::alloc::_talc_reexport`
//! porque el módulo vive dentro de `alloc` (path raíz falla con E0433).

#[doc(hidden)]
pub mod _talc_reexport {
    pub use talc::wasm::{new_wasm_dynamic_allocator, WasmDynamicTalc};
}

/// Instala el allocator global talc y un panic handler (solo wasm sin atomics).
#[macro_export]
macro_rules! wasm_setup {
    () => {
        #[cfg(all(not(target_feature = "atomics"), target_family = "wasm"))]
        mod _wasm_apps_alloc {
            #[global_allocator]
            static TALC: $crate::alloc::_talc_reexport::WasmDynamicTalc =
                unsafe { $crate::alloc::_talc_reexport::new_wasm_dynamic_allocator() };
            #[panic_handler]
            fn wasm_apps_panic(_info: &core::panic::PanicInfo) -> ! {
                core::arch::wasm32::unreachable()
            }
        }
    };
}
