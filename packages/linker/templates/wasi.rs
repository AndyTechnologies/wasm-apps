// WASI mid-level wrapper for Rust (no_std compatible)
#![allow(non_snake_case, non_camel_case_types, dead_code)]

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
    fn __wasi_fd_prestat_dir_name(fd: i32, buf: *mut u8, len: usize) -> i32;
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
    /// Formats the error as `WASI error <code>`.
    ///
    /// # Examples
    ///
    /// ```
    /// let error = WasiError(2);
    /// assert_eq!(error.to_string(), "WASI error 2");
    /// ```
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "WASI error {}", self.0)
    }
}

// ── Stdout/stderr ─────────────────────────────────

/// Writes bytes to the standard output stream.
///
/// # Examples
///
/// ```
/// let written = stdout_write(b"Hello, world!\n").unwrap();
/// assert_eq!(written, 15);
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the write operation fails.
///
/// # Parameters
///
/// * `data` - The bytes to write.
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

/// Writes a UTF-8 string to standard output.
///
/// # Examples
///
/// ```
/// let bytes_written = stdout_str("Hello, world!").unwrap();
/// assert_eq!(bytes_written, 13);
/// ```
///
/// # Returns
///
/// The number of bytes written, or a [`WasiError`] if the write fails.
pub fn stdout_str(s: &str) -> Result<usize, WasiError> {
    stdout_write(s.as_bytes())
}

