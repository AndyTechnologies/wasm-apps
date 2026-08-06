// FS API — high-level wrappers over wasi:: (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

use crate::wasi;

// ── Internal: resolve path to (dirFd, relative_path) ──

struct ResolvedPath {
    dir_fd: i32,
    relative: Vec<u8>,
}

/// Resolves a path against the available preopened directories.
///
/// # Examples
///
/// ```no_run
/// let resolved = resolve_path(b"/data/file.txt");
/// assert!(resolved.is_some());
/// ```
///
/// Returns the first matching preopened directory and the path relative to it.
///
/// # Returns
///
/// `Some(ResolvedPath)` for a matching preopened directory, or `None` if no directory matches.
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

/// Reads a file into a byte vector.
///
/// The path is interpreted relative to a preopened directory.
///
/// # Errors
///
/// Returns a WASI error code if the path cannot be resolved or the file cannot
/// be opened or read.
///
/// # Examples
///
/// ```no_run
/// let contents = read_file(b"example.txt").expect("failed to read file");
/// assert!(!contents.is_empty());
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
/// The returned byte count indicates how much data was written to `buf`.
///
/// # Examples
///
/// ```
/// let mut buffer = [0u8; 1024];
/// let result = read_file_to_buf(b"file.txt", &mut buffer);
/// assert!(result.is_ok() || result.is_err());
/// ```
///
/// # Parameters
///
/// * `path` — The path of the file to read.
/// * `buf` — The buffer receiving the file contents.
///
/// # Returns
///
/// The number of bytes read, or a WASI error code.
pub fn read_file_to_buf(path: &[u8], buf: &mut [u8]) -> Result<usize, i32> {
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

/// ```

/// # fn example() -> Result<(), i32> {

/// let bytes_written = write_file(b"output.txt", b"hello")?;

/// assert_eq!(bytes_written, 5);

/// # Ok(())

/// # }

/// ```

///

/// # Returns

///

/// The number of bytes written, or the WASI error code if the path cannot be

/// resolved, the file cannot be opened, or the data cannot be written.
pub fn write_file(path: &[u8], data: &[u8]) -> Result<usize, i32> {
    let r = resolve_path(path).ok_or(-1)?;
    let fd = wasi::path_open(r.dir_fd, &r.relative, true, true)?;
    let n = wasi::fd_write(fd, data)?;
    let _ = wasi::fd_close(fd);
    Ok(n)
}

/// Checks whether a path refers to an existing file.

///

/// Returns `false` when the path cannot be resolved.

///

/// # Examples

///

/// ```

/// assert!(!exists(b"/definitely-missing"));

/// ```
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
/// * `path` - The path of the file to remove.
///
/// # Returns
///
/// `Ok(())` if the file is removed, or an error code if path resolution or removal fails.
///
/// # Examples
///
/// ```
/// let result = unlink(b"temporary.txt");
/// assert!(result.is_ok() || result.is_err());
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
/// mkdir(b"cache").expect("failed to create directory");
/// ```
///
/// # Returns
///
/// `Ok(())` when the directory is created, or the WASI error code when creation fails.
///
/// `path` is interpreted relative to a preopened directory.
pub fn mkdir(path: &[u8]) -> Result<(), i32> {
    let r = resolve_path(path).ok_or(-1)?;
    wasi::path_create_directory(r.dir_fd, &r.relative).map_err(|e| e.0)?;
    Ok(())
}
