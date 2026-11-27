"""The window is mocked: Cornea's ``Shell`` is replaced, so no WebView2 is needed."""

import sys
from pathlib import Path
from typing import Annotated, Any

import cornea
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from rayohx import __version__

from rayohx_api.auth import Principal, authenticate
from rayohx_desktop import app as ui_app


class FakeShell:
    """Records how the app wired Cornea, and what it was asked to run."""

    instances: list["FakeShell"] = []  # noqa: RUF012

    def __init__(self, source: Any, **options: Any) -> None:
        self.source = source
        self.options = options
        self.actions: dict[str, Any] = {}
        self.run_kwargs: dict[str, Any] | None = None
        FakeShell.instances.append(self)

    def action(self, name: str) -> Any:
        def register(function: Any) -> Any:
            self.actions[name] = function
            return function

        return register

    def run(self, **kwargs: Any) -> None:
        self.run_kwargs = kwargs


@pytest.fixture
def shell_on_windows(monkeypatch: pytest.MonkeyPatch) -> type[FakeShell]:
    FakeShell.instances = []
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setattr(cornea, "Shell", FakeShell, raising=False)  # may not import off Windows
    monkeypatch.setattr(cornea, "ready_line", lambda ready: str(ready), raising=False)
    return FakeShell


@pytest.mark.skipif(
    not Path(ui_app.__file__).exists(),
    reason="the compiled build fixes sys.platform when it is built, so the test cannot swap it",
)
def test_other_systems_get_a_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "platform", "linux")

    with pytest.raises(ui_app.UiUnavailableError, match="Windows"):
        ui_app.build_shell()


def test_missing_cornea_gets_a_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setitem(sys.modules, "cornea", None)

    with pytest.raises(ui_app.UiUnavailableError, match="cornea-shell"):
        ui_app.build_shell()


def test_static_mode_serves_the_bundled_frontend(shell_on_windows: type[FakeShell]) -> None:
    ui_app.build_shell()

    shell = shell_on_windows.instances[0]
    assert isinstance(shell.source, cornea.Static)
    assert shell.options["window"].title == ui_app.TITLE
    csp = shell.options["security"].csp
    assert "style-src 'self' 'unsafe-inline'" in csp
    assert "script-src 'self';" in csp
    assert shell.options["identity"].id == ui_app.APP_ID


def test_dev_mode_starts_vite_through_cornea(
    shell_on_windows: type[FakeShell], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ui_app, "dev_port", lambda: 6000)

    ui_app.build_shell(dev=True)

    shell = shell_on_windows.instances[0]
    assert isinstance(shell.source, cornea.Process)
    assert shell.source.command == "npm run dev -- --port 6000 --strictPort"
    assert shell.source.url == "http://localhost:6000"
    assert shell.source.mode == "proxy"
    assert shell.options["security"].csp == cornea.DEV_CSP