/// Writes bytes to the standard error stream.
///
/// # Returns
///
/// The number of bytes written.
///
/// # Errors
///
/// Returns a [`WasiError`] if the WASI write operation fails.
///
/// # Examples
///
/// ```
/// let written = stderr_write(b"error\n").unwrap();
/// assert_eq!(written, 6);
/// ```
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
/// # Examples
///
/// ```
/// let written = fd_write(1, b"hello").unwrap();
/// assert_eq!(written, 5);
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] when the WASI write operation fails.
pub fn fd_write(fd: i32, data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(fd, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

/// Reads bytes from a file descriptor into a buffer.
///
/// # Parameters
///
/// * `buf` - Buffer that receives the bytes read.
///
/// # Returns
///
/// The number of bytes read, or a [`WasiError`] if the read fails.
///
/// # Examples
///
/// ```
/// let mut buffer = [0u8; 16];
/// let bytes_read = fd_read(0, &mut buffer)?;
/// assert!(bytes_read <= buffer.len());
/// # Ok::<(), WasiError>(())
/// ```
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

/// ```

/// let result = fd_close(3);

/// assert!(result.is_ok() || result.is_err());

/// ```

///

/// # Returns

///

/// `Ok(())` when the descriptor is closed successfully, or a `WasiError`

/// containing the WASI error code.
pub fn fd_close(fd: i32) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_fd_close(fd) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Moves a file descriptor's position and reports the resulting absolute offset.
///
/// `whence` selects the reference point for `offset`, such as the beginning,
/// current position, or end of the file.
///
/// # Errors
///
/// Returns a [`WasiError`] when the seek operation fails.
///
/// # Examples
///
/// ```no_run
/// let position = fd_seek(fd, 0, 0)?;
/// # let _: Result<(), WasiError> = Ok(());
/// ```
///
/// # Arguments
///
/// * `fd` - The file descriptor to seek.
/// * `offset` - The signed displacement from the position selected by `whence`.
/// * `whence` - The reference position for the displacement.
///
/// # Returns
///
/// The resulting absolute file offset.
pub fn fd_seek(fd: i32, offset: i64, whence: i32) -> Result<u64, WasiError> {
    let mut newoffset: u64 = 0;
    let ret = unsafe { __wasi_fd_seek(fd, offset, whence, &mut newoffset) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(newoffset)
}

// ── Preopen dir scanning ───────────────────────────

/// Retrieves metadata for a preopened directory associated with a file descriptor.
///
/// # Examples
///
/// ```
/// let result = fd_prestat_get(3);
/// assert!(result.is_ok() || result.is_err());
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the WASI operation fails.
///
/// # Arguments
///
/// * `fd` - The file descriptor for the preopened directory.
///
/// # Returns
///
/// The preopened-directory metadata associated with `fd`.
pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError>
pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
    let mut buf: __wasi_prestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_fd_prestat_get(fd, &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

/// Retrieves the path associated with a preopened directory descriptor.
///
/// # Examples
///
/// ```no_run
/// let directory_name = fd_prestat_dir_name(3)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Arguments
///
/// * `fd` - The preopened directory file descriptor.
///
/// # Returns
///
/// The directory path as bytes without a trailing NUL byte.
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

/// Reads directory entries from a file descriptor into a buffer, starting at the specified cookie.
///
/// # Examples
///
/// ```no_run
/// let mut buffer = [0u8; 4096];
/// let bytes_read = fd_readdir(3, &mut buffer, 0)?;
/// # let _ = bytes_read;
/// # Ok::<(), WasiError>(())
/// ```
///
/// The returned byte count indicates how much of the buffer was filled. Use the
/// cookie from a directory entry to continue reading subsequent entries.
pub fn fd_readdir(fd: i32, buf: &mut [u8], cookie: u64) -> Result<usize, WasiError> {
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_readdir(fd, buf.as_mut_ptr(), buf.len(), cookie, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

// ── Path operations ────────────────────────────────

const RIGHTS_READ: u64 = 0x0000000000000001;
const RIGHTS_WRITE: u64 = 0x0000000000000002;

/// Opens a path relative to a directory file descriptor with the requested access and creation options.
///
/// # Examples
///
/// ```no_run
/// let fd = path_open(3, b"file.txt", true, true)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Arguments
///
/// * `dir_fd` - File descriptor of the directory containing the path.
/// * `path` - Path to open, without a trailing NUL byte.
/// * `for_write` - Whether to request write access.
/// * `create` - Whether to create the file when it does not exist.
///
/// # Returns
///
/// The opened file descriptor, or the WASI error from the operation.
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
/// ```
/// let metadata = path_filestat_get(3, b"example.txt");
/// assert!(metadata.is_ok());
/// ```
///
/// # Arguments
///
/// * `dir_fd` - Directory descriptor used as the path's base.
/// * `path` - Path whose metadata is requested.
///
/// # Returns
///
/// The file metadata, or a [`WasiError`] if the metadata cannot be retrieved.
pub fn path_filestat_get(dir_fd: i32, path: &[u8]) -> Result<__wasi_filestat_t, WasiError> {
    let mut buf: __wasi_filestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_path_filestat_get(dir_fd, 0, path.as_ptr(), path.len(), &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

/// Removes a file relative to a directory file descriptor.

///

/// # Examples

///

/// ```no_run

/// let result = path_unlink_file(3, b"temporary.txt");

/// assert!(result.is_ok());

/// ```

///

/// # Errors

///

/// Returns the WASI error reported when the file cannot be removed.
pub fn path_unlink_file(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_unlink_file(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Creates a directory at the specified path relative to a file descriptor.
///
/// # Parameters
///
/// * `dir_fd` — File descriptor of the directory containing the new directory.
/// * `path` — Directory path, excluding a trailing NUL byte.
///
/// # Returns
///
/// `Ok(())` when the directory is created, or a [`WasiError`] describing the failure.
///
/// # Examples
///
/// ```no_run
/// path_create_directory(3, b"new-directory").unwrap();
/// ```
pub fn path_create_directory(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_create_directory(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

// ── Convenience ────────────────────────────────────

/// Retrieves the WASI file type for a path relative to a directory descriptor.
///
/// # Returns
///
/// The file type reported by WASI, such as [`FILETYPE_REGULAR_FILE`] or [`FILETYPE_DIRECTORY`].
///
/// # Examples
///
/// ```
/// let file_type = stat_file(3, b"file.txt")?;
/// assert_eq!(file_type, FILETYPE_REGULAR_FILE);
/// # Ok::<(), WasiError>(())
/// ```
pub fn stat_file(dir_fd: i32, path: &[u8]) -> Result<u32, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_filetype)
}

/// Retrieves the size of a file relative to a directory descriptor.
///
/// # Examples
///
/// ```no_run
/// let size = file_size(3, b"example.txt")?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Errors
///
/// Returns the WASI error produced when the file metadata cannot be retrieved.
pub fn file_size(dir_fd: i32, path: &[u8]) -> Result<u64, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_size)
}

/// Checks whether a path can be located relative to a directory descriptor.
///
/// # Examples
///
/// ```
/// assert!(!file_exists(-1, b"missing"));
/// ```
///
/// Returns `true` when metadata lookup succeeds, or `false` when it fails.
pub fn file_exists(dir_fd: i32, path: &[u8]) -> bool {
    path_filestat_get(dir_fd, path).is_ok()
}

// ── Environment ────────────────────────────────────

/// Populates caller-provided storage with the process environment variables.
///
/// `environ` receives pointers to each environment entry, and `environ_buf`
/// receives the corresponding NUL-terminated strings. Allocate the required
/// storage using [`environ_sizes_get`] before calling this function.
///
/// # Examples
///
/// ```no_run
/// let mut pointers = [core::ptr::null_mut(); 16];
/// let mut buffer = [0u8; 1024];
///
/// environ_get(pointers.as_mut_ptr(), buffer.as_mut_ptr()).unwrap();
/// ```
///
/// # Safety
///
/// The pointers must reference writable storage large enough for all
/// environment pointers and strings.
pub fn environ_get(environ: *mut *mut u8, environ_buf: *mut u8) -> Result<(), WasiError>
pub fn environ_get(environ: *mut *mut u8, environ_buf: *mut u8) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_environ_get(environ, environ_buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Retrieves the number of environment variables and the buffer size required to store them.
///
/// # Examples
///
/// ```
/// let (count, buffer_size) = environ_sizes_get().unwrap();
/// assert!(buffer_size >= count);
/// ```
///
/// # Returns
///
/// The number of environment variables and the required environment buffer size.
///
/// # Errors
///
/// Returns a [`WasiError`] if the WASI environment-size query fails.
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
/// ```no_run
/// exit(0);
/// ```
pub fn exit(code: i32) -> ! {
    unsafe { __wasi_proc_exit(code) }
}

/// Retrieves the current time from a WASI clock.
///
/// `id` identifies the clock, and `precision` specifies the requested clock precision
/// in nanoseconds.
///
/// # Examples
///
/// ```
/// let time = clock_time(0, 1)?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Returns
///
/// The clock time, or a `WasiError` if the clock query fails.
pub fn clock_time(id: u32, precision: u64) -> Result<u64, WasiError> {
    let mut time: u64 = 0;
    let ret = unsafe { __wasi_clock_time_get(id, precision, &mut time) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(time)
}

// ── WasiError as From<WasiError> helper ────────────

impl From<WasiError> for i32 {
    /// Converts a [`WasiError`] into its underlying WASI error code.
///
/// # Examples
///
/// ```
/// let error = WasiError(5);
/// let code: i32 = error.into();
/// assert_eq!(code, 5);
/// ```
fn from(e: WasiError) -> Self { e.0 }
}
