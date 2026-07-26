fn main() {
    // Tell cargo to invalidate the built crate whenever the header changes
    println!("cargo::rerun-if-changed=../../packages/types/src/rmlui-abi.h");

    // For now, bindings are hand-maintained in rmlui_bindings.rs
    // In the future, this build.rs would use bindgen:
    // let bindings = bindgen::Builder::default()
    //     .header("../../packages/types/src/rmlui-abi.h")
    //     .generate()
    //     .expect("Unable to generate bindings");
    // bindings
    //     .write_to_file("src/bindings.rs")
    //     .expect("Couldn't write bindings!");
}
