#pragma once
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif
__attribute__((weak)) int32_t __wasi_fd_write(int32_t fd, const void *iovs, size_t iovs_len, size_t *nwritten);
__attribute__((weak)) int32_t __wasi_fd_read(int32_t fd, const void *iovs, size_t iovs_len, size_t *nread);
__attribute__((weak)) int32_t __wasi_fd_close(int32_t fd);
__attribute__((weak)) int32_t __wasi_fd_seek(int32_t fd, int64_t offset, int32_t whence, uint64_t *newoffset);
__attribute__((weak)) int32_t __wasi_fd_prestat_get(int32_t fd, void *buf);
__attribute__((weak)) int32_t __wasi_fd_prestat_dir_name(int32_t fd, char *buf, size_t len);
__attribute__((weak)) int32_t __wasi_path_open(int32_t fd, int32_t dirflags, const char *path, size_t path_len, uint32_t oflags, uint64_t fs_rights_base, uint64_t fs_rights_inheriting, int32_t fdflags, int32_t *opened_fd);
__attribute__((weak)) int32_t __wasi_path_filestat_get(int32_t fd, int32_t flags, const char *path, size_t path_len, void *buf);
__attribute__((weak)) int32_t __wasi_path_unlink_file(int32_t fd, const char *path, size_t path_len);
__attribute__((weak)) int32_t __wasi_path_create_directory(int32_t fd, const char *path, size_t path_len);
__attribute__((weak)) int32_t __wasi_environ_get(char **environ, char *environ_buf);
__attribute__((weak)) int32_t __wasi_environ_sizes_get(size_t *count, size_t *buf_size);
__attribute__((weak)) void __wasi_proc_exit(int32_t code);
__attribute__((weak)) int32_t __wasi_clock_time_get(int32_t id, uint64_t precision, uint64_t *time);
typedef struct { size_t pr_name_len; } __wasi_prestat_t;
typedef struct { uint64_t buf; size_t buf_len; } __wasi_iovec_t;
typedef struct { uint64_t st_dev; uint64_t st_ino; uint32_t st_filetype; uint32_t st_nlink; uint64_t st_size; uint64_t st_atim; uint64_t st_mtim; uint64_t st_ctim; } __wasi_filestat_t;
typedef uint64_t __wasi_dircookie_t;
#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
namespace wasi {
inline void stdout_write(const char *data, size_t len) {
    __wasi_iovec_t iov = { (uint64_t)(uintptr_t)data, len };
    size_t written = 0;
    __wasi_fd_write(1, &iov, 1, &written);
}
inline void stderr_write(const char *data, size_t len) {
    __wasi_iovec_t iov = { (uint64_t)(uintptr_t)data, len };
    size_t written = 0;
    __wasi_fd_write(2, &iov, 1, &written);
}
inline int fd_write(int fd, const char *data, size_t len) {
    __wasi_iovec_t iov = { (uint64_t)(uintptr_t)data, len };
    size_t written = 0;
    int err = __wasi_fd_write(fd, &iov, 1, &written);
    return err ? -err : (int)written;
}
inline int fd_read(int fd, char *buf, size_t len) {
    __wasi_iovec_t iov = { (uint64_t)(uintptr_t)buf, len };
    size_t nread = 0;
    int err = __wasi_fd_read(fd, &iov, 1, &nread);
    return err ? -err : (int)nread;
}
inline int fd_close(int fd) { return -__wasi_fd_close(fd); }
inline int path_open(int dir_fd, const char *path, size_t path_len, int oflags) {
    uint32_t flags = 0; uint64_t rights_base = 0;
    if (oflags & 0x01) { flags |= 0x01; rights_base |= 0x0000000000000001ULL; }
    if (oflags & 0x02) { flags |= 0x02; rights_base |= 0x0000000000000002ULL; }
    if (oflags & 0x40) { flags |= 0x40; rights_base |= 0x0000000000000004ULL; }
    int32_t opened_fd = -1;
    int err = __wasi_path_open(dir_fd, 0, path, path_len, flags, rights_base, rights_base, 0, &opened_fd);
    return err ? -err : (int)opened_fd;
}
inline int path_unlink_file(int dir_fd, const char *path, size_t path_len) { return -__wasi_path_unlink_file(dir_fd, path, path_len); }
inline int path_create_directory(int dir_fd, const char *path, size_t path_len) { return -__wasi_path_create_directory(dir_fd, path, path_len); }
inline bool file_exists(int dir_fd, const char *path) {
    size_t n = 0; while (path[n]) ++n;
    __wasi_filestat_t st;
    return __wasi_path_filestat_get(dir_fd, 0, path, n, &st) == 0;
}
inline int64_t file_size(int dir_fd, const char *path) {
    size_t n = 0; while (path[n]) ++n;
    __wasi_filestat_t st;
    return __wasi_path_filestat_get(dir_fd, 0, path, n, &st) ? -1 : (int64_t)st.st_size;
}
}
#endif
