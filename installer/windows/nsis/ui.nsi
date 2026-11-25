; NSIS installer for the desktop app (rayohx-ui). Windows only; see common.nsh for the options.
;
;   makensis /DAPP_NAME="RayoHX" /DAPP_VERSION=0.1.0 /DSOURCE_DIR=..\..\build\installer\rayohx-ui \
;            /DOUT_FILE=..\..\dist\rayohx-0.1.0.setup.exe installer\nsis\ui.nsi
; scripts/build_installer.py does this from the project's own metadata.

; Stable id of this product: keep it for the life of the project, so a newer setup replaces an
; older install. Generate a new one for your project (python -c "import uuid; print(uuid.uuid4())").
!define GUID "{514B8614-1A56-42CD-A8D1-A960655084D8}"
!define MAIN_EXE "rayohx-ui.exe"
!define INSTALL_SUBDIR "UI"
!define HAS_DESKTOP

!include "common.nsh"
