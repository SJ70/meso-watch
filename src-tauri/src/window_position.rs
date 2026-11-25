//! Remembers where the overlay was last placed and reopens it there.

use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, Runtime};

use crate::legacy;

const FILE_NAME: &str = "window-position.json";

#[derive(Serialize, Deserialize)]
struct Saved {
    x: f64,
    y: f64,
}

fn file_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    Some(app.path().app_config_dir().ok()?.join(FILE_NAME))
}

fn read(path: &PathBuf) -> Option<Saved> {
    let saved: Saved = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;
    (saved.x.is_finite() && saved.y.is_finite()).then_some(saved)
}

fn on_any_monitor(monitors: &[Monitor], x: i32, y: i32) -> bool {
    monitors.iter().any(|monitor| {
        let pos = monitor.position();
        let size = monitor.size();
        x >= pos.x && x < pos.x + size.width as i32 && y >= pos.y && y < pos.y + size.height as i32
    })
}

/// Physical position to open the window at, or None to center it. A position
/// that's no longer on any connected display (e.g. a monitor was unplugged
/// since the last run) is discarded.
pub fn load<R: Runtime>(app: &AppHandle<R>) -> Option<PhysicalPosition<i32>> {
    let monitors = app.available_monitors().ok()?;
    let position = match file_path(app).as_ref().and_then(read) {
        Some(saved) => PhysicalPosition::new(saved.x as i32, saved.y as i32),
        // First run after the Electron build: its file stored DIPs, so scale
        // by the primary monitor's factor.
        None => {
            let saved = read(&legacy::electron_user_data_dir()?.join(FILE_NAME))?;
            let scale = app.primary_monitor().ok().flatten().map_or(1.0, |m| m.scale_factor());
            PhysicalPosition::new((saved.x * scale) as i32, (saved.y * scale) as i32)
        }
    };
    on_any_monitor(&monitors, position.x, position.y).then_some(position)
}

pub fn save<R: Runtime>(app: &AppHandle<R>, position: PhysicalPosition<i32>) {
    // Windows parks minimized windows at (-32000, -32000).
    if position.x <= -32000 || position.y <= -32000 {
        return;
    }
    let Some(path) = file_path(app) else { return };
    let saved = Saved { x: position.x as f64, y: position.y as f64 };
    let result = path
        .parent()
        .map_or(Ok(()), fs::create_dir_all)
        .and_then(|_| fs::write(&path, serde_json::to_string(&saved).unwrap()));
    if let Err(error) = result {
        eprintln!("failed to save window position: {error}");
    }
}
