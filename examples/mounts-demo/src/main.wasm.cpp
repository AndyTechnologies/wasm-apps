// C++ WASM example demonstrating mounts + high-level FS API
#include "console.h"
#include "fs.h"

extern "C" int _start() {
    console::log("Opening file...");

    char buf[512];
    int n = fs::readFile("/mnt/data/greeting.txt", buf, 512);
    if (n > 0) {
        // Write raw content (no extra \n from console::log)
        wasi::stdout_write(buf, n);
    }

    wasi::stdout_write("\n", 1);
    console::assert(n > 0, "file must exist");
    return 0;
}
