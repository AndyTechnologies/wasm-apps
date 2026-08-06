#pragma once
// WASI mid-level wrapper for C++ (-nostdlib compatible)

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Raw WASI syscall declarations (imported from wasi_snapshot_preview1)
#define WASI_IMPORT(name) __attribute__((__import_module__("wasi_snapshot_preview1"), __import_name__(name)))
WASI_IMPORT("fd_write")    int32_t __wasi_fd_write(int32_t fd, const void *iovs, size_t iovs_len, size_t *nwritten);
WASI_IMPORT("fd_read")     int32_t __wasi_fd_read(int32_t fd, const void *iovs, size_t iovs_len, size_t *nread);
WASI_IMPORT("fd_close")    int32_t __wasi_fd_close(int32_t fd);
WASI_IMPORT("fd_seek")     int32_t __wasi_fd_seek(int32_t fd, int64_t offset, int32_t whence, uint64_t *newoffset);
WASI_IMPORT("fd_prestat_get")    int32_t __wasi_fd_prestat_get(int32_t fd, void *buf);
WASI_IMPORT("fd_prestat_dir_name") int32_t __wasi_fd_prestat_dir_name(int32_t fd, char *buf, size_t len);
WASI_IMPORT("fd_readdir")  int32_t __wasi_fd_readdir(int32_t fd, void *buf, size_t len, uint64_t cookie, size_t *nread);
WASI_IMPORT("path_open")   int32_t __wasi_path_open(int32_t fd, int32_t dirflags, const char *path, size_t path_len, uint32_t oflags, uint64_t fs_rights_base, uint64_t fs_rights_inheriting, int32_t fdflags, int32_t *opened_fd);
WASI_IMPORT("path_filestat_get")  int32_t __wasi_path_filestat_get(int32_t fd, int32_t flags, const char *path, size_t path_len, void *buf);
WASI_IMPORT("path_unlink_file")   int32_t __wasi_path_unlink_file(int32_t fd, const char *path, size_t path_len);
WASI_IMPORT("path_create_directory") int32_t __wasi_path_create_directory(int32_t fd, const char *path, size_t path_len);
WASI_IMPORT("environ_get")  int32_t __wasi_environ_get(char **environ, char *environ_buf);
WASI_IMPORT("environ_sizes_get") int32_t __wasi_environ_sizes_get(size_t *count, size_t *buf_size);
WASI_IMPORT("proc_exit")   void __wasi_proc_exit(int32_t code);
WASI_IMPORT("clock_time_get") int32_t __wasi_clock_time_get(int32_t id, uint64_t precision, uint64_t *time);

// WASI types for compatibility
typedef struct { uint8_t pr_type; uint8_t padding[3]; uint32_t pr_name_len; } __wasi_prestat_t;
typedef struct { uint32_t buf; uint32_t buf_len; } __wasi_iovec_t; // WASM32 ABI: 8-byte ciovec/iovec
typedef struct {
  uint64_t st_dev; uint64_t st_ino; uint32_t st_filetype;
  uint32_t st_nlink; uint64_t st_size; uint64_t st_atim;
  uint64_t st_mtim; uint64_t st_ctim;
} __wasi_filestat_t;
typedef uint64_t __wasi_dircookie_t;

#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
/**
 * Writes bytes to standard output.
 * @param data Buffer containing the bytes to write.
 * @param len Number of bytes to write.
 */

/**
 * Writes bytes to standard error.
 * @param data Buffer containing the bytes to write.
 * @param len Number of bytes to write.
 */

/**
 * Writes a null-terminated string to standard output.
 * @param s String to write.
 */

/**
 * Writes bytes to a file descriptor.
 * @param fd File descriptor receiving the bytes.
 * @param data Buffer containing the bytes to write.
 * @param len Number of bytes to write.
 * @return Number of bytes written, or a negative error code.
 */

/**
 * Reads bytes from a file descriptor.
 * @param fd File descriptor to read from.
 * @param buf Buffer receiving the bytes.
 * @param len Capacity of the buffer.
 * @return Number of bytes read, or a negative error code.
 */

/**
 * Closes a file descriptor.
 * @param fd File descriptor to close.
 * @return Zero on success, or a negative error code.
 */

