// FS API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;

// ── Internal: resolve path to (dirFd, relative_path) ──

struct ResolvedPath {
    dir_fd: i32,
    relative: Vec<u8>,
}

/// Resolves a path against the available preopened directories.
///
/// # Arguments
///
/// * `path` - The path to resolve, represented as bytes.
///
/// # Returns
///
/// The matching preopened directory descriptor and path relative to it, or `None` if no directory matches.
///
/// # Examples
///
/// ```
/// let result = resolve_path(b"/path/without/a/preopen");
/// assert!(result.is_none());
/// ```
fn resolve_path(path: &[u8]) -> Option<ResolvedPath> {
    for fd in 3..=63i32 {
        // Try to read prestat
        let prestat = match wasi::fd_prestat_get(fd) {
            Ok(p) => p,
            Err(_) => continue,
        };

        // Read dir name
        let mut dirname = vec![0u8; prestat.pr_name_len];
        let ret = unsafe {
            wasi::__wasi_fd_prestat_dir_name(fd, dirname.as_mut_ptr(), dirname.len())
        };
        if ret != 0 { continue; }

        // Trim trailing slashes
        while let Some(&b) = dirname.last() {
            if b == b'/' { dirname.pop(); } else { break; }
        }

        // Check prefix match
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

// ── Public API ────────────────────────────────────

/// Reads up to 65,536 bytes from a file.
///
/// The path is resolved relative to an available preopened directory.
///
/// # Errors
///
/// Returns `-1` when the path cannot be resolved, or a WASI error code when
/// the file cannot be opened or read.
///
/// # Examples
///
/// ```
/// let contents = read_file(b"config.txt")?;
/// println!("Read {} bytes", contents.len());
/// # Ok::<(), i32>(())
/// ```
pub fn read_file(path: &[u8]) -> Result<Vec<u8>, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, false, false)?;

    // Read in chunks up to 64KB
    let mut buf = vec![0u8; 65536];
    let n = wasi::fd_read(fd, &mut buf)?;
    let _ = wasi::fd_close(fd);
    buf.truncate(n);
    Ok(buf)
}

/// Reads a file into a caller-provided buffer.
///
/// # Examples
///
/// ```
/// let mut buf = [0u8; 1024];
/// let bytes_read = read_file_to_buf(b"file.txt", &mut buf)?;
/// let contents = &buf[..bytes_read];
/// # let _ = contents;
/// # Ok::<(), i32>(())
/// ```
///
/// # Parameters
///
/// * `path` - The file path to read.
/// * `buf` - The buffer that receives the file contents.
///
/// # Returns
///
/// The number of bytes read, or a WASI error code.
pub fn read_file_to_buf(path: &[u8], buf: &mut [u8]) -> Result<usize, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, false, false)?;
    let n = wasi::fd_read(fd, buf)?;
    let _ = wasi::fd_close(fd);
    Ok(n)
}

/// Writes data to a file, creating it when necessary.
///
/// # Examples
///
/// ```no_run
/// let written = write_file(b"output.txt", b"file contents")?;
/// assert_eq!(written, 13);
/// # Ok::<(), i32>(())
/// ```
///
/// # Errors
///
/// Returns the underlying filesystem error code if the path cannot be resolved
/// or the file cannot be opened or written.
pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32> {
pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, true, true)?;
    let n = wasi::fd_write(fd, data)?;
    let _ = wasi::fd_close(fd);
    Ok(n)
}

/// Checks whether a file exists at the specified path.
///
/// The path is resolved relative to the preopened directories available to the WASI module.
/// Returns `false` when the path cannot be resolved or the file does not exist.
///
/// # Examples
///
/// ```
/// assert!(!exists(b"this-file-does-not-exist"));
/// ```
///
/// # Returns
///
/// `true` if the file exists, `false` otherwise.
///
/// # Parameters
///
/// * `path` - Path to the file, relative to a preopened directory.
pub fn exists(path: &[u8]) -> bool {
    let r = match resolve_path(path) {
        Some(v) => v,
        None => return false,
    };
    wasi::file_exists(r.dir_fd, &r.relative)
}

/// Removes a file at the specified path.
///
/// # Parameters
///
/// * `path` - The file path as a byte slice.
///
/// # Returns
///
/// `Ok(())` if the file is removed successfully, or an `i32` error code if
/// path resolution or removal fails.
///
/// # Examples
///
/// ```no_run
/// unlink(b"temporary.txt").expect("failed to remove file");
/// ```
pub fn unlink(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_unlink_file(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}

/// Creates a directory at the specified path.
///
/// # Examples
///
/// ```
/// mkdir(b"example-directory").unwrap();
/// ```
///
/// # Arguments
///
/// * `path` - The directory path represented as bytes.
///
/// # Returns
///
/// `Ok(())` when the directory is created, or an error code if creation fails.
pub fn mkdir(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_create_directory(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}
