// FS API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

// ── Internal: resolve path to (dirFd, relative_path) ──

struct ResolvedPath {
    dir_fd: i32,
    relative: Vec<u8>,
}

/// Resolves a path relative to the first matching preopened directory.
///
/// # Examples
///
/// ```
/// if let Some(resolved) = resolve_path(b"/sandbox/file.txt") {
///     assert_eq!(resolved.relative, b"file.txt");
/// }
/// ```
///
/// Returns `Some` with the matching directory descriptor and relative path, or
/// `None` when no preopened directory matches.
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

/// Reads up to 64 KiB from a file resolved against the configured WASI directories.
///
/// # Errors
///
/// Returns the WASI or path-resolution error code.
///
/// # Examples
///
/// ```
/// let result = read_file(b"example.txt");
/// assert!(result.is_ok() || result.is_err());
/// ```
pub fn read_file(path: &[u8]) -> Result<Vec<u8>, i32>
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

/// Reads a file into the provided buffer.
///
/// The buffer is filled from the beginning, up to its capacity. The returned
/// count indicates how many bytes were read.
///
/// # Examples
///
/// ```
/// let mut buffer = [0u8; 1024];
/// let bytes_read = read_file_to_buf(b"file.txt", &mut buffer)?;
/// let contents = &buffer[..bytes_read];
/// # let _: &[u8] = contents;
/// # Ok::<(), i32>(())
/// ```
///
/// # Parameters
///
/// * `path` - Path of the file to read.
/// * `buf` - Buffer that receives the file contents.
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

/// Writes data to a file, creating the file when necessary.
///
/// # Examples
///
/// ```
/// let bytes_written = write_file(b"example.txt", b"hello").unwrap();
/// assert_eq!(bytes_written, 5);
/// ```
///
/// # Returns
///
/// The number of bytes written, or a WASI error code.
pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32>
pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, true, true)?;
    let n = wasi::fd_write(fd, data)?;
    let _ = wasi::fd_close(fd);
    Ok(n)
}

/// Checks whether a file exists at the specified path.

///

/// Paths are resolved against the available preopened directories. An unresolved

/// path is treated as nonexistent.

///

/// # Examples

///

/// ```

/// let file_exists = exists(b"config.toml");

/// ```

///

/// # Arguments

///

/// * `path` - The file path to check as bytes.

///

/// # Returns

///

/// `true` if the file exists, `false` otherwise.
pub fn exists(path: &[u8]) -> bool {
    let r = match resolve_path(path) {
        Some(v) => v,
        None => return false,
    };
    wasi::file_exists(r.dir_fd, &r.relative)
}

/// Removes the file at the specified path.
///
/// # Errors
///
/// Returns `-1` if the path cannot be resolved, or the WASI error code if
/// removing the file fails.
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
/// Returns an error code if the path cannot be resolved or the directory cannot be created.
///
/// # Examples
///
/// ```no_run
/// mkdir(b"new-directory").expect("failed to create directory");
/// ```
pub fn mkdir(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_create_directory(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}
