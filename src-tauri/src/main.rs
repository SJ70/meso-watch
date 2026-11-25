// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod legacy;
mod raw_input;
mod window_position;

use tauri::{AppHandle, LogicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub const MAIN_PAGE: &str = "src/index.html";
const MAIN_WINDOW: &str = "main";

// Keeps timers firing on schedule while the overlay is minimized/hidden -
// Chromium would otherwise throttle them to 1s (or 1min after a while). The
// first flag repeats WebView2's defaults that Tauri normally passes, since
// setting additional args replaces them.
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
    --disable-background-timer-throttling \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows";

pub fn open_main_window(app: &AppHandle, page: &str) {
    let saved_position = window_position::load(app);

    let mut builder = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App(page.into()))
        .title("메소워치")
        .inner_size(800.0, 600.0)
        .resizable(false)
        .maximizable(false)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)
        .additional_browser_args(BROWSER_ARGS);
    if saved_position.is_none() {
        builder = builder.center();
    } else {
        // Positioned in physical pixels after creation (the builder only
        // takes logical coordinates, which are ambiguous across mixed-DPI
        // monitors) - stay hidden until then so it never flashes elsewhere.
        builder = builder.visible(false);
    }

    let window = match builder.build() {
        Ok(window) => window,
        Err(error) => {
            eprintln!("failed to create main window: {error}");
            app.exit(1);
            return;
        }
    };
    if let Some(position) = saved_position {
        let _ = window.set_position(position);
        let _ = window.show();
    }

    let handle = app.clone();
    let events_window = window.clone();
    window.on_window_event(move |event| match event {
        // Something else grabbing topmost can push the overlay under it.
        WindowEvent::Focused(false) => {
            let _ = events_window.set_always_on_top(true);
        }
        WindowEvent::Moved(position) => window_position::save(&handle, *position),
        _ => {}
    });
}

#[tauri::command]
fn set_global_shortcuts(shortcuts: Vec<raw_input::ObservedShortcut>) -> bool {
    raw_input::set_shortcuts(shortcuts);
    true
}

// Width and height always arrive together in one call (see
// src/js/windowSize.js), so a width-only or height-only update can never
// clobber the other dimension with a stale value. Values are CSS px (DIPs).
#[tauri::command]
fn resize_window(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let current = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or("no monitor")?;
    let work_area = monitor.work_area().size.to_logical::<f64>(scale);

    let width = width.round().max(200.0).min(work_area.width).round();
    let height = height.round().max(120.0).min(work_area.height - 40.0).round();
    if width == current.width.round() && height == current.height.round() {
        return Ok(());
    }
    // Keeps x/y fixed and grows right/down, even past the bottom/right edge
    // of the screen. The 1px overshoot forces a repaint of the transparent
    // surface at the new size.
    window.set_size(LogicalSize::new(width, height + 1.0)).map_err(|e| e.to_string())?;
    window.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol(legacy::PROTOCOL, |ctx, request| {
            legacy::handle_protocol(ctx.app_handle(), request)
        })
        .invoke_handler(tauri::generate_handler![
            set_global_shortcuts,
            resize_window,
            legacy::legacy_take,
            legacy::legacy_finish,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            raw_input::start(handle.clone());
            legacy::start(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running meso-watch");
}
