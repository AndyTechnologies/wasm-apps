#pragma once
#include "wasi.h"
#include <stddef.h>
#include <stdint.h>

namespace fs {

inline int resolve_path(const char* path, int* out_dir_fd, size_t* out_rel_offset) {
    size_t path_len = 0;
    while (path[path_len]) ++path_len;
    for (int fd = 3; fd <= 63; fd++) {
        __wasi_prestat_t prestat;
        int err = __wasi_fd_prestat_get(fd, &prestat);
        if (err) continue;
        char* dirname = (char*)__builtin_alloca(prestat.pr_name_len + 1);
        err = __wasi_fd_prestat_dir_name(fd, dirname, prestat.pr_name_len);
        if (err) continue;
        size_t dir_len = prestat.pr_name_len;
        while (dir_len > 0 && dirname[dir_len - 1] == '/') --dir_len;
        if (path_len > dir_len && path[dir_len] == '/') {
            bool match = true;
            for (size_t i = 0; i < dir_len; i++) { if (path[i] != dirname[i]) { match = false; break; } }
            if (match) { *out_dir_fd = fd; *out_rel_offset = dir_len + 1; return 0; }
        } else if (path_len == dir_len) {
            bool match = true;
            for (size_t i = 0; i < dir_len; i++) { if (path[i] != dirname[i]) { match = false; break; } }
            if (match) { *out_dir_fd = fd; *out_rel_offset = path_len; return 0; }
        }
    }
    return -1;
}

inline int readFile(const char* path, char* buf, int len) {
    int dir_fd = -1; size_t rel_offset = 0;
    if (resolve_path(path, &dir_fd, &rel_offset) < 0) return -1;
    const char* rel = path + rel_offset; size_t rel_len = 0; while (rel[rel_len]) ++rel_len;
    int fd = wasi::path_open(dir_fd, rel, rel_len, 0x01);
    if (fd < 0) return fd;
    int n = wasi::fd_read(fd, buf, len);
    wasi::fd_close(fd);
    return n;
}

inline int writeFile(const char* path, const char* data, int len) {
    int dir_fd = -1; size_t rel_offset = 0;
    if (resolve_path(path, &dir_fd, &rel_offset) < 0) return -1;
    const char* rel = path + rel_offset; size_t rel_len = 0; while (rel[rel_len]) ++rel_len;
    int fd = wasi::path_open(dir_fd, rel, rel_len, 0x02 | 0x40 | 0x200);
    if (fd < 0) return fd;
    int n = wasi::fd_write(fd, data, len);
    wasi::fd_close(fd);
    return n;
}

inline bool exists(const char* path) {
    int dir_fd = -1; size_t rel_offset = 0;
    if (resolve_path(path, &dir_fd, &rel_offset) < 0) return false;
    const char* rel = path + rel_offset; size_t rel_len = 0; while (rel[rel_len]) ++rel_len;
    return wasi::file_exists(dir_fd, rel);
}

inline int unlink(const char* path) {
    int dir_fd = -1; size_t rel_offset = 0;
    if (resolve_path(path, &dir_fd, &rel_offset) < 0) return -1;
    const char* rel = path + rel_offset; size_t rel_len = 0; while (rel[rel_len]) ++rel_len;
    return wasi::path_unlink_file(dir_fd, rel, rel_len);
}

inline int mkdir(const char* path) {
    int dir_fd = -1; size_t rel_offset = 0;
    if (resolve_path(path, &dir_fd, &rel_offset) < 0) return -1;
    const char* rel = path + rel_offset; size_t rel_len = 0; while (rel[rel_len]) ++rel_len;
    return wasi::path_create_directory(dir_fd, rel, rel_len);
}

} // namespace fs
