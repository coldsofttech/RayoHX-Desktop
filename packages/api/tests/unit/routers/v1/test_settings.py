from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from rayohx import __version__
from rayohx.config.download import MAX_CONCURRENCY


def test_read_defaults(client: TestClient, tmp_path: Path) -> None:
    assert client.get("/api/v1/settings").json() == {
        "download_dir": str(tmp_path),
        "max_active_downloads": 2,
        "allow_local_paths": False,
        "theme": None,
        "limits": {"min_concurrency": 1, "max_concurrency": MAX_CONCURRENCY},
        "version": __version__,
        "defaults": {},
    }


def test_empty_and_null_patches_change_nothing(client: TestClient) -> None:
    before = client.get("/api/v1/settings").json()
    assert client.patch("/api/v1/settings", json={}).json() == before
    assert client.patch("/api/v1/settings", json={"theme": None}).json() == before


def test_invalid_patch_is_422_and_changes_nothing(client: TestClient) -> None:
    before = client.get("/api/v1/settings").json()
    assert client.patch("/api/v1/settings", json={"theme": "pink"}).status_code == 422
    assert client.get("/api/v1/settings").json() == before


def test_default_options_are_saved_and_read_back(client: TestClient) -> None:
    body = {"selection": {"quality": "720p"}, "output": {"overwrite": True}}
    saved = client.put("/api/v1/settings/defaults", json=body)
    assert saved.status_code == 200
    assert saved.json()["defaults"] == body
    assert client.get("/api/v1/settings").json()["defaults"] == body


def test_saving_defaults_replaces_the_old_ones(client: TestClient) -> None:
    client.put("/api/v1/settings/defaults", json={"selection": {"quality": "720p"}})
    after = client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 8}}).json()
    assert after["defaults"] == {"engine": {"concurrency": 8}}


def test_passwords_are_not_saved(client: TestClient) -> None:
    proxy = {"url": "http://proxy.example:8080", "username": "me", "password": "secret"}
    saved = client.put("/api/v1/settings/defaults", json={"network": {"proxy": proxy}}).json()
    assert saved["defaults"] == {"network": {"proxy": {"url": "http://proxy.example:8080"}}}
    assert "secret" not in client.get("/api/v1/settings").text


@pytest.mark.parametrize(
    "body",
    [
        {"engine": {"concurrency": 0}},
        {"engine": {"concurrency": 999}},
        {"selection": {"quality": "fast"}},
    ],
)
def test_invalid_defaults_are_422_and_nothing_is_saved(
    client: TestClient, body: dict[str, Any]
) -> None:
    assert client.put("/api/v1/settings/defaults", json=body).status_code == 422
    assert client.get("/api/v1/settings").json()["defaults"] == {}


def test_a_bad_combination_is_refused_when_saved(client: TestClient) -> None:
    body = {"network": {"cookie_file": "cookies.txt"}}
    assert client.put("/api/v1/settings/defaults", json=body).status_code == 422
    assert client.get("/api/v1/settings").json()["defaults"] == {}


def test_download_dir_needs_local_paths(client: TestClient, tmp_path: Path) -> None:
    response = client.patch("/api/v1/settings", json={"download_dir": str(tmp_path / "new")})
    assert response.status_code == 403
    assert not (tmp_path / "new").exists()


def test_download_dir_is_saved(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from rayohx_api.config import get_settings

    monkeypatch.setenv("RAYOHX_API_ALLOW_LOCAL_PATHS", "true")
    get_settings.cache_clear()
    folder = tmp_path / "chosen"
    assert client.patch("/api/v1/settings", json={"download_dir": str(folder)}).status_code == 200
    assert folder.is_dir()
    assert client.get("/api/v1/settings").json()["download_dir"] == str(folder)
    relative = client.patch("/api/v1/settings", json={"download_dir": "rel"})
    assert relative.status_code == 422


def test_new_downloads_use_the_chosen_folder(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from rayohx_api.config import get_settings
    from rayohx_api.routers.v1.deps import manager

    monkeypatch.setenv("RAYOHX_API_ALLOW_LOCAL_PATHS", "true")
    get_settings.cache_clear()
    folder = tmp_path / "chosen"
    client.patch("/api/v1/settings", json={"download_dir": str(folder)})
    assert manager().directory == folder


def test_theme_is_saved_and_checked(client: TestClient) -> None:
    assert client.patch("/api/v1/settings", json={"theme": "dark"}).json()["theme"] == "dark"
    assert client.patch("/api/v1/settings", json={"theme": "pink"}).status_code == 422
