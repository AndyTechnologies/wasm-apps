// Console API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

pub fn log(msg: &str) {
    let _ = wasi::stdout_str(msg);
    let _ = wasi::stdout_write(b"\n");
}

pub fn warn(msg: &str) {
    let _ = wasi::stderr_write(msg.as_bytes());
    let _ = wasi::stderr_write(b"\n");
}

pub fn error(msg: &str) {
    let _ = wasi::stderr_write(msg.as_bytes());
    let _ = wasi::stderr_write(b"\n");
}
