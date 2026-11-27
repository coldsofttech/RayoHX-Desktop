from pathlib import Path

import pytest
from fastapi import HTTPException
from rayohx.enums import DownloadState

from rayohx_api.config import get_settings
from rayohx_api.jobs import JobManager, JobRecord
from rayohx_api.routers.v1 import deps


def test_preferences_defaults(tmp_path: Path) -> None:
    prefs = deps.Preferences(tmp_path)
    assert prefs.defaults == {}
    assert (prefs.download_dir, prefs.theme) == (tmp_path, None)


def test_preferences_are_restored_from_the_store(tmp_path: Path) -> None:
    from rayohx_api.store import Store

    folder = tmp_path / "chosen"
    store = Store(tmp_path / "p.db")
    first = deps.Preferences(tmp_path, store)
    first.update(
        {
            "download_dir": folder,
            "theme": "dark",
        }
    )
    again = deps.Preferences(tmp_path, store)
    assert (again.download_dir, again.theme) == (folder, "dark")
    store.close()


def test_default_options_are_saved_without_secrets(tmp_path: Path) -> None:
    from rayohx_api.store import Store

    store = Store(tmp_path / "p.db")
    proxy = {"url": "http://p", "password": "x"}
    deps.Preferences(tmp_path, store).save_defaults(
        {"selection": {"quality": "720p"}, "network": {"proxy": proxy}}
    )
    again = deps.Preferences(tmp_path, store)
    assert again.defaults == {
        "selection": {"quality": "720p"},
        "network": {"proxy": {"url": "http://p"}},
    }
    store.close()


def test_preferences_ignore_bad_saved_values(tmp_path: Path) -> None:
    from rayohx_api.store import Store

    store = Store(tmp_path / "p.db")
    store.set_pref("download_dir", "relative/folder")
    store.set_pref("theme", "pink")
    store.set_pref("defaults", "not json")
    prefs = deps.Preferences(tmp_path, store)
    assert (prefs.download_dir, prefs.theme, prefs.defaults) == (tmp_path, None, {})
    store.set_pref("defaults", "[1]")
    assert deps.Preferences(tmp_path, store).defaults == {}
    store.close()


def test_state_is_shared_until_reset(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("RAYOHX_API_DOWNLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("RAYOHX_API_MAX_ACTIVE_DOWNLOADS", "3")
    get_settings.cache_clear()
    deps.reset_state()
    first = deps.manager()
    assert isinstance(first, JobManager)
    assert first is deps.manager()
    assert first.directory == tmp_path
    assert deps.prefs() is deps.prefs()
    old_prefs = deps.prefs()
    deps.reset_state()
    assert deps.manager() is not first
    assert deps.prefs() is not old_prefs


class _Hinted(Exception):
    hint = "Try again."


@pytest.mark.parametrize(
    ("exc", "detail"),
    [(ValueError("bad"), "bad"), (_Hinted("bad"), "bad Try again.")],
)
def test_problem_builds_http_exception(exc: Exception, detail: str) -> None:
    error = deps.problem(422, exc)
    assert isinstance(error, HTTPException)
    assert error.status_code == 422
    assert error.detail == detail


def test_to_job_without_progress() -> None:
    record = JobRecord(id="a", url="u", created_at=1.0, updated_at=2.0)
    job = deps.to_job(record)
    assert (job.id, job.url, job.state) == ("a", "u", DownloadState.QUEUED.value)
    assert (job.created_at, job.updated_at) == (1.0, 2.0)
    assert job.progress is None
    assert job.output_path is None
    assert job.output_size_bytes is None


def test_to_job_maps_all_fields() -> None:
    record = JobRecord(
        id="a",
        url="u",
        state=DownloadState.FAILED,
        progress={"state": "failed", "downloaded_bytes": 5},
        output_path="a.mp4",
        output_size=9,
        error="boom",
    )
    job = deps.to_job(record)
    assert job.state == "failed"
    assert job.progress is not None
    assert job.progress.downloaded_bytes == 5
    assert (job.output_path, job.output_size_bytes, job.error) == ("a.mp4", 9, "boom")


def test_find_job(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u")
    manager._jobs["a"] = record
    assert deps.find_job(manager, "a") is record
    with pytest.raises(HTTPException) as caught:
        deps.find_job(manager, "b")
    assert caught.value.status_code == 404
    assert caught.value.detail == "No such download."


def test_closing_preferences_closes_the_store_and_is_safe_without_one(tmp_path: Path) -> None:
    from sqlite3 import ProgrammingError

    from rayohx_api.store import Store

    deps.Preferences(tmp_path).close()

    store = Store(tmp_path / "p.db")
    deps.Preferences(tmp_path, store).close()
    with pytest.raises(ProgrammingError):
        store.get_pref("theme")
