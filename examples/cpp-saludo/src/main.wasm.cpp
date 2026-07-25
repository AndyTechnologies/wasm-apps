// Minimal C++ WASM example using WASI fd_write (works with -nostdlib)

struct __attribute__((packed)) iovec {
    const void* buf;
    int buf_len;
};

__attribute__((import_module("wasi_snapshot_preview1"), import_name("fd_write")))
int fd_write(int fd, const struct iovec* iovs, int iovs_len, int* nwritten);

extern "C" int _start() {
    const char* msg = "Hola desde C++ WASM!\n";
    struct iovec iov = { msg, 21 };
    int nwritten;
    fd_write(1, &iov, 1, &nwritten);
    return 0;
}
