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
    pub pr_name_len: usize,
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

pub fn stdout_write(data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(1, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

pub fn stdout_str(s: &str) -> Result<usize, WasiError> {
    stdout_write(s.as_bytes())
}

pub fn stderr_write(data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(2, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

// ── Low-level I/O ─────────────────────────────────

pub fn fd_write(fd: i32, data: &[u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: data.as_ptr(), buf_len: data.len() };
    let mut written: usize = 0;
    let ret = unsafe { __wasi_fd_write(fd, &iov, 1, &mut written) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(written)
}

pub fn fd_read(fd: i32, buf: &mut [u8]) -> Result<usize, WasiError> {
    let iov = __wasi_iovec_t { buf: buf.as_ptr(), buf_len: buf.len() };
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_read(fd, &iov, 1, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

pub fn fd_close(fd: i32) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_fd_close(fd) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

pub fn fd_seek(fd: i32, offset: i64, whence: i32) -> Result<u64, WasiError> {
    let mut newoffset: u64 = 0;
    let ret = unsafe { __wasi_fd_seek(fd, offset, whence, &mut newoffset) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(newoffset)
}

// ── Preopen dir scanning ───────────────────────────

pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
    let mut buf: __wasi_prestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_fd_prestat_get(fd, &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

pub fn fd_prestat_dir_name(fd: i32) -> Result<Vec<u8>, WasiError> {
    let prestat = fd_prestat_get(fd)?;
    let mut name = vec![0u8; prestat.pr_name_len];
    let ret = unsafe { __wasi_fd_prestat_dir_name(fd, name.as_mut_ptr(), name.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    // Trim trailing NUL if present
    if let Some(pos) = name.iter().position(|&b| b == 0) {
        name.truncate(pos);
    }
    Ok(name)
}

pub fn fd_readdir(fd: i32, buf: &mut [u8], cookie: u64) -> Result<usize, WasiError> {
    let mut nread: usize = 0;
    let ret = unsafe { __wasi_fd_readdir(fd, buf.as_mut_ptr(), buf.len(), cookie, &mut nread) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(nread)
}

// ── Path operations ────────────────────────────────

const RIGHTS_READ: u64 = 0x0000000000000001;
const RIGHTS_WRITE: u64 = 0x0000000000000002;

pub fn path_open(dir_fd: i32, path: &[u8], for_write: bool, create: bool) -> Result<i32, WasiError> {
    let mut oflags: u32 = 0;
    let mut rights_base: u64 = RIGHTS_READ;
    if for_write {
        oflags |= 0x02; // O_WRONLY
        rights_base |= RIGHTS_WRITE;
    }
    if create {
        oflags |= 0x40; // O_CREAT
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

pub fn path_filestat_get(dir_fd: i32, path: &[u8]) -> Result<__wasi_filestat_t, WasiError> {
    let mut buf: __wasi_filestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_path_filestat_get(dir_fd, 0, path.as_ptr(), path.len(), &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

pub fn path_unlink_file(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_unlink_file(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

pub fn path_create_directory(dir_fd: i32, path: &[u8]) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_path_create_directory(dir_fd, path.as_ptr(), path.len()) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

// ── Convenience ────────────────────────────────────

pub fn stat_file(dir_fd: i32, path: &[u8]) -> Result<u32, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_filetype)
}

pub fn file_size(dir_fd: i32, path: &[u8]) -> Result<u64, WasiError> {
    let st = path_filestat_get(dir_fd, path)?;
    Ok(st.st_size)
}

pub fn file_exists(dir_fd: i32, path: &[u8]) -> bool {
    path_filestat_get(dir_fd, path).is_ok()
}

// ── Environment ────────────────────────────────────

pub fn environ_get(environ: *mut *mut u8, environ_buf: *mut u8) -> Result<(), WasiError> {
    let ret = unsafe { __wasi_environ_get(environ, environ_buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(())
}

pub fn environ_sizes_get() -> Result<(usize, usize), WasiError> {
    let mut count: usize = 0;
    let mut buf_size: usize = 0;
    let ret = unsafe { __wasi_environ_sizes_get(&mut count, &mut buf_size) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok((count, buf_size))
}

// ── Utility ────────────────────────────────────────

pub fn exit(code: i32) -> ! {
    unsafe { __wasi_proc_exit(code) }
}

pub fn clock_time(id: u32, precision: u64) -> Result<u64, WasiError> {
    let mut time: u64 = 0;
    let ret = unsafe { __wasi_clock_time_get(id, precision, &mut time) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(time)
}

// ── WasiError as From<WasiError> helper ────────────

impl From<WasiError> for i32 {
    fn from(e: WasiError) -> Self { e.0 }
}
