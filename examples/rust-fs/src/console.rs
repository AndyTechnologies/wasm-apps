// Console API local copy for examples
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

pub fn log(msg: &str) -> Result<usize, i32> {
    let n1 = wasi::stdout_str(msg).map_err(|e| e.0)?;
    let n2 = wasi::stdout_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn warn(msg: &str) -> Result<usize, i32> {
    let n1 = wasi::stderr_write(msg.as_bytes()).map_err(|e| e.0)?;
    let n2 = wasi::stderr_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn error(msg: &str) -> Result<usize, i32> {
    let n1 = wasi::stderr_write(msg.as_bytes()).map_err(|e| e.0)?;
    let n2 = wasi::stderr_write(b"\n").map_err(|e| e.0)?;
    Ok(n1 + n2)
}

pub fn assert(cond: bool, msg: &str) -> Result<(), i32> {
    if !cond {
        let _ = wasi::stderr_write(b"Assertion failed: ");
        let _ = wasi::stderr_write(msg.as_bytes());
        let _ = wasi::stderr_write(b"\n");
        return Err(1);
    }
    Ok(())
}
