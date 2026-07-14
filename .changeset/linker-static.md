---
'@wasm-apps/linker': patch
---

Binarios Linux standalone: enlazar libstdc++ y libgcc estaticamente para eliminar dependencias de librerias dinamicas
Fix Windows CI: definir LIBWASM_STATIC para evitar __declspec(dllimport) al linkear wasmtime.lib
Fix Windows CI: añadir userenv.lib y ntdll.lib para resolver simbolos del Rust std embebido en wasmtime.lib
Fix Windows CI: evitar subdirectorio $(Configuration) en output con Visual Studio generator
