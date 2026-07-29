// Rust WASM example using high-level Console + FS API
#![no_std]

extern crate alloc;

use core::alloc::{GlobalAlloc, Layout};
use core::cell::UnsafeCell;

/// Bump allocator for no_std WASM (no dealloc, ok for small examples).
struct BumpAlloc(UnsafeCell<[u8; 131072]>, UnsafeCell<usize>);
unsafe impl Sync for BumpAlloc {}
unsafe impl GlobalAlloc for BumpAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let size = layout.size();
        let align = layout.align();
        let ptr = (*self.0.get()).as_mut_ptr();
        let off = *self.1.get();
        let aligned = (off + align - 1) & !(align - 1);
        if aligned + size > 131072 { return core::ptr::null_mut(); }
        *self.1.get() = aligned + size;
        ptr.add(aligned)
    }
    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
}
#[global_allocator]
static ALLOC: BumpAlloc = BumpAlloc(UnsafeCell::new([0u8; 131072]), UnsafeCell::new(0));

mod wasi;
mod console;
mod fs;
use console::*;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub extern "C" fn _start() {
    let _ = log("Opening file...");
    let data = fs::read_file(b"/mnt/data/greeting.txt");
    if let Ok(content) = &data {
        let _ = wasi::stdout_write(content);
        let _ = wasi::stdout_write(b"\n");
    } else {
        let _ = log("(no mounted dir)");
    }
}
