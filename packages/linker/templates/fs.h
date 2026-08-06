#pragma once
// FS API — high-level wrappers over wasi:: (-nostdlib compatible)

#include "wasi.h"
#include <stddef.h>
#include <stdint.h>

/**
 * Resolves a path against a preopened directory.
 * @param path Path to resolve.
 * @param out_dir_fd Receives the matching directory descriptor.
 * @param out_rel_offset Receives the offset of the path relative to that directory.
 * @return 0 on success, or -1 if no preopened directory matches the path.
 */
namespace fs {

// ── Internal: resolve path to (dirFd, relative) ─────

inline int resolve_path(const char* path, int* out_dir_fd, size_t* out_rel_offset) {
    // Scan preopened fds 3-63
    size_t path_len = 0;
    while (path[path_len]) ++path_len;

    for (int fd = 3; fd <= 63; fd++) {
        // Get prestat to find dir name length
        __wasi_prestat_t prestat;
        int err = __wasi_fd_prestat_get(fd, &prestat);
        if (err) continue;

        // Get dir name
        char* dirname = (char*)__builtin_alloca(prestat.pr_name_len + 1);
        err = __wasi_fd_prestat_dir_name(fd, dirname, prestat.pr_name_len);
        if (err) continue;

        size_t dir_len = prestat.pr_name_len;
        // Trim trailing slash from dirname
        while (dir_len > 0 && dirname[dir_len - 1] == '/') --dir_len;

        // Check if path starts with dirname + '/'
        if (path_len > dir_len && path[dir_len] == '/') {
            bool match = true;
            for (size_t i = 0; i < dir_len; i++) {
                if (path[i] != dirname[i]) { match = false; break; }
            }
            if (match) {
                *out_dir_fd = fd;
                *out_rel_offset = dir_len + 1;  // skip '/' separator
                return 0;
            }
        } else if (path_len == dir_len) {
            // Exact match — path IS the mount point (e.g. "/mnt" = root)
            bool match = true;
            for (size_t i = 0; i < dir_len; i++) {
                if (path[i] != dirname[i]) { match = false; break; }
            }
            if (match) {
                *out_dir_fd = fd;
                *out_rel_offset = path_len;  // relative part is empty
                return 0;
            }
        }
    }

    return -1;  // no match
}

// ── readFile ──────────────────────────────────────

inline int readFile(const char* path, char* buf, int len) {
    int dir_fd = -1;
    size_t rel_offset = 0;
    int ret = resolve_path(path, &dir_fd, &rel_offset);
    if (ret < 0) return ret;

    const char* rel = path + rel_offset;
    size_t rel_len = 0;
    while (rel[rel_len]) ++rel_len;

    int opened_fd = wasi::path_open(dir_fd, rel, rel_len, 0x01);  // O_READ
    if (opened_fd < 0) return opened_fd;

    int n = wasi::fd_read(opened_fd, buf, len);
    wasi::fd_close(opened_fd);
    return n;
}

// ── writeFile ─────────────────────────────────────

inline int writeFile(const char* path, const char* data, int len) {
    int dir_fd = -1;
    size_t rel_offset = 0;
    int ret = resolve_path(path, &dir_fd, &rel_offset);
    if (ret < 0) return ret;

    const char* rel = path + rel_offset;
    size_t rel_len = 0;
    while (rel[rel_len]) ++rel_len;

    int opened_fd = wasi::path_open(dir_fd, rel, rel_len, 0x02 | 0x40 | 0x200);  // O_WRITE | O_CREAT | O_TRUNC
    if (opened_fd < 0) return opened_fd;

    int n = wasi::fd_write(opened_fd, data, len);
    wasi::fd_close(opened_fd);
    return n;
}

// ── exists ────────────────────────────────────────

inline bool exists(const char* path) {
    int dir_fd = -1;
    size_t rel_offset = 0;
    int ret = resolve_path(path, &dir_fd, &rel_offset);
    if (ret < 0) return false;

    const char* rel = path + rel_offset;
    size_t rel_len = 0;
    while (rel[rel_len]) ++rel_len;

    return wasi::file_exists(dir_fd, rel);
}

// ── unlink ────────────────────────────────────────

inline int unlink(const char* path) {
    int dir_fd = -1;
    size_t rel_offset = 0;
    int ret = resolve_path(path, &dir_fd, &rel_offset);
    if (ret < 0) return ret;

    const char* rel = path + rel_offset;
    size_t rel_len = 0;
    while (rel[rel_len]) ++rel_len;

    return wasi::path_unlink_file(dir_fd, rel, rel_len);
}

// ── mkdir ─────────────────────────────────────────

inline int mkdir(const char* path) {
    int dir_fd = -1;
    size_t rel_offset = 0;
    int ret = resolve_path(path, &dir_fd, &rel_offset);
    if (ret < 0) return ret;

    const char* rel = path + rel_offset;
    size_t rel_len = 0;
    while (rel[rel_len]) ++rel_len;

    return wasi::path_create_directory(dir_fd, rel, rel_len);
}

} // namespace fs
