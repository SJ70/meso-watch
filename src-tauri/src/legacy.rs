//! One-time import of the Electron build's saved data (localStorage settings
//! and timers, IndexedDB custom images/sounds).
//!
//! Electron stored everything under the `file://` origin in its own Chromium
//! profile; the Tauri app runs on a different origin in a different WebView2
//! profile, so none of it is visible by default. Rather than parse Chromium's
//! LevelDB/IndexedDB formats by hand, the Electron profile's storage folders
//! are copied into a throwaway WebView2 profile and a hidden webview opens a
//! `file://` page there - Chromium itself reads the data back - and posts it
//! to the `mwlegacy` protocol below. The main window then starts on
//! legacy-import.html, which writes it into the app's own storage. The
//! Electron profile is only read during the import, then deleted once the
//! import has succeeded (`legacy_finish`).

use std::{
    fs, io,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};

use tauri::{
    http::{Request, Response, StatusCode},
    AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder,
};

pub const PROTOCOL: &str = "mwlegacy";
const EXPORT_WINDOW: &str = "legacy-export";
const MARKER_FILE: &str = "legacy-migrated";
const PROFILE_DIR: &str = "legacy-profile";
const EXPORT_PAGE: &str = "legacy-export.html";
const IMPORT_PAGE: &str = "legacy-import.html";
const STORAGE_DIRS: [&str; 3] = ["Local Storage", "IndexedDB", "WebStorage"];
const EXPORT_TIMEOUT: Duration = Duration::from_secs(15);

static FINISHED: AtomicBool = AtomicBool::new(false);
static PAYLOAD: Mutex<Option<String>> = Mutex::new(None);

/// The Electron build's userData folder (`app.getPath("userData")`).
pub fn electron_user_data_dir() -> Option<PathBuf> {
    Some(PathBuf::from(std::env::var_os("APPDATA")?).join("meso-watch"))
}

fn marker_path(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_data_dir().ok()?.join(MARKER_FILE))
}

fn profile_path(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_local_data_dir().ok()?.join(PROFILE_DIR))
}

fn needs_import(app: &AppHandle) -> bool {
    let Some(marker) = marker_path(app) else { return false };
    if marker.exists() {
        return false;
    }
    let Some(electron) = electron_user_data_dir() else { return false };
    STORAGE_DIRS[..2].iter().any(|dir| electron.join(dir).is_dir())
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else if entry.file_name() != "LOCK" {
            // LOCK is held open while the Electron app is running; the
            // copy doesn't need it.
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Builds the throwaway WebView2 profile (its user data folder keeps the
/// default profile at EBWebView/Default) and returns the export page's URL.
fn prepare_profile(app: &AppHandle) -> Result<(PathBuf, Url), String> {
    let electron = electron_user_data_dir().ok_or("no APPDATA")?;
    let profile = profile_path(app).ok_or("no app local data dir")?;
    let _ = fs::remove_dir_all(&profile);
    let default_profile = profile.join("EBWebView").join("Default");
    for dir in STORAGE_DIRS {
        let source = electron.join(dir);
        if source.is_dir() {
            copy_dir(&source, &default_profile.join(dir)).map_err(|e| format!("copy {dir}: {e}"))?;
        }
    }
    let page = profile.join(EXPORT_PAGE);
    fs::write(&page, include_str!("../legacy/legacy-export.html")).map_err(|e| e.to_string())?;
    let url = Url::from_file_path(&page).map_err(|_| "bad export page path".to_string())?;
    Ok((profile, url))
}

/// Opens the main window, first running the legacy import if the Electron
/// build left data behind that hasn't been imported yet.
pub fn start(app: &AppHandle) {
    if let Some(profile) = profile_path(app) {
        if marker_path(app).is_some_and(|marker| marker.exists()) {
            let _ = fs::remove_dir_all(profile);
        }
    }
    if !needs_import(app) {
        crate::open_main_window(app, crate::MAIN_PAGE);
        return;
    }

    let export = prepare_profile(app).and_then(|(profile, url)| {
        WebviewWindowBuilder::new(app, EXPORT_WINDOW, WebviewUrl::External(url))
            .visible(false)
            .data_directory(profile)
            .build()
            .map_err(|e| e.to_string())
    });
    if let Err(error) = export {
        eprintln!("legacy export failed to start: {error}");
        finish(app, None);
        return;
    }

    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(EXPORT_TIMEOUT);
        if !FINISHED.load(Ordering::SeqCst) {
            eprintln!("legacy export timed out");
            finish(&app, None);
        }
    });
}

/// Ends the export phase exactly once: closes the hidden webview and opens
/// the main window - on the import page if there's data to import. With no
/// data the marker is left unwritten so the next launch tries again.
fn finish(app: &AppHandle, payload: Option<String>) {
    if FINISHED.swap(true, Ordering::SeqCst) {
        return;
    }
    let page = if payload.is_some() { IMPORT_PAGE } else { crate::MAIN_PAGE };
    *PAYLOAD.lock().unwrap() = payload;
    // Window creation/destruction from inside a webview callback can
    // deadlock on Windows; hand it to a fresh thread.
    let app = app.clone();
    // Main window first: destroying the last open window would quit the app.
    std::thread::spawn(move || {
        crate::open_main_window(&app, page);
        if let Some(window) = app.get_webview_window(EXPORT_WINDOW) {
            let _ = window.destroy();
        }
    });
}

/// Receives the export page's POST. Answers with permissive CORS since the
/// caller is a `file://` page (origin "null").
pub fn handle_protocol(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let respond = |status: StatusCode| {
        Response::builder()
            .status(status)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Headers", "*")
            .body(Vec::new())
            .unwrap()
    };
    if request.method() == "OPTIONS" {
        return respond(StatusCode::NO_CONTENT);
    }
    let body = String::from_utf8_lossy(request.body()).into_owned();
    match request.uri().path() {
        "/export" => {
            finish(app, Some(body));
            respond(StatusCode::OK)
        }
        "/error" => {
            eprintln!("legacy export failed: {body}");
            finish(app, None);
            respond(StatusCode::OK)
        }
        _ => respond(StatusCode::NOT_FOUND),
    }
}

/// Hands the exported data to legacy-import.html (once).
#[tauri::command]
pub fn legacy_take() -> Option<String> {
    PAYLOAD.lock().unwrap().take()
}

/// Called by legacy-import.html after it has written everything: never
/// import again, and drop the throwaway profile.
#[tauri::command]
pub fn legacy_finish(app: AppHandle) -> Result<(), String> {
    let marker = marker_path(&app).ok_or("no app data dir")?;
    if let Some(parent) = marker.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&marker, "").map_err(|e| e.to_string())?;
    // The data now lives in this app's own storage, so the Electron
    // profile (settings plus ~15 MB of Chromium caches and spellcheck
    // dictionaries) is no longer needed. Best effort: anything still
    // locked is simply left behind.
    if let Some(electron) = electron_user_data_dir() {
        let _ = fs::remove_dir_all(electron);
    }
    if let Some(profile) = profile_path(&app) {
        // May still be locked by the just-closed export webview's browser
        // process; start() retries on the next launch.
        let _ = fs::remove_dir_all(profile);
    }
    Ok(())
}
