// WASI mid-level wrapper for Rust (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;

// ── Raw syscall declarations ───────────────────────

#[link(wasm_import_module = "wasi_snapshot_preview1")]
extern "C" {
    #[link_name = "fd_write"]
    fn __wasi_fd_write(fd: i32, iovs: *const __wasi_iovec_t, iovs_len: usize, nwritten: *mut usize) -> i32;
    #[link_name = "fd_read"]
    fn __wasi_fd_read(fd: i32, iovs: *const __wasi_iovec_t, iovs_len: usize, nread: *mut usize) -> i32;
    #[link_name = "fd_close"]
    fn __wasi_fd_close(fd: i32) -> i32;
    #[link_name = "fd_seek"]
    fn __wasi_fd_seek(fd: i32, offset: i64, whence: i32, newoffset: *mut u64) -> i32;
    #[link_name = "fd_prestat_get"]
    fn __wasi_fd_prestat_get(fd: i32, buf: *mut __wasi_prestat_t) -> i32;
    #[link_name = "fd_prestat_dir_name"]
    pub fn __wasi_fd_prestat_dir_name(fd: i32, buf: *mut u8, len: usize) -> i32;
    #[link_name = "fd_readdir"]
    fn __wasi_fd_readdir(fd: i32, buf: *mut u8, len: usize, cookie: u64, nread: *mut usize) -> i32;
    #[link_name = "path_open"]
    fn __wasi_path_open(fd: i32, dirflags: i32, path: *const u8, path_len: usize, oflags: u32, fs_rights_base: u64, fs_rights_inheriting: u64, fdflags: i32, opened_fd: *mut i32) -> i32;
    #[link_name = "path_filestat_get"]
    fn __wasi_path_filestat_get(fd: i32, flags: i32, path: *const u8, path_len: usize, buf: *mut __wasi_filestat_t) -> i32;
    #[link_name = "path_unlink_file"]
    fn __wasi_path_unlink_file(fd: i32, path: *const u8, path_len: usize) -> i32;
    #[link_name = "path_create_directory"]
    fn __wasi_path_create_directory(fd: i32, path: *const u8, path_len: usize) -> i32;
    #[link_name = "environ_get"]
    fn __wasi_environ_get(environ: *mut *mut u8, environ_buf: *mut u8) -> i32;
    #[link_name = "environ_sizes_get"]
    fn __wasi_environ_sizes_get(count: *mut usize, buf_size: *mut usize) -> i32;
    #[link_name = "proc_exit"]
    fn __wasi_proc_exit(code: i32) -> !;
    #[link_name = "clock_time_get"]
    fn __wasi_clock_time_get(id: u32, precision: u64, time: *mut u64) -> i32;
}

// ── WASI types ─────────────────────────────────────

#[repr(C)]
pub struct __wasi_iovec_t {
    pub buf: *const u8,
    pub buf_len: usize,
}

#[repr(C)]
pub struct __wasi_prestat_t {
    pub pr_type: u8,
    pub padding: [u8; 3],
    pub pr_name_len: u32,
}

#[repr(C)]
pub struct __wasi_filestat_t {
    pub st_dev: u64,
    pub st_ino: u64,
    pub st_filetype: u32,
    pub st_nlink: u32,
    pub st_size: u64,
    pub st_atim: u64,
    pub st_mtim: u64,
    pub st_ctim: u64,
}

// Filetype constants
pub const FILETYPE_DIRECTORY: u32 = 3;
pub const FILETYPE_REGULAR_FILE: u32 = 4;

// ── Error type ─────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WasiError(pub i32);

impl core::fmt::Display for WasiError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "WASI error {}", self.0)
    }
}

// ── Stdout/stderr ─────────────────────────────────

