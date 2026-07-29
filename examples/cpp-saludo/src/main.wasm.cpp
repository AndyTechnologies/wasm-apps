// C++ WASM example using high-level Console API
#include "console.h"

extern "C" int _start() {
    console::log("Hola desde C++ WASM!");
    return 0;
}
