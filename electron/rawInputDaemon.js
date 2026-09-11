// Runs on its own worker thread. Captures physical keyboard input via the Windows
// Raw Input API (RegisterRawInputDevices + RIDEV_INPUTSINK) instead of a global
// low-level keyboard hook (SetWindowsHookEx). Anti-cheat software commonly blocks
// the latter (it's the mechanism macro/injection tools use); Raw Input is the same
// standard API HID peripherals and overlay tools use, so it keeps working while a
// game window has focus.
const { parentPort } = require("node:worker_threads");
const koffi = require("koffi");

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

const WNDPROC = koffi.proto("int64 WndProc(void *hwnd, uint32 msg, void *wParam, void *lParam)");

const MSG = koffi.struct("MSG", {
  hwnd: "void *",
  message: "uint32",
  wParam: "void *",
  lParam: "void *",
  time: "uint32",
  pt: koffi.struct("POINT", { x: "int32", y: "int32" }),
});

const WNDCLASSEXW = koffi.struct("WNDCLASSEXW", {
  cbSize: "uint32",
  style: "uint32",
  lpfnWndProc: koffi.pointer(WNDPROC),
  cbClsExtra: "int32",
  cbWndExtra: "int32",
  hInstance: "void *",
  hIcon: "void *",
  hCursor: "void *",
  hbrBackground: "void *",
  lpszMenuName: "str16",
  lpszClassName: "str16",
  hIconSm: "void *",
});

const RAWINPUTDEVICE = koffi.struct("RAWINPUTDEVICE", {
  usUsagePage: "uint16",
  usUsage: "uint16",
  dwFlags: "uint32",
  hwndTarget: "void *",
});

const GetModuleHandleW = kernel32.func("void * __stdcall GetModuleHandleW(str16 lpModuleName)");
const GetCurrentThreadId = kernel32.func("uint32 __stdcall GetCurrentThreadId()");
const RegisterClassExW = user32.func("uint16 __stdcall RegisterClassExW(const WNDCLASSEXW *lpwcx)");
const CreateWindowExW = user32.func(
  "void * __stdcall CreateWindowExW(uint32 dwExStyle, str16 lpClassName, str16 lpWindowName, uint32 dwStyle, int32 x, int32 y, int32 w, int32 h, void *hWndParent, void *hMenu, void *hInstance, void *lpParam)"
);
const DefWindowProcW = user32.func("int64 __stdcall DefWindowProcW(void *hwnd, uint32 msg, void *wParam, void *lParam)");
const RegisterRawInputDevices = user32.func(
  "bool __stdcall RegisterRawInputDevices(const RAWINPUTDEVICE *pRawInputDevices, uint32 uiNumDevices, uint32 cbSize)"
);
const GetRawInputData = user32.func(
  "uint32 __stdcall GetRawInputData(void *hRawInput, uint32 uiCommand, _Out_ uint8_t *pData, _Inout_ uint32 *pcbSize, uint32 cbSizeHeader)"
);
const GetMessageW = user32.func("int32 __stdcall GetMessageW(_Out_ MSG *lpMsg, void *hWnd, uint32 wMsgFilterMin, uint32 wMsgFilterMax)");
const TranslateMessage = user32.func("bool __stdcall TranslateMessage(const MSG *lpMsg)");
const DispatchMessageW = user32.func("int64 __stdcall DispatchMessageW(const MSG *lpMsg)");
const PostQuitMessage = user32.func("void __stdcall PostQuitMessage(int32 nExitCode)");
const DestroyWindow = user32.func("bool __stdcall DestroyWindow(void *hWnd)");

const WM_DESTROY = 0x0002;
const WM_INPUT = 0x00ff;
const RID_INPUT = 0x10000003;
const RIM_TYPEKEYBOARD = 1;
const RIDEV_INPUTSINK = 0x00000100;
const RAWINPUTHEADER_SIZE = 24; // sizeof(RAWINPUTHEADER) on 64-bit Windows

