#pragma once
// Console API — high-level wrappers over wasi:: (-nostdlib compatible)

#include "wasi.h"

/**
 * Writes a message followed by a newline to standard output.
 * @param msg Message to write.
 */

/**
 * Writes a warning followed by a newline to standard error.
 * @param msg Warning message to write.
 */

/**
 * Writes an error message followed by a newline to standard error.
 * @param msg Error message to write.
 */

/**
 * Verifies a condition and terminates execution with an assertion message if it is false.
 * @param cond Condition to verify.
 * @param msg Message to include when the assertion fails.
 */
namespace console {

inline void log(const char* msg) {
    size_t n = 0;
    while (msg[n]) ++n;
    wasi::stdout_write(msg, n);
    wasi::stdout_write("\n", 1);
}

inline void warn(const char* msg) {
    size_t n = 0;
    while (msg[n]) ++n;
    wasi::stderr_write(msg, n);
    wasi::stderr_write("\n", 1);
}

inline void error(const char* msg) {
    size_t n = 0;
    while (msg[n]) ++n;
    wasi::stderr_write(msg, n);
    wasi::stderr_write("\n", 1);
}

inline void assert(bool cond, const char* msg) {
    if (!cond) {
        size_t n = 0;
        while (msg[n]) ++n;
        wasi::stderr_write("Assertion failed: ", 18);
        wasi::stderr_write(msg, n);
        wasi::stderr_write("\n", 1);
        __builtin_trap();
    }
}

} // namespace console
