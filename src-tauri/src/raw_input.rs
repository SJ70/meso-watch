//! Captures physical keyboard input via the Windows Raw Input API
//! (RegisterRawInputDevices + RIDEV_INPUTSINK) instead of a global low-level
//! keyboard hook (SetWindowsHookEx). Anti-cheat software commonly blocks the
//! latter (it's the mechanism macro/injection tools use); Raw Input is the
//! same standard API HID peripherals and overlay tools use, so it keeps
//! working while a game window has focus. Input is only observed, never
//! swallowed - the game still receives every key.
//!
//! Runs on its own thread with a hidden window and a plain Win32 message loop.

use std::sync::{Mutex, OnceLock};

use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
pub struct ShortcutKey {
    pub code: Option<String>,
}

#[derive(Deserialize)]
pub struct ObservedShortcut {
    pub id: Value,
    pub shortcut: Option<ShortcutKey>,
}

struct Binding {
    id: Value,
    code: String,
}

static APP: OnceLock<AppHandle> = OnceLock::new();
static BINDINGS: Mutex<Vec<Binding>> = Mutex::new(Vec::new());

pub fn set_shortcuts(shortcuts: Vec<ObservedShortcut>) {
    let bindings = shortcuts
        .into_iter()
        .filter_map(|item| {
            let code = item.shortcut?.code.filter(|code| !code.is_empty())?;
            Some(Binding { id: item.id, code })
        })
        .collect();
    *BINDINGS.lock().unwrap() = bindings;
}

// Shortcuts match on the physical key alone - any modifier held at the same
// time is ignored, so a timer bound to "A" restarts even if Ctrl is also held.
fn on_key_down(code: &str) {
    let matched = BINDINGS
        .lock()
        .unwrap()
        .iter()
        .find(|binding| binding.code == code)
        .map(|binding| binding.id.clone());
    if let (Some(id), Some(app)) = (matched, APP.get()) {
        let _ = app.emit("global-restart", id);
    }
}

// Windows "Set 1" scan codes -> DOM KeyboardEvent.code, matching what the
// renderer records when the user sets a shortcut.
fn scan_to_code(make_code: u16, e0: bool) -> Option<&'static str> {
    let code = if e0 {
        match make_code {
            0x1c => "NumpadEnter",
            0x1d => "ControlRight",
            0x35 => "NumpadDivide",
            0x38 => "AltRight",
            0x47 => "Home",
            0x48 => "ArrowUp",
            0x49 => "PageUp",
            0x4b => "ArrowLeft",
            0x4d => "ArrowRight",
            0x4f => "End",
            0x50 => "ArrowDown",
            0x51 => "PageDown",
            0x52 => "Insert",
            0x53 => "Delete",
            0x5b => "MetaLeft",
            0x5c => "MetaRight",
            0x5d => "ContextMenu",
            _ => return None,
        }
    } else {
        match make_code {
            0x01 => "Escape",
            0x02 => "Digit1",
            0x03 => "Digit2",
            0x04 => "Digit3",
            0x05 => "Digit4",
            0x06 => "Digit5",
            0x07 => "Digit6",
            0x08 => "Digit7",
            0x09 => "Digit8",
            0x0a => "Digit9",
            0x0b => "Digit0",
            0x0c => "Minus",
            0x0d => "Equal",
            0x0e => "Backspace",
            0x0f => "Tab",
            0x10 => "KeyQ",
            0x11 => "KeyW",
            0x12 => "KeyE",
            0x13 => "KeyR",
            0x14 => "KeyT",
            0x15 => "KeyY",
            0x16 => "KeyU",
            0x17 => "KeyI",
            0x18 => "KeyO",
            0x19 => "KeyP",
            0x1a => "BracketLeft",
            0x1b => "BracketRight",
            0x1c => "Enter",
            0x1d => "ControlLeft",
            0x1e => "KeyA",
            0x1f => "KeyS",
            0x20 => "KeyD",
            0x21 => "KeyF",
            0x22 => "KeyG",
            0x23 => "KeyH",
            0x24 => "KeyJ",
            0x25 => "KeyK",
            0x26 => "KeyL",
            0x27 => "Semicolon",
            0x28 => "Quote",
            0x29 => "Backquote",
            0x2a => "ShiftLeft",
            0x2b => "Backslash",
            0x2c => "KeyZ",
            0x2d => "KeyX",
            0x2e => "KeyC",
            0x2f => "KeyV",
            0x30 => "KeyB",
            0x31 => "KeyN",
            0x32 => "KeyM",
            0x33 => "Comma",
            0x34 => "Period",
            0x35 => "Slash",
            0x36 => "ShiftRight",
            0x37 => "NumpadMultiply",
            0x38 => "AltLeft",
            0x39 => "Space",
            0x3a => "CapsLock",
            0x3b => "F1",
            0x3c => "F2",
            0x3d => "F3",
            0x3e => "F4",
            0x3f => "F5",
            0x40 => "F6",
            0x41 => "F7",
            0x42 => "F8",
            0x43 => "F9",
            0x44 => "F10",
            0x45 => "NumLock",
            0x46 => "ScrollLock",
            0x47 => "Numpad7",
            0x48 => "Numpad8",
            0x49 => "Numpad9",
            0x4a => "NumpadSubtract",
            0x4b => "Numpad4",
            0x4c => "Numpad5",
            0x4d => "Numpad6",
            0x4e => "NumpadAdd",
            0x4f => "Numpad1",
            0x50 => "Numpad2",
            0x51 => "Numpad3",
            0x52 => "Numpad0",
            0x53 => "NumpadDecimal",
            0x56 => "IntlBackslash",
            0x57 => "F11",
            0x58 => "F12",
            _ => return None,
        }
    };
    Some(code)
}

