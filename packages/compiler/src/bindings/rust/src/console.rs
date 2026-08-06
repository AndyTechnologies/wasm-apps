// Console API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

/// Writes a message followed by a newline to standard output.

///

/// # Examples

///

/// ```

/// log("Build complete");

/// ```

///

/// `msg` is the message to write.

///

/// # Parameters

///

/// * `msg` - The message to write.
pub fn log(msg: &str) {
    let _ = wasi::stdout_str(msg);
    let _ = wasi::stdout_write(b"\n");
}

/// Writes a warning message followed by a newline to standard error.
///
/// # Examples
///
/// ```
/// warn("This is a warning.");
/// ```
///
/// # Parameters
///
/// * `msg` - The warning message to write.
pub fn warn(msg: &str) {
    let _ = wasi::stderr_write(msg.as_bytes());
    let _ = wasi::stderr_write(b"\n");
}

/// Writes a message followed by a newline to standard error.
///
/// # Examples
///
/// ```
/// error("An error occurred");
/// ```
pub fn error(msg: &str) {
    let _ = wasi::stderr_write(msg.as_bytes());
    let _ = wasi::stderr_write(b"\n");
}
