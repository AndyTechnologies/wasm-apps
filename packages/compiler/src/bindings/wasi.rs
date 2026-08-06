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

/// Writes bytes to standard output.
///
/// # Examples
///
/// ```
/// let written = stdout_write(b"Hello, WASI!\n").unwrap();
/// assert!(written <= b"Hello, WASI!\n".len());
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the write fails.
///
/// @param data Bytes to write to standard output.
/// @returns The number of bytes written.
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
/// let bytes_written = stdout_str("Hello, WASI!\n").unwrap();
/// assert_eq!(bytes_written, "Hello, WASI!\n".len());
/// ```
///
/// # Returns
///
/// The number of bytes written on success.
pub fn stdout_str(s: &str) -> Result<usize, WasiError> {
    stdout_write(s.as_bytes())
}

/// Writes bytes to standard error.
///
/// # Returns
///
/// The number of bytes written, or a [`WasiError`] if the write fails.
///
/// # Examples
///
/// ```
/// let written = stderr_write(&[]).unwrap();
/// assert_eq!(written, 0);
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
/// let written = fd_write(1, b"Hello, WASI!\n").unwrap();
/// assert_eq!(written, 13);
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] when the WASI write operation fails.
pub fn fd_write(fd: i32, data: &[u8]) -> Result<usize, WasiError> {
pub fn fd_write(fd: i32, data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(fd, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

/// Reads bytes from a file descriptor into a buffer.
///
/// # Arguments
///
/// * `fd` - The file descriptor to read from.
/// * `buf` - The buffer that receives the bytes.
///
/// # Returns
///
/// The number of bytes read.
///
/// # Examples
///
/// ```no_run
/// let mut buffer = [0u8; 128];
/// let bytes_read = fd_read(0, &mut buffer)?;
/// # let _ = bytes_read;
/// # Ok::<(), WasiError>(())
/// ```
pub fn fd_read(fd: i32, buf: &mut [u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: buf.as_ptr(), buf_len: buf.len() };
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_read(fd, &iov, 1, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

/// Closes an open file descriptor.
///
/// # Examples
///
/// ```
/// let result = fd_close(3);
/// assert!(result.is_ok() || result.is_err());
/// ```
///
/// # Errors
///
/// Returns a `WasiError` if the descriptor cannot be closed.
pub fn fd_close(fd: i32) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_fd_close(fd) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Moves the file descriptor's position and reports the resulting offset.

///

/// `whence` specifies how `offset` is interpreted according to the WASI

/// seek operation.

///

/// # Examples

///

/// ```

/// let result = fd_seek(0, 0, 0);

/// let _ = result;

/// ```

///

/// # Returns

///

/// The new absolute file position on success.
pub fn fd_seek(fd: i32, offset: i64, whence: i32) -> Result<u64, WasiError> {
    let mut newoffset: u64 = 0;
    let ret = unsafe { __wasi_fd_seek(fd, offset, whence, &mut newoffset) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(newoffset)
}

// ── Preopen dir scanning ───────────────────────────

/// Retrieves preopen metadata for a file descriptor.

///

/// # Examples

///

/// ```rust,no_run

/// let prestat = fd_prestat_get(3)?;

/// # Ok::<(), WasiError>(())

/// ```

///

/// # Errors

///

/// Returns a [`WasiError`] when the WASI syscall fails.

///

/// # Returns

///

/// The preopen metadata associated with `fd`.

///

/// # Parameters

///

/// * `fd` - The file descriptor to query.
pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
    let mut buf: __wasi_prestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_fd_prestat_get(fd, &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

/// Reads the name of a preopened directory associated with a file descriptor.

///

/// The returned bytes exclude any trailing NUL terminator.

///

/// # Examples

///

/// ```no_run

/// let name = fd_prestat_dir_name(3)?;

/// println!("{}", String::from_utf8_lossy(&name));

/// # Ok::<(), WasiError>(())

/// ```

///

/// # Errors

///

/// Returns a [`WasiError`] if the descriptor is not a preopened directory or

/// if the WASI operation fails.
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

/// Reads directory entries from a file descriptor into a byte buffer.
///
/// `cookie` specifies the directory position from which to begin reading. The
/// returned length is the number of bytes written to `buf`.
///
/// # Examples
///
/// ```
/// let mut buffer = [0u8; 1024];
/// let _ = fd_readdir(3, &mut buffer, 0);
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] when the directory read fails.
///
/// # Parameters
///
/// * `fd` — File descriptor for the directory.
/// * `buf` — Buffer that receives the directory entry data.
/// * `cookie` — Directory position at which to begin reading.
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

/// Opens a path relative to a directory descriptor with the requested access and creation options.
///
/// # Arguments
///
/// * `dir_fd` - File descriptor of the directory containing the path.
/// * `path` - Path to open, relative to `dir_fd`.
/// * `for_write` - Whether the opened file requires write access.
/// * `create` - Whether to create the file when it does not exist.
///
/// # Returns
///
/// The descriptor for the opened path.
///
/// # Errors
///
/// Returns a [`WasiError`] when the WASI operation fails.
///
/// # Examples
///
/// ```no_run
/// let file_fd = path_open(3, b"notes.txt", true, true)?;
/// # let _ = file_fd;
/// # Ok::<(), WasiError>(())
/// ```
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

/// Retrieves metadata for a path relative to a directory descriptor.
///
/// # Examples
///
/// ```no_run
/// let metadata = path_filestat_get(3, b"file")?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the WASI metadata query fails.
///
/// # Returns
///
/// The file metadata for the specified path.
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
/// path_unlink_file(dir_fd, b"temporary.txt")?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// `path` must contain the file name or relative path to remove.
///
/// # Errors
///
/// Returns a [`WasiError`] when the file cannot be removed.
///
/// # Parameters
///
/// * `dir_fd` - File descriptor of the directory containing the file.
/// * `path` - File name or relative path of the file to remove.
pub fn path_unlink_file(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_unlink_file(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

/// Creates a directory at a path relative to a directory descriptor.
///
/// # Parameters
///
/// * `dir_fd` — File descriptor of the directory containing the new directory.
/// * `path` — Directory path represented as bytes.
///
/// # Returns
///
/// `Ok(())` when the directory is created, or a [`WasiError`] containing the WASI error code.
///
/// # Examples
///
/// ```no_run
/// let result = path_create_directory(dir_fd, b"new-directory");
/// assert!(result.is_ok());
/// ```
pub fn path_create_directory(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_create_directory(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

// ── Convenience ────────────────────────────────────

/// Retrieves the WASI file type for a path relative to a directory descriptor.
///
/// # Examples
///
/// ```
/// let file_type = stat_file(3, b"file");
/// assert!(file_type.is_ok());
/// ```
///
/// # Returns
///
/// The WASI file type for the specified path.
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
/// println!("{size} bytes");
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Errors
///
/// Returns a [`WasiError`] if the file metadata cannot be retrieved.
///
/// # Parameters
///
/// * `dir_fd` - Directory descriptor containing the file.
/// * `path` - File path relative to `dir_fd`.
///
/// # Returns
///
/// The file size in bytes.
pub fn file_size(dir_fd: i32, path: &[u8]) -> Result<u64, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_size)
}

/// Determines whether a file or directory exists at a path relative to a directory descriptor.
///
/// Returns `false` when the metadata query fails.
///
/// # Examples
///
/// ```
/// assert!(!file_exists(i32::MAX, b"missing"));
/// ```
pub fn file_exists(dir_fd: i32, path: &[u8]) -> bool {
    path_filestat_get(dir_fd, path).is_ok()
}

// ── Environment ────────────────────────────────────

/// Populates caller-provided storage with the process environment.
///
/// `environ` must point to an array of pointers, and `environ_buf` must point
/// to a buffer sized according to `environ_sizes_get`.
///
/// # Examples
///
/// ```no_run
/// let mut pointers = [core::ptr::null_mut(); 1];
/// let mut buffer = [0u8; 1];
///
/// environ_get(pointers.as_mut_ptr(), buffer.as_mut_ptr())?;
/// # Ok::<(), WasiError>(())
/// ```
///
/// # Errors
///
/// Returns the WASI error produced by the environment query.
///
/// # Arguments
///
/// * `environ` - Pointer to storage for environment-variable pointers.
/// * `environ_buf` - Pointer to storage for environment-variable data.
///
/// # Returns
///
/// `Ok(())` when the environment is written successfully.
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
/// assert!(count >= 0);
/// assert!(buffer_size >= 0);
/// ```
///
/// # Returns
///
/// A tuple containing the environment variable count and required buffer size in bytes.
pub fn environ_sizes_get() -> Result<(usize, usize), WasiError> {
    let mut count: usize = 0;
    let mut buf_size: usize = 0;
    let ret = unsafe { __wasi_environ_sizes_get(&mut count, &mut buf_size) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok((count, buf_size))
}

// ── Utility ────────────────────────────────────────

/// Terminates the current process with the specified exit code.
///
/// # Examples
///
/// ```no_run
/// exit(0);
/// ```
pub fn exit(code: i32) -> !
pub fn exit(code: i32) -> ! {
    unsafe { __wasi_proc_exit(code) }
}

/// Retrieves the current value of a WASI clock.
///
/// # Parameters
///
/// * `id` - WASI clock identifier.
/// * `precision` - Requested clock precision in nanoseconds.
///
/// # Returns
///
/// The clock value in nanoseconds.
///
/// # Examples
///
/// ```
/// let time = clock_time(0, 0)?;
/// assert!(time > 0);
/// # Ok::<(), WasiError>(())
/// ```
pub fn clock_time(id: u32, precision: u64) -> Result<u64, WasiError> {
    let mut time: u64 = 0;
    let ret = unsafe { __wasi_clock_time_get(id, precision, &mut time) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(time)
}

// ── WasiError as From<WasiError> helper ────────────

impl From<WasiError> for i32 {
    /// Converts a WASI error into its numeric error code.
///
/// # Examples
///
/// ```
/// let error = WasiError(2);
/// let code: i32 = error.into();
/// assert_eq!(code, 2);
/// ```
///
/// Returns the WASI error code.
fn from(e: WasiError) -> Self { e.0 }
}
