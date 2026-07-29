// WASI mid-level wrapper local copy for examples
#![allow(non_snake_case, non_camel_case_types, dead_code)]

#[link(wasm_import_module = "wasi_snapshot_preview1")]
extern "C" {
    #[link_name = "fd_write"]
    fn __wasi_fd_write(fd: i32, iovs: *const __wasi_iovec_t, iovs_len: usize, nwritten: *mut usize) -> i32;
    #[link_name = "fd_read"]
    fn __wasi_fd_read(fd: i32, iovs: *const __wasi_iovec_t, iovs_len: usize, nread: *mut usize) -> i32;
    #[link_name = "fd_close"]
    fn __wasi_fd_close(fd: i32) -> i32;
    #[link_name = "fd_prestat_get"]
    fn __wasi_fd_prestat_get(fd: i32, buf: *mut __wasi_prestat_t) -> i32;
    #[link_name = "fd_prestat_dir_name"]
    fn __wasi_fd_prestat_dir_name(fd: i32, buf: *mut u8, len: usize) -> i32;
    #[link_name = "path_open"]
    fn __wasi_path_open(fd: i32, dirflags: i32, path: *const u8, path_len: usize, oflags: u32, fs_rights_base: u64, fs_rights_inheriting: u64, fdflags: i32, opened_fd: *mut i32) -> i32;
    #[link_name = "path_filestat_get"]
    fn __wasi_path_filestat_get(fd: i32, flags: i32, path: *const u8, path_len: usize, buf: *mut __wasi_filestat_t) -> i32;
    #[link_name = "path_unlink_file"]
    fn __wasi_path_unlink_file(fd: i32, path: *const u8, path_len: usize) -> i32;
    #[link_name = "path_create_directory"]
    fn __wasi_path_create_directory(fd: i32, path: *const u8, path_len: usize) -> i32;
}

#[repr(C)]
pub struct __wasi_iovec_t { pub buf: *const u8, pub buf_len: usize }
#[repr(C)]
pub struct __wasi_prestat_t { pub pr_name_len: usize }
#[repr(C)]
pub struct __wasi_filestat_t { pub st_dev: u64, pub st_ino: u64, pub st_filetype: u32, pub st_nlink: u32, pub st_size: u64, pub st_atim: u64, pub st_mtim: u64, pub st_ctim: u64 }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WasiError(pub i32);

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

pub fn fd_prestat_get(fd: i32) -> Result<__wasi_prestat_t, WasiError> {
    let mut buf: __wasi_prestat_t = unsafe { core::mem::zeroed() };
    let ret = unsafe { __wasi_fd_prestat_get(fd, &mut buf) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(buf)
}

pub fn path_open(dir_fd: i32, path: &[u8], for_write: bool, create: bool) -> Result<i32, WasiError> {
    let mut oflags: u32 = 0; let mut rights_base: u64 = 0x0000000000000001;
    if for_write { oflags |= 0x02; rights_base |= 0x0000000000000002; }
    if create { oflags |= 0x40; rights_base |= 0x0000000000000002; }
    let mut opened_fd: i32 = -1;
    let ret = unsafe { __wasi_path_open(dir_fd, 0, path.as_ptr(), path.len(), oflags, rights_base, rights_base, 0, &mut opened_fd) };
    if ret != 0 { return Err(WasiError(-ret)); }
    Ok(opened_fd)
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

pub fn file_exists(dir_fd: i32, path: &[u8]) -> bool {
    let mut buf: __wasi_filestat_t = unsafe { core::mem::zeroed() };
    unsafe { __wasi_path_filestat_get(dir_fd, 0, path.as_ptr(), path.len(), &mut buf) == 0 }
}
