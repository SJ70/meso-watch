; Upgrading from the Electron build: silently remove its per-user install
; (electron-builder's one-click installer put it in
; %LOCALAPPDATA%\Programs\meso-watch) so users don't end up with two copies.
; Runs before install because both builds create shortcuts with the same
; name - uninstalling afterwards would delete the new ones too.
; The old uninstaller leaves %APPDATA%\meso-watch alone; the app imports
; settings/timers from there on first launch (src-tauri/src/legacy.rs).

!macro NSIS_HOOK_PREINSTALL
  StrCpy $R8 "$LOCALAPPDATA\Programs\meso-watch"
  IfFileExists "$R8\meso-watch.exe" 0 meso_watch_no_legacy
    ; Close the running Electron app first or its files can't be removed.
    nsExec::Exec 'taskkill /f /im meso-watch.exe'
    Pop $R9
    FindFirst $R7 $R9 "$R8\Uninstall *.exe"
    FindClose $R7
    StrCmp $R9 "" meso_watch_no_legacy
      ; _?= runs the uninstaller in place so ExecWait actually waits for it.
      ExecWait '"$R8\$R9" /S /currentuser _?=$R8'
      Delete "$R8\$R9"
      RMDir "$R8"
  meso_watch_no_legacy:
!macroend
