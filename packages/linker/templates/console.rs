// Console API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

pub type WasiError = i32;
pub const ERR_ASSERT: WasiError = 1;

pub fn log(msg: &str) -> Result<usize, WasiError> {
    let n1 = wasi::stdout_str(msg).map_err(|e| e.0)?;
    let n2 = wasi::stdout_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn warn(msg: &str) -> Result<usize, WasiError> {
    let n1 = wasi::stderr_write(msg.as_bytes()).map_err(|e| e.0)?;
    let n2 = wasi::stderr_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn error(msg: &str) -> Result<usize, WasiError> {
    let n1 = wasi::stderr_write(msg.as_bytes()).map_err(|e| e.0)?;
    let n2 = wasi::stderr_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn assert(cond: bool, msg: &str) -> Result<(), WasiError> {
    if !cond {
        let _ = wasi::stderr_write(b"Assertion failed: ");
        let _ = wasi::stderr_write(msg.as_bytes());
        let _ = wasi::stderr_write(b"\n");
        return Err(ERR_ASSERT);
    }
    Ok(())
}
