; NSIS installer for RayoHX Desktop (rayohxd.exe), built by scripts/build.py into
; rayohx-desktop-<version>-windows-x64-setup.exe. Windows only.
;
; The behavior is in common.nsh (pages, per-user or all-users install, silent use, uninstaller).
; This file holds only what is specific to the desktop app; everything else (GUID, APP_NAME,
; APP_VERSION, STAGE_DIR, UI_EXE, INSTALL_DIR, ...) is passed with /D by scripts/build.py, see the
; list in common.nsh.

; The app keeps its settings and downloads list here; the uninstaller asks before removing it.
!define USER_DATA_DIR "$LOCALAPPDATA\ColdSoft Technologies\RayoHX"

!include "${__FILEDIR__}\common.nsh"
