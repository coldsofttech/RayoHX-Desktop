from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _leftover(root: Path, name: str, size: int) -> Path:
    folder = root / name
    folder.mkdir()
    (folder / "part").write_bytes(b"x" * size)
    return folder


def test_nothing_to_clean(client: TestClient) -> None:
    assert client.post("/api/v1/clean", json={}).json() == {
        "dry_run": True,
        "folders": [],
        "freed_bytes": 0,
        "skipped_in_use": 0,
    }


def test_dry_run_then_remove(client: TestClient, tmp_path: Path) -> None:
    leftover = _leftover(tmp_path, ".rayohx-abc", 10)
    dry = client.post("/api/v1/clean", json={}).json()
    assert dry["dry_run"] is True
    assert dry["freed_bytes"] == 10
    assert leftover.exists()
    done = client.post("/api/v1/clean", json={"dry_run": False}).json()
    assert done["folders"][0]["name"] == ".rayohx-abc"
    assert done["folders"][0]["size_bytes"] == 10
    assert not leftover.exists()


def test_total_adds_up_across_folders(client: TestClient, tmp_path: Path) -> None:
    _leftover(tmp_path, ".rayohx-a", 3)
    _leftover(tmp_path, ".rayohx-b", 4)
    body = client.post("/api/v1/clean", json={}).json()
    assert sorted(f["name"] for f in body["folders"]) == [".rayohx-a", ".rayohx-b"]
    assert body["freed_bytes"] == 7


def test_skips_folders_in_use(client: TestClient, tmp_path: Path) -> None:
    from rayohx.models import LeftoverWorkspace

    busy = _leftover(tmp_path, ".rayohx-busy", 1)
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "rayohx.workspaces.find_workspaces",
            lambda folders=None, older_than_days=0: [LeftoverWorkspace(busy, 1, 0.0, True)],
        )
        body = client.post("/api/v1/clean", json={"dry_run": False}).json()
    assert body["folders"] == []
    assert body["freed_bytes"] == 0
    assert body["skipped_in_use"] == 1
    assert busy.exists()


def test_keeps_recent_folders(client: TestClient, tmp_path: Path) -> None:
    recent = _leftover(tmp_path, ".rayohx-new", 1)
    body = client.post("/api/v1/clean", json={"older_than_days": 30, "dry_run": False}).json()
    assert body["folders"] == []
    assert recent.exists()


def test_only_looks_in_download_folder(client: TestClient, tmp_path: Path) -> None:
    elsewhere = tmp_path.parent / f"{tmp_path.name}-other"
    elsewhere.mkdir()
    try:
        outside = _leftover(elsewhere, ".rayohx-out", 1)
        client.post("/api/v1/clean", json={"dry_run": False})
        assert outside.exists()
    finally:
        import shutil

        shutil.rmtree(elsewhere, ignore_errors=True)


def test_looks_in_the_chosen_download_folder(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from rayohx_api.config import get_settings

    monkeypatch.setenv("RAYOHX_API_ALLOW_LOCAL_PATHS", "true")
    get_settings.cache_clear()
    chosen = tmp_path / "chosen"
    chosen.mkdir()
    _leftover(tmp_path, ".rayohx-old", 1)
    leftover = _leftover(chosen, ".rayohx-new", 2)
    assert client.patch("/api/v1/settings", json={"download_dir": str(chosen)}).status_code == 200
    body = client.post("/api/v1/clean", json={"dry_run": False}).json()
    assert [f["name"] for f in body["folders"]] == [".rayohx-new"]
    assert not leftover.exists()
    assert (tmp_path / ".rayohx-old").exists()


def test_negative_age_is_422(client: TestClient) -> None:
    assert client.post("/api/v1/clean", json={"older_than_days": -1}).status_code == 422
