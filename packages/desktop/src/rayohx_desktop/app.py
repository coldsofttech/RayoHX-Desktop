"""Wire Cornea Shell to ``rayohx_api`` and ``rayohx``. It holds no business logic.

Cornea serves the built frontend, gates every mounted router behind its session cookie and
registers the native actions. It never prints or exits; the CLI shows errors and picks exit codes.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

from rayohx import __version__

if TYPE_CHECKING:
    from collections.abc import Callable

    from cornea import Shell
    from fastapi import APIRouter

PACKAGE_DIR = Path(__file__).parent
UI_DIR = PACKAGE_DIR / "ui"
# The compiled build ships the built front end in assets/ beside the binary; a source checkout has
# it in ui/dist.
ASSETS_DIR = PACKAGE_DIR / "assets"
ASSETS_PATH = "assets" if ASSETS_DIR.is_dir() else "ui/dist"
DEV_HOST = "localhost"
DEV_PORT = 5173
APP_ID = "com.rayohx.app"
TITLE = "RayoHX"
VERSION = __version__
# Window and taskbar icon: public/icon.png is copied into dist by the build.
ICON = PACKAGE_DIR / ASSETS_PATH / "icon.png"
LOADING_ICON = PACKAGE_DIR / ASSETS_PATH / "loading.png"
TAGLINE = "Fast, private HLS downloads"
LOADING_SECONDS = 5.0


class UiUnavailableError(RuntimeError):
    """Raised when the window cannot be used on this system."""


def api_router() -> APIRouter:
    """Return the ``rayohx_api`` routes as Cornea mounts them: ``/api/v1/...``.

    Cornea adds the ``/api`` prefix itself and its session gate has already authenticated the
    request, so the standalone API key check is switched off for this process.
    """
    from fastapi import APIRouter

    from rayohx_api.config import AuthMode, get_settings
    from rayohx_api.routers import v1

    os.environ["RAYOHX_API_AUTH_MODE"] = AuthMode.NONE
    # The only client is the person at this window, so files on this machine may be named.
    os.environ["RAYOHX_API_ALLOW_LOCAL_PATHS"] = "true"
    get_settings.cache_clear()
    router = APIRouter(prefix="/v1")
    router.include_router(v1.router)
    return router


def dev_port() -> int:
    """Return ``DEV_PORT`` when it is free, otherwise a free port chosen by the system."""
    import socket

    for port in (DEV_PORT, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((DEV_HOST, port))
            except OSError:
                continue
            return int(sock.getsockname()[1])
    raise UiUnavailableError("No free port was found for the dev server.")


def app_info() -> dict[str, str]:
    """Native action ``app_info``: what the page may ask the app about itself."""
    return {"name": TITLE, "version": VERSION}


def open_downloads() -> dict[str, bool]:
    """Native action ``open_downloads``: show the download folder in Explorer.

    The page names no path, so it can only ever open the folder downloads are saved in.
    """
    import subprocess

    from rayohx_api.routers.v1.deps import manager

    folder = manager().directory
    folder.mkdir(parents=True, exist_ok=True)
    subprocess.Popen(["explorer", str(folder)])  # noqa: S603, S607 - a fixed program, our own folder
    return {"opened": True}


def build_shell(*, dev: bool = False, window: bool = True) -> Shell:
    """Build the Cornea shell.

    Args:
        dev: Start Vite (``npm run dev``) and show it through Cornea for hot reload.
        window: Open a native window. ``False`` only serves, so a browser can be used.

    Raises:
        UiUnavailableError: If the UI needs Windows, or Cornea is not installed.
    """
    if sys.platform != "win32":
        raise UiUnavailableError("The UI needs Windows. The CLI and API work on every system.")
    try:
        from cornea import DEV_CSP, App, Loading, Process, Security, Shell, Static, Window
    except ImportError as exc:
        raise UiUnavailableError("The UI needs the 'cornea-shell' package.") from exc

    source: Any
    # Fluent writes its theme variables into a <style> tag, which style-src 'self' blocks.
    csp = Security().csp.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
    security = Security(csp=csp)
    if dev:
        port = dev_port()
        source = Process(
            f"npm run dev -- --port {port} --strictPort",
            url=f"http://{DEV_HOST}:{port}",
            cwd=UI_DIR,
            mode="proxy",
        )
        security = Security(csp=DEV_CSP)
    else:
        # Cornea cannot look inside a compiled package, so the compiled build gets the folder.
        source = (
            Static(ASSETS_DIR)
            if ASSETS_DIR.is_dir()
            else Static(package="rayohx_desktop", package_path=ASSETS_PATH)
        )

    shell = Shell(
        source,
        routers=[api_router()],
        security=security,
        window=(
            Window(title=TITLE, size=(1024, 768), icon=ICON if ICON.is_file() else None)
            if window
            else None
        ),
        loading=Loading(
            subtitle=TAGLINE,
            icon=LOADING_ICON if LOADING_ICON.is_file() else None,
            min_display=LOADING_SECONDS,
        ),
        identity=App(id=APP_ID),
    )
    shell.action("app_info")(app_info)
    shell.action("open_downloads")(open_downloads)
    return shell


def run_ui(
    *, dev: bool = False, window: bool = True, on_ready: Callable[[str], None] | None = None
) -> None:
    """Build the shell and run it until the window closes (or, without a window, until stopped).

    Args:
        dev: See ``build_shell``.
        window: See ``build_shell``.
        on_ready: Called once with a JSON line holding the address, which carries the one-time
            start-up token. Use it to show the address when there is no window.

    Raises:
        UiUnavailableError: If the UI needs Windows, or Cornea is not installed.
    """
    shell = build_shell(dev=dev, window=window)
    if on_ready is None:
        shell.run()
        return
    from cornea import ready_line

    shell.run(on_ready=lambda ready: on_ready(ready_line(ready)))