// Left/right variants of Ctrl/Alt/Shift are treated as the same shortcut key;
// Meta stays distinct.
fn normalize_code(code: &'static str) -> &'static str {
    match code {
        "ControlRight" => "ControlLeft",
        "ShiftRight" => "ShiftLeft",
        "AltRight" => "AltLeft",
        other => other,
    }
}

#[cfg(windows)]
mod win {
    use std::{mem, ptr};

    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::{
        GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE,
        RAWINPUTHEADER, RIDEV_INPUTSINK, RID_INPUT, RIM_TYPEKEYBOARD,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassExW,
        TranslateMessage, MSG, WM_INPUT, WNDCLASSEXW,
    };

    const RI_KEY_BREAK: u16 = 1;
    const RI_KEY_E0: u16 = 2;

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn handle_raw_input(handle: HRAWINPUT) {
        let mut raw: RAWINPUT = mem::zeroed();
        let mut size = mem::size_of::<RAWINPUT>() as u32;
        let written = GetRawInputData(
            handle,
            RID_INPUT,
            &mut raw as *mut RAWINPUT as *mut _,
            &mut size,
            mem::size_of::<RAWINPUTHEADER>() as u32,
        );
        if written == 0 || written == u32::MAX || raw.header.dwType != RIM_TYPEKEYBOARD {
            return;
        }

        let keyboard = raw.data.keyboard;
        if keyboard.Flags & RI_KEY_BREAK != 0 {
            return;
        }
        let Some(code) = super::scan_to_code(keyboard.MakeCode, keyboard.Flags & RI_KEY_E0 != 0)
        else {
            return;
        };
        super::on_key_down(super::normalize_code(code));
    }

    unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if msg == WM_INPUT {
            handle_raw_input(lparam as HRAWINPUT);
            // WM_INPUT still needs DefWindowProc so the system can clean up
            // the raw input buffer.
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    pub fn run() -> Result<(), &'static str> {
        unsafe {
            let instance = GetModuleHandleW(ptr::null());
            let class_name = wide("MesoWatchRawInputWnd");

            let class = WNDCLASSEXW {
                cbSize: mem::size_of::<WNDCLASSEXW>() as u32,
                style: 0,
                lpfnWndProc: Some(wnd_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: instance,
                hIcon: ptr::null_mut(),
                hCursor: ptr::null_mut(),
                hbrBackground: ptr::null_mut(),
                lpszMenuName: ptr::null(),
                lpszClassName: class_name.as_ptr(),
                hIconSm: ptr::null_mut(),
            };
            if RegisterClassExW(&class) == 0 {
                return Err("RegisterClassExW failed");
            }

            // A never-shown top-level window (not HWND_MESSAGE) - same as the
            // Electron build, which RIDEV_INPUTSINK is known to work with.
            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                class_name.as_ptr(),
                0,
                0,
                0,
                0,
                0,
                ptr::null_mut(),
                ptr::null_mut(),
                instance,
                ptr::null(),
            );
            if hwnd.is_null() {
                return Err("CreateWindowExW failed");
            }

            let device = RAWINPUTDEVICE {
                usUsagePage: 0x01,
                usUsage: 0x06,
                dwFlags: RIDEV_INPUTSINK,
                hwndTarget: hwnd,
            };
            if RegisterRawInputDevices(&device, 1, mem::size_of::<RAWINPUTDEVICE>() as u32) == 0 {
                return Err("RegisterRawInputDevices failed");
            }

            let mut msg: MSG = mem::zeroed();
            while GetMessageW(&mut msg, ptr::null_mut(), 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
        Ok(())
    }
}

/// Starts the capture thread. It lives as long as the process - there's
/// nothing to tear down on exit.
pub fn start(app: AppHandle) {
    let _ = APP.set(app);
    #[cfg(windows)]
    std::thread::Builder::new()
        .name("raw-input".into())
        .spawn(|| {
            if let Err(error) = win::run() {
                eprintln!("raw input capture failed: {error}");
            }
        })
        .expect("failed to spawn raw input thread");
}
