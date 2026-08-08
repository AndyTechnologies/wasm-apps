// C++ WASM example using high-level Console API
#include "console.h"

extern "C" /**
 * @brief Logs a greeting when the WebAssembly module starts.
 *
 * @return 0 to indicate successful completion.
 */
int _start() {
    console::log("Hola desde C++ WASM!");
    return 0;
}