/**
 * Changes the position of a file descriptor.
 * @param fd File descriptor to seek.
 * @param offset Position adjustment.
 * @param whence Reference point for the adjustment.
 * @return New file position, or a negative error code.
 */

/**
 * Retrieves metadata for a preopened file descriptor.
 * @param fd Preopened file descriptor.
 * @param buf Buffer receiving the preopen metadata.
 * @return Zero on success, or a negative error code.
 */

/**
 * Retrieves the name of a preopened directory.
 * @param fd Preopened directory descriptor.
 * @param buf Buffer receiving the directory name.
 * @param len Capacity of the buffer.
 * @return Zero on success, or a negative error code.
 */

/**
 * Reads directory entries from a file descriptor.
 * @param fd Directory file descriptor.
 * @param buf Buffer receiving directory entries.
 * @param len Capacity of the buffer.
 * @param cookie Position from which to read entries.
 * @return Number of bytes written to the buffer, or a negative error code.
 */

/**
 * Opens a path relative to a directory descriptor.
 * @param dir_fd Directory descriptor containing the path.
 * @param path Path to open.
 * @param path_len Length of the path.
 * @param oflags File opening flags.
 * @return Opened file descriptor, or a negative error code.
 */

/**
 * Retrieves metadata for a path relative to a directory descriptor.
 * @param dir_fd Directory descriptor containing the path.
 * @param flags Path lookup flags.
 * @param path Path to inspect.
 * @param path_len Length of the path.
 * @param buf Buffer receiving the file metadata.
 * @return Zero on success, or a negative error code.
 */

/**
 * Removes a file relative to a directory descriptor.
 * @param dir_fd Directory descriptor containing the file.
 * @param path Path of the file to remove.
 * @param path_len Length of the path.
 * @return Zero on success, or a negative error code.
 */

/**
 * Creates a directory relative to a directory descriptor.
 * @param dir_fd Directory descriptor in which to create the directory.
 * @param path Directory path.
 * @param path_len Length of the path.
 * @return Zero on success, or a negative error code.
 */

/**
 * Retrieves the type of a file.
 * @param dir_fd Directory descriptor containing the file.
 * @param path File path.
 * @return File type, or a negative error code.
 */

/**
 * Retrieves the size of a file.
 * @param dir_fd Directory descriptor containing the file.
 * @param path File path.
 * @return File size, or a negative error code.
 */

/**
 * Determines whether a path exists.
 * @param dir_fd Directory descriptor containing the path.
 * @param path Path to check.
 * @return `true` if the path exists, `false` otherwise.
 */

/**
 * Retrieves the process environment.
 * @param environ Buffer receiving environment pointers.
 * @param environ_buf Buffer receiving environment strings.
 * @return Zero on success, or a negative error code.
 */

/**
 * Retrieves the number and total buffer size of environment variables.
 * @param count Receives the number of environment variables.
 * @param buf_size Receives the required buffer size.
 * @return Zero on success, or a negative error code.
 */

/**
 * Terminates the process with an exit code.
 * @param code Process exit code.
 */

/**
 * Retrieves the current clock time.
 * @param id Clock identifier.
 * @param precision Requested clock precision.
 * @return Clock time.
 */