def test_window_uses_title_and_icon_when_the_icon_exists(
    shell_on_windows: type[FakeShell], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    icon = tmp_path / "icon.png"
    icon.write_bytes(b"png")
    monkeypatch.setattr(ui_app, "ICON", icon)

    ui_app.build_shell()

    window = shell_on_windows.instances[0].options["window"]
    assert (window.title, window.icon) == (ui_app.TITLE, icon)


def test_window_has_no_icon_when_the_file_is_missing(
    shell_on_windows: type[FakeShell], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(ui_app, "ICON", tmp_path / "missing.png")

    ui_app.build_shell()

    assert shell_on_windows.instances[0].options["window"].icon is None


def test_version_comes_from_the_package() -> None:
    assert __version__ == ui_app.VERSION


def test_no_window_means_no_window_object(shell_on_windows: type[FakeShell]) -> None:
    ui_app.build_shell(window=False)

    assert shell_on_windows.instances[0].options["window"] is None


def test_native_action_is_registered(shell_on_windows: type[FakeShell]) -> None:
    ui_app.build_shell()

    action = shell_on_windows.instances[0].actions["app_info"]
    assert action() == ui_app.app_info() == {"name": ui_app.TITLE, "version": ui_app.VERSION}


def test_open_downloads_shows_the_download_folder(
    shell_on_windows: type[FakeShell], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import subprocess
    from types import SimpleNamespace

    opened: list[list[str]] = []
    monkeypatch.setattr(subprocess, "Popen", lambda args: opened.append(args))
    folder = tmp_path / "RayoHX"
    monkeypatch.setattr(
        "rayohx_api.routers.v1.deps.manager", lambda: SimpleNamespace(directory=folder)
    )
    ui_app.build_shell()

    action = shell_on_windows.instances[0].actions["open_downloads"]
    assert action() == {"opened": True}
    assert opened == [["explorer", str(folder)]]
    assert folder.is_dir()


def test_api_router_is_mounted_under_cornea_prefix() -> None:
    router = ui_app.api_router()
    router.add_api_route("/ping", lambda: {"ok": True})
    app = FastAPI()
    app.include_router(router, prefix="/api")

    response = TestClient(app).get("/api/v1/ping")

    assert response.json() == {"ok": True}


def test_api_router_allows_local_paths_because_the_client_is_the_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from rayohx_api.config import get_settings

    monkeypatch.setenv("RAYOHX_API_ALLOW_LOCAL_PATHS", "false")
    ui_app.api_router()
    try:
        assert get_settings().allow_local_paths is True
    finally:
        get_settings.cache_clear()


def test_api_router_leaves_authentication_to_cornea(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    monkeypatch.setenv("RAYOHX_API_API_KEYS", '["s3cret"]')
    router = ui_app.api_router()

    def whoami(principal: Annotated[Principal, Depends(authenticate)]) -> dict[str, str]:
        return {"method": principal.method}

    router.add_api_route("/whoami", whoami)
    app = FastAPI()
    app.include_router(router, prefix="/api")

    response = TestClient(app).get("/api/v1/whoami")

    assert response.status_code == 200
    assert response.json()["method"] == "none"


def test_run_without_callback_just_runs(shell_on_windows: type[FakeShell]) -> None:
    ui_app.run_ui()

    assert shell_on_windows.instances[0].run_kwargs == {}


def test_run_passes_the_ready_line_to_the_callback(shell_on_windows: type[FakeShell]) -> None:
    lines: list[str] = []

    ui_app.run_ui(window=False, on_ready=lines.append)

    on_ready = shell_on_windows.instances[0].run_kwargs["on_ready"]  # type: ignore[index]
    assert callable(on_ready)


class FakeSocket:
    """Stands in for a socket that can bind only the ports in ``free``."""

    free: set[int] = set()  # noqa: RUF012

    def __init__(self, *_args: Any) -> None:
        self.port = 0

    def __enter__(self) -> "FakeSocket":
        return self

    def __exit__(self, *_exc: object) -> None:
        return None

    def bind(self, address: tuple[str, int]) -> None:
        if address[1] not in self.free:
            raise OSError("in use")
        self.port = address[1] or 49152

    def getsockname(self) -> tuple[str, int]:
        return ("localhost", self.port)


def test_dev_port_prefers_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("socket.socket", FakeSocket)
    monkeypatch.setattr(FakeSocket, "free", {ui_app.DEV_PORT, 0})

    assert ui_app.dev_port() == ui_app.DEV_PORT


def test_dev_port_falls_back_to_a_free_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("socket.socket", FakeSocket)
    monkeypatch.setattr(FakeSocket, "free", {0})

    assert ui_app.dev_port() == 49152


def test_dev_port_fails_when_nothing_is_free(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("socket.socket", FakeSocket)
    monkeypatch.setattr(FakeSocket, "free", set())

    with pytest.raises(ui_app.UiUnavailableError):
        ui_app.dev_port()
