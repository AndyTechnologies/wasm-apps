// FS API local copy for examples
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use alloc::vec::Vec;
use alloc::vec;
use crate::wasi;

struct ResolvedPath {
    dir_fd: i32,
    relative: Vec<u8>,
}

fn resolve_path(path: &[u8]) -> Option<ResolvedPath> {
    for fd in 3..=63i32 {
        let prestat = match wasi::fd_prestat_get(fd) {
            Ok(p) => p,
            Err(_) => continue,
        };
        let mut dirname = vec![0u8; prestat.pr_name_len];
        let ret = unsafe {
            wasi::__wasi_fd_prestat_dir_name(fd, dirname.as_mut_ptr(), dirname.len())
        };
        if ret != 0 { continue; }
        while let Some(&b) = dirname.last() {
            if b == b'/' { dirname.pop(); } else { break; }
        }
        if path.len() > dirname.len() && path[dirname.len()] == b'/' {
            let matched = dirname.iter().enumerate().all(|(i, &d)| d == path[i]);
            if matched {
                let rel = path[dirname.len() + 1..].to_vec();
                return Some(ResolvedPath { dir_fd: fd, relative: rel });
            }
        } else if path.len() == dirname.len() {
            let matched = dirname.iter().enumerate().all(|(i, &d)| d == path[i]);
            if matched {
                return Some(ResolvedPath { dir_fd: fd, relative: vec![] });
            }
        }
    }
    None
}

pub fn read_file(path: &[u8]) -> Result<Vec<u8>, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, false, false)?;
    let mut buf = vec![0u8; 65536];
    let n = wasi::fd_read(fd, &mut buf)?;
    let _ = wasi::fd_close(fd);
    buf.truncate(n);
    Ok(buf)
}

pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, true, true)?;
    let n = wasi::fd_write(fd, data)?;
    let _ = wasi::fd_close(fd);
    Ok(n)
}

pub fn exists(path: &[u8]) -> bool {
    let r = match resolve_path(path) { Some(v) => v, None => return false };
    wasi::file_exists(r.dir_fd, &r.relative)
}

pub fn unlink(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_unlink_file(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}

pub fn mkdir(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_create_directory(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}
