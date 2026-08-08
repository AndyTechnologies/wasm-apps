// C++ WASM example demonstrating mounts + high-level FS API
#include "console.h"
#include "fs.h"

extern "C" /**
 * @brief Reads the mounted greeting file and writes its contents to standard output.
 *
 * @return int 0 after processing the greeting file.
 */
int _start() {
    console::log("Opening file...");

    char buf[512];
    int n = fs::readFile("/mnt/data/greeting.txt", buf, 512);
    if (n > 0) {
        wasi::stdout_write(buf, n);
        wasi::stdout_write("\n", 1);
    } else {
        console::log("(no mounted dir — try with preopen_dir)");
    }
    return 0;
}
