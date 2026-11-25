fn main() {
    // Release builds run elevated, like the Electron build did
    // (requestedExecutionLevel: requireAdministrator): MapleStory runs as
    // admin, and Windows (UIPI) only delivers its keyboard input to processes
    // at the same integrity level. Debug builds stay asInvoker so `tauri dev`
    // can launch them from a normal terminal.
    let manifest = if std::env::var("PROFILE").as_deref() == Ok("release") {
        include_str!("windows/app-admin.manifest")
    } else {
        include_str!("windows/app.manifest")
    };
    println!("cargo:rerun-if-changed=windows");
    println!("cargo:rerun-if-env-changed=PROFILE");
    let windows = tauri_build::WindowsAttributes::new().app_manifest(manifest);
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri-build");
}