namespace wasi {

// ── Stdout/stderr ──────────────────────────────────

inline void stdout_write(const char *data, size_t len) {
  __wasi_iovec_t iov = { (uint32_t)(uintptr_t)data, (uint32_t)len };
  size_t written = 0;
  __wasi_fd_write(1, &iov, 1, &written);
}

inline void stderr_write(const char *data, size_t len) {
  __wasi_iovec_t iov = { (uint32_t)(uintptr_t)data, (uint32_t)len };
  size_t written = 0;
  __wasi_fd_write(2, &iov, 1, &written);
}

inline void stdout_write_str(const char *s) {
  size_t n = 0;
  while (s[n]) ++n;
  stdout_write(s, n);
}

// ── Low-level I/O ──────────────────────────────────

inline int fd_write(int fd, const char *data, size_t len) {
  __wasi_iovec_t iov = { (uint32_t)(uintptr_t)data, (uint32_t)len };
  size_t written = 0;
  int err = __wasi_fd_write(fd, &iov, 1, &written);
  return err ? -err : (int)written;
}

inline int fd_read(int fd, char *buf, size_t len) {
  __wasi_iovec_t iov = { (uint32_t)(uintptr_t)buf, (uint32_t)len };
  size_t nread = 0;
  int err = __wasi_fd_read(fd, &iov, 1, &nread);
  return err ? -err : (int)nread;
}

inline int fd_close(int fd) {
  return -__wasi_fd_close(fd);
}

inline int fd_seek(int fd, int64_t offset, int whence) {
  uint64_t newoffset = 0;
  int err = __wasi_fd_seek(fd, offset, whence, &newoffset);
  return err ? -err : (int)newoffset;
}

// ── Preopen dir scanning ───────────────────────────

inline int fd_prestat_get(int fd, __wasi_prestat_t *buf) {
  return -__wasi_fd_prestat_get(fd, buf);
}

inline int fd_prestat_dir_name(int fd, char *buf, size_t len) {
  return -__wasi_fd_prestat_dir_name(fd, buf, len);
}

inline int fd_readdir(int fd, char *buf, size_t len, __wasi_dircookie_t cookie) {
  size_t nread = 0;
  int err = __wasi_fd_readdir(fd, buf, len, cookie, &nread);
  return err ? -err : (int)nread;
}

// ── Path operations ────────────────────────────────

inline int path_open(int dir_fd, const char *path, size_t path_len, int oflags) {
  uint32_t flags = 0;
  uint64_t rights_base = 0;
  if (oflags & 0x01) { rights_base |= 0x0000000000000001ULL; }  // O_READ -> rights only (WASI flag 0x01 is O_CREAT)
  if (oflags & 0x02) { rights_base |= 0x0000000000000002ULL; }  // O_WRITE -> rights only (WASI flag 0x02 is O_DIRECTORY)
  if (oflags & 0x40) { flags |= 0x01; rights_base |= 0x0000000000000004ULL; }  // O_CREAT -> WASI O_CREAT
  if (oflags & 0x200) { flags |= 0x08; }                                       // O_TRUNC -> WASI O_TRUNC
  int32_t opened_fd = -1;
  int err = __wasi_path_open(dir_fd, 0, path, path_len, flags,
                             rights_base, rights_base, 0, &opened_fd);
  return err ? -err : (int)opened_fd;
}

inline int path_filestat_get(int dir_fd, int flags, const char *path, size_t path_len, __wasi_filestat_t *buf) {
  return -__wasi_path_filestat_get(dir_fd, flags, path, path_len, buf);
}

inline int path_unlink_file(int dir_fd, const char *path, size_t path_len) {
  return -__wasi_path_unlink_file(dir_fd, path, path_len);
}

inline int path_create_directory(int dir_fd, const char *path, size_t path_len) {
  return -__wasi_path_create_directory(dir_fd, path, path_len);
}

// ── Convenience ────────────────────────────────────

inline int stat_file(int dir_fd, const char *path) {
  size_t n = 0;
  while (path[n]) ++n;
  __wasi_filestat_t st;
  int err = __wasi_path_filestat_get(dir_fd, 0, path, n, &st);
  if (err) return -err;
  return (int)st.st_filetype;
}

inline int64_t file_size(int dir_fd, const char *path) {
  size_t n = 0;
  while (path[n]) ++n;
  __wasi_filestat_t st;
  int err = __wasi_path_filestat_get(dir_fd, 0, path, n, &st);
  if (err) return -err;
  return (int64_t)st.st_size;
}

inline bool file_exists(int dir_fd, const char *path) {
  size_t n = 0;
  while (path[n]) ++n;
  __wasi_filestat_t st;
  int err = __wasi_path_filestat_get(dir_fd, 0, path, n, &st);
  return err == 0;
}

// ── Environment ────────────────────────────────────

inline int environ_get(char **environ, char *environ_buf) {
  return -__wasi_environ_get(environ, environ_buf);
}

inline int environ_sizes_get(size_t *count, size_t *buf_size) {
  return -__wasi_environ_sizes_get(count, buf_size);
}

// ── Utility ────────────────────────────────────────

inline void exit(int code) { __wasi_proc_exit(code); }

inline uint64_t clock_time(uint32_t id, uint64_t precision) {
  uint64_t t = 0;
  __wasi_clock_time_get(id, precision, &t);
  return t;
}

} // namespace wasi
#endif