// Windows "Set 1" scan codes -> DOM KeyboardEvent.code, matching what the renderer
// records when the user sets a shortcut (see src/index.html keydown handler).
const SCAN_TO_CODE = {
  0x01: "Escape", 0x02: "Digit1", 0x03: "Digit2", 0x04: "Digit3", 0x05: "Digit4",
  0x06: "Digit5", 0x07: "Digit6", 0x08: "Digit7", 0x09: "Digit8", 0x0a: "Digit9",
  0x0b: "Digit0", 0x0c: "Minus", 0x0d: "Equal", 0x0e: "Backspace", 0x0f: "Tab",
  0x10: "KeyQ", 0x11: "KeyW", 0x12: "KeyE", 0x13: "KeyR", 0x14: "KeyT",
  0x15: "KeyY", 0x16: "KeyU", 0x17: "KeyI", 0x18: "KeyO", 0x19: "KeyP",
  0x1a: "BracketLeft", 0x1b: "BracketRight", 0x1c: "Enter", 0x1d: "ControlLeft",
  0x1e: "KeyA", 0x1f: "KeyS", 0x20: "KeyD", 0x21: "KeyF", 0x22: "KeyG",
  0x23: "KeyH", 0x24: "KeyJ", 0x25: "KeyK", 0x26: "KeyL", 0x27: "Semicolon",
  0x28: "Quote", 0x29: "Backquote", 0x2a: "ShiftLeft", 0x2b: "Backslash",
  0x2c: "KeyZ", 0x2d: "KeyX", 0x2e: "KeyC", 0x2f: "KeyV", 0x30: "KeyB",
  0x31: "KeyN", 0x32: "KeyM", 0x33: "Comma", 0x34: "Period", 0x35: "Slash",
  0x36: "ShiftRight", 0x37: "NumpadMultiply", 0x38: "AltLeft", 0x39: "Space",
  0x3a: "CapsLock", 0x3b: "F1", 0x3c: "F2", 0x3d: "F3", 0x3e: "F4", 0x3f: "F5",
  0x40: "F6", 0x41: "F7", 0x42: "F8", 0x43: "F9", 0x44: "F10", 0x45: "NumLock",
  0x46: "ScrollLock", 0x47: "Numpad7", 0x48: "Numpad8", 0x49: "Numpad9",
  0x4a: "NumpadSubtract", 0x4b: "Numpad4", 0x4c: "Numpad5", 0x4d: "Numpad6",
  0x4e: "NumpadAdd", 0x4f: "Numpad1", 0x50: "Numpad2", 0x51: "Numpad3",
  0x52: "Numpad0", 0x53: "NumpadDecimal", 0x56: "IntlBackslash", 0x57: "F11",
  0x58: "F12",
};
const SCAN_TO_CODE_E0 = {
  0x1c: "NumpadEnter", 0x1d: "ControlRight", 0x35: "NumpadDivide", 0x38: "AltRight",
  0x47: "Home", 0x48: "ArrowUp", 0x49: "PageUp", 0x4b: "ArrowLeft",
  0x4d: "ArrowRight", 0x4f: "End", 0x50: "ArrowDown", 0x51: "PageDown",
  0x52: "Insert", 0x53: "Delete", 0x5b: "MetaLeft", 0x5c: "MetaRight", 0x5d: "ContextMenu",
};

const MODIFIER_FIELD_BY_CODE = {
  ControlLeft: "ctrlKey", ControlRight: "ctrlKey",
  ShiftLeft: "shiftKey", ShiftRight: "shiftKey",
  AltLeft: "altKey", AltRight: "altKey",
  MetaLeft: "metaKey", MetaRight: "metaKey",
};

const modifierState = { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };

function handleRawInput(hRawInput) {
  const sizeBuf = [0];
  GetRawInputData(hRawInput, RID_INPUT, null, sizeBuf, RAWINPUTHEADER_SIZE);
  if (sizeBuf[0] <= 0) return;

  const buffer = Buffer.allocUnsafe(sizeBuf[0]);
  const written = GetRawInputData(hRawInput, RID_INPUT, buffer, sizeBuf, RAWINPUTHEADER_SIZE);
  if (written <= 0 || written === 0xffffffff) return;
  if (buffer.readUInt32LE(0) !== RIM_TYPEKEYBOARD) return;

  const makeCode = buffer.readUInt16LE(24);
  const flags = buffer.readUInt16LE(26);
  const vKey = buffer.readUInt16LE(30);
  if (vKey === 0xff) return; // "fake key" per MSDN, part of an escaped sequence

  const isBreak = (flags & 1) === 1;
  const isE0 = (flags & 2) === 2;
  const code = (isE0 ? SCAN_TO_CODE_E0 : SCAN_TO_CODE)[makeCode];
  if (!code) return;

  const modifierField = MODIFIER_FIELD_BY_CODE[code];
  if (modifierField) modifierState[modifierField] = !isBreak;

  if (isBreak) return;
  parentPort.postMessage({
    type: "keydown",
    code,
    ctrlKey: modifierState.ctrlKey,
    altKey: modifierState.altKey,
    shiftKey: modifierState.shiftKey,
    metaKey: modifierState.metaKey,
  });
}

const wndProc = koffi.register((hwnd, msg, wParam, lParam) => {
  if (msg === WM_INPUT) {
    handleRawInput(lParam);
    return 0;
  }
  if (msg === WM_DESTROY) {
    PostQuitMessage(0);
    return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}, koffi.pointer(WNDPROC));

const hInstance = GetModuleHandleW(null);
const className = "MesoWatchRawInputWnd";

const registered = RegisterClassExW({
  cbSize: koffi.sizeof(WNDCLASSEXW),
  style: 0,
  lpfnWndProc: wndProc,
  cbClsExtra: 0,
  cbWndExtra: 0,
  hInstance,
  hIcon: null,
  hCursor: null,
  hbrBackground: null,
  lpszMenuName: null,
  lpszClassName: className,
  hIconSm: null,
});
if (!registered) throw new Error("RegisterClassExW failed");

const hwnd = CreateWindowExW(0, className, className, 0, 0, 0, 0, 0, null, null, hInstance, null);
if (!hwnd) throw new Error("CreateWindowExW failed");

const rawInputRegistered = RegisterRawInputDevices(
  [{ usUsagePage: 0x01, usUsage: 0x06, dwFlags: RIDEV_INPUTSINK, hwndTarget: hwnd }],
  1,
  koffi.sizeof(RAWINPUTDEVICE)
);
if (!rawInputRegistered) throw new Error("RegisterRawInputDevices failed");

parentPort.postMessage({ type: "started", threadId: GetCurrentThreadId() });

parentPort.on("message", (message) => {
  if (message?.type === "stop") DestroyWindow(hwnd);
});

const msg = {};
while (GetMessageW(msg, null, 0, 0) > 0) {
  TranslateMessage(msg);
  DispatchMessageW(msg);
}

koffi.unregister(wndProc);
process.exit(0);