/// Writes bytes to standard output.
///
/// # Examples
///
/// ```
/// let written = stdout_write(b"Hello, world!\n").unwrap();
/// assert_eq!(written, 14);
/// ```
///
/// # Returns
///
/// The number of bytes written.
pub fn stdout_write(data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(1, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

/// Writes a string to standard output.
///
/// # Examples
///
/// ```
/// let written = stdout_str("Hello, world!").unwrap();
/// assert_eq!(written, 13);
/// ```
///
/// # Returns
///
/// The number of bytes written.
pub fn stdout_str(s: &str) -> Result<usize, WasiError> {
    stdout_write(s.as_bytes())
}

/// Writes bytes to standard error.
///
/// # Examples
///
/// ```
/// let message = b"error message\n";
/// let written = stderr_write(message).unwrap();
/// assert_eq!(written, message.len());
/// ```
///
/// # Returns
///
/// The number of bytes written.
///
/// # Errors
///
/// Returns `WasiError` if the WASI write operation fails.
pub fn stderr_write(data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(2, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

// ── Low-level I/O ─────────────────────────────────

/// Writes bytes to a file descriptor.
///
/// # Parameters
///
/// * `fd` - The file descriptor to write to.
/// * `data` - The bytes to write.
///
/// # Returns
///
/// The number of bytes written.
///
/// # Examples
///
/// ```
/// let written = fd_write(1, b"hello").unwrap();
/// assert_eq!(written, 5);
/// ```
pub fn fd_write(fd: i32, data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(fd, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

/// Reads bytes from a file descriptor into a buffer.
///
/// # Examples
///
/// ```no_run
/// let mut buffer = [0u8; 128];
/// let bytes_read = fd_read(0, &mut buffer)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Parameters
///
/// * `fd` - The file descriptor to read from.
/// * `buf` - The buffer receiving the data.
///
/// # Returns
///
/// The number of bytes read.
pub fn fd_read(fd: i32, buf: &mut [u8]) -> Result<usize, WasiError> {
pub fn fd_read(fd: i32, buf: &mut [u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: buf.as_ptr(), buf_len: buf.len() };
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_read(fd, &iov, 1, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

/// Closes a WASI file descriptor.
///
/// # Examples
///
/// ```no_run
/// fd_close(fd)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the descriptor cannot be closed.
pub fn fd_close(fd: i32) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_fd_close(fd) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Changes the file descriptor's current position.
///
/// # Arguments
///
/// * `fd` - The file descriptor to reposition.
/// * `offset` - The position adjustment.
/// * `whence` - The reference position used to apply the offset.
///
/// # Returns
///
/// The resulting file position.
///
/// # Errors
///
/// Returns a [`WasiError`] if the seek operation fails.
///
/// # Examples
///
/// ```
/// let position = fd_seek(0, 0, 0);
/// assert!(position.is_ok());
/// ```
pub fn fd_seek(fd: i32, offset: i64, whence: i32) -> Result<u64, WasiError> {
    let mut newoffset: u64 = 0;
    let ret = unsafe { __wasi_fd_seek(fd, offset, whence, &mut newoffset) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(newoffset)
}

// ── Preopen dir scanning ───────────────────────────

/// Retrieves metadata for a preopened directory descriptor.
///
/// # Examples
///
/// ```
/// let result = fd_prestat_get(3);
///
/// if let Ok(prestat) = result {
///     assert!(prestat.pr_type != 0);
/// }
/// ```
///
/// # Returns
///
/// The preopen metadata, or a [`WasiError`] if the descriptor is not a preopened directory.
pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
    let mut buf: __wasi_prestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_fd_prestat_get(fd, &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

/// Retrieves the path of a preopened directory.
///
/// # Parameters
///
/// * `fd` - File descriptor for the preopened directory.
///
/// # Returns
///
/// The preopened directory path as bytes.
///
/// # Examples
///
/// ```no_run
/// let name = fd_prestat_dir_name(3)?;
/// assert!(!name.is_empty());
/// # Ok::<(), WasiError>(())
/// ```
pub fn fd_prestat_dir_name(fd: i32) -> Result<Vec<u8>, WasiError> {
pub fn fd_prestat_dir_name(fd: i32) -> Result<Vec<u8>, WasiError> {
    let prestat = fd_prestat_get(fd)?;
    let mut name = vec![0u8; prestat.pr_name_len as usize];
    let ret = unsafe { __wasi_fd_prestat_dir_name(fd, name.as_mut_ptr(), name.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    // Trim trailing NUL if present
    if let Some(pos) = name.iter().position(|&b| b == 0) {
        name.truncate(pos);
    }
    Ok(name)
}

/// Reads directory entries from a file descriptor into a caller-provided buffer.

///

/// `cookie` specifies the directory position from which reading begins.

///

/// # Examples

///

/// ```no_run

/// let mut buffer = [0u8; 1024];

/// let bytes_read = fd_readdir(3, &mut buffer, 0)?;

/// assert!(bytes_read <= buffer.len());

/// # Ok::<(), WasiError>(())

/// ```

///

/// # Errors

///

/// Returns a [`WasiError`] if the directory entries cannot be read.

///

/// # Returns

///

/// The number of bytes written to `buf`.
pub fn fd_readdir(fd: i32, buf: &mut [u8], cookie: u64) -> Result<usize, WasiError> {
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_readdir(fd, buf.as_mut_ptr(), buf.len(), cookie, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

// ── Path operations ────────────────────────────────

const RIGHTS_READ: u64 = 0x0000000000000001;
const RIGHTS_WRITE: u64 = 0x0000000000000002;

/// Opens a path relative to a directory file descriptor with the requested access mode.
///
/// Read access is always requested. Write access is requested when `for_write` or
/// `create` is `true`.
///
/// # Examples
///
/// ```no_run
/// let fd = path_open(3, b"file.txt", false, false)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Arguments
///
/// * `dir_fd` - File descriptor of the directory containing the path.
/// * `path` - Path to open, represented as bytes.
/// * `for_write` - Whether to request write access.
/// * `create` - Whether to create the file if it does not exist.
///
/// # Returns
///
/// The opened file descriptor on success, or the WASI error on failure.
pub fn path_open(dir_fd: i32, path: &[u8], for_write: bool, create: bool) -> Result<i32, WasiError> {
    let mut oflags: u32 = 0;
    let mut rights_base: u64 = RIGHTS_READ;
    if for_write {
        rights_base |= RIGHTS_WRITE;
    }
    if create {
        oflags |= 0x01; // O_CREAT
        rights_base |= RIGHTS_WRITE;
    }
    let mut opened_fd: i32 = -1;
    let ret = unsafe {
        __wasi_path_open(dir_fd, 0, path.as_ptr(), path.len(), oflags,
                         rights_base, rights_base, 0, &mut opened_fd)
    };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(opened_fd)
}

/// Retrieves file metadata for a path relative to a directory descriptor.
///
/// # Examples
///
/// ```no_run
/// let metadata = path_filestat_get(3, b"file.txt")?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Parameters
///
/// - `dir_fd`: Directory descriptor relative to which the path is resolved.
/// - `path`: Path whose metadata is requested.
///
/// # Returns
///
/// The file metadata, or a [`WasiError`] if the operation fails.
pub fn path_filestat_get(dir_fd: i32, path: &[u8]) -> Result<__wasi_filestat_t, WasiError> {
    let mut buf: __wasi_filestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_path_filestat_get(dir_fd, 0, path.as_ptr(), path.len(), &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

/// Removes a file relative to a directory file descriptor.
///
/// # Parameters
///
/// * `dir_fd` - File descriptor of the directory containing the file.
/// * `path` - Path of the file to remove.
///
/// # Returns
///
/// `Ok(())` when the file is removed, or a `WasiError` when the operation fails.
///
/// # Examples
///
/// ```
/// let result = path_unlink_file(3, b"temporary.txt");
/// assert!(result.is_ok());
/// ```
pub fn path_unlink_file(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
pub fn path_unlink_file(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_unlink_file(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Creates a directory at a path relative to a directory descriptor.

///

/// # Examples

///

/// ```no_run

/// path_create_directory(dir_fd, b"new-directory")?;

/// # Ok::<(), WasiError>(())

/// ```

///

/// `path` is passed as a byte slice without a terminating NUL.
pub fn path_create_directory(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_create_directory(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

// ── Convenience ────────────────────────────────────

/// Retrieves the file type for a path relative to a directory descriptor.

///

/// # Examples

///

/// ```no_run

/// let file_type = stat_file(3, b"file.txt")?;

/// println!("{file_type}");

/// # Ok::<(), WasiError>(())

/// ```

///

/// # Arguments

///

/// * `dir_fd` - The directory descriptor relative to which the path is resolved.

/// * `path` - The path to inspect as a byte slice.

///

/// # Returns

///

/// The WASI file type for the path.
pub fn stat_file(dir_fd: i32, path: &[u8]) -> Result<u32, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_filetype)
}

/// Retrieves the size of a file relative to a directory descriptor.
///
/// # Examples
///
/// ```
/// # fn main() -> Result<(), WasiError> {
/// let size = file_size(3, b"file.txt")?;
/// assert!(size >= 0);
/// # Ok(())
/// # }
/// ```
///
/// # Errors
///
/// Returns a `WasiError` if the file metadata cannot be retrieved.
///
/// # Returns
///
/// The file size in bytes.
pub fn file_size(dir_fd: i32, path: &[u8]) -> Result<u64, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_size)
}

/// Determines whether a path can be retrieved relative to a directory descriptor.
///
/// # Examples
///
/// ```no_run
/// let exists = file_exists(3, b"config.toml");
/// println!("File exists: {exists}");
/// ```
///
/// # Parameters
///
/// * `dir_fd` - Directory descriptor used as the path's base.
/// * `path` - Path to inspect.
///
/// # Returns
///
/// `true` if metadata retrieval succeeds, `false` otherwise.
pub fn file_exists(dir_fd: i32, path: &[u8]) -> bool {
    path_filestat_get(dir_fd, path).is_ok()
}

// ── Environment ────────────────────────────────────

/// Fills caller-provided memory with the process environment entries.

///

/// # Errors

///

/// Returns a [`WasiError`] if the environment cannot be written to the supplied

/// buffers.

///

/// # Examples

///

/// ```no_run

/// let mut environ = core::ptr::null_mut();

/// let mut environ_buf = core::ptr::null_mut();

///

/// environ_get(&mut environ, environ_buf);

/// ```
pub fn environ_get(environ: *mut *mut u8, environ_buf: *mut u8) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_environ_get(environ, environ_buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Retrieves the number of environment entries and the buffer size required to store them.
///
/// # Returns
///
/// A tuple containing the environment entry count and required buffer size in bytes.
///
/// # Errors
///
/// Returns a [`WasiError`] if the WASI environment-size query fails.
///
/// # Examples
///
/// ```
/// let (count, buffer_size) = environ_sizes_get().unwrap();
/// assert!(count >= 0);
/// assert!(buffer_size >= 0);
/// ```
pub fn environ_sizes_get() -> Result<(usize, usize), WasiError> {
pub fn environ_sizes_get() -> Result<(usize, usize), WasiError> {
    let mut count: usize = 0;
    let mut buf_size: usize = 0;
    let ret = unsafe { __wasi_environ_sizes_get(&mut count, &mut buf_size) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok((count, buf_size))
}

// ── Utility ────────────────────────────────────────

/// Terminates the process with the specified exit code.
///
/// # Examples
///
/// ```
/// let terminate: fn(i32) -> ! = exit;
/// terminate(0);
/// ```
pub fn exit(code: i32) -> ! {
    unsafe { __wasi_proc_exit(code) }
}

/// Retrieves the current value of a WASI clock.
///
/// # Arguments
///
/// * `id` - The WASI clock identifier.
/// * `precision` - The requested clock precision in nanoseconds.
///
/// # Returns
///
/// The clock value in nanoseconds, or a [`WasiError`] if the clock cannot be read.
///
/// # Examples
///
/// ```
/// let time = clock_time(0, 0).expect("clock read failed");
/// assert!(time > 0);
/// ```
pub fn clock_time(id: u32, precision: u64) -> Result<u64, WasiError> {
    let mut time: u64 = 0;
    let ret = unsafe { __wasi_clock_time_get(id, precision, &mut time) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(time)
}

// ── WasiError as From<WasiError> helper ────────────

impl From<WasiError> for i32 {
    /// Converts a [`WasiError`] into its numeric error code.
///
/// # Examples
///
/// ```
/// let code: i32 = WasiError(-1).into();
/// assert_eq!(code, -1);
/// ```
fn from(e: WasiError) -> Self { e.0 }
}
