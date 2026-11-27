"""State and helpers the ``/api/v1`` route modules share."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, HTTPException, status

from rayohx_api.defaults import without_secrets
from rayohx_api.jobs import JobManager
from rayohx_api.schemas.v1.downloads import Job, Progress

if TYPE_CHECKING:
    from typing import Any

    from rayohx_api.jobs import JobRecord
    from rayohx_api.store import Store


class Preferences:
    """Choices a client can change while the API runs. They are saved in the store."""

    def __init__(self, default_dir: Path, store: Store | None = None) -> None:
        self._store = store
        self.download_dir = default_dir
        self.theme: str | None = None
        self.defaults: dict[str, Any] = {}
        if not store:
            return
        if (saved := store.get_pref("download_dir")) and Path(saved).is_absolute():
            self.download_dir = Path(saved)
        if (saved := store.get_pref("theme")) in ("light", "dark"):
            self.theme = saved
        self.defaults = self._load_defaults(store.get_pref("defaults"))

    @staticmethod
    def _load_defaults(saved: str | None) -> dict[str, Any]:
        try:
            loaded = json.loads(saved) if saved else {}
        except ValueError:
            return {}
        return loaded if isinstance(loaded, dict) else {}

    def save_defaults(self, data: dict[str, Any]) -> None:
        """Keep the default options, without logins or passwords, in memory and in the store."""
        self.defaults = without_secrets(data)
        if self._store:
            self._store.set_pref("defaults", json.dumps(self.defaults, sort_keys=True))

    def close(self) -> None:
        if self._store:
            self._store.close()

    def update(self, changes: dict[str, Any]) -> None:
        for name, value in changes.items():
            setattr(self, name, value)
            if self._store:
                saved = "1" if value is True else "0" if value is False else str(value)
                self._store.set_pref(name, saved)


@lru_cache
def _state() -> tuple[JobManager, Preferences]:
    from rayohx_api.config import get_settings
    from rayohx_api.store import Store

    settings = get_settings()
    store = Store(settings.db_path)
    preferences = Preferences(settings.download_dir, store)
    jobs = JobManager(preferences.download_dir, settings.max_active_downloads, store)
    return jobs, preferences


def reset_state() -> None:
    """Forget every job. Tests call this together with ``get_settings.cache_clear()``."""
    if _state.cache_info().currsize:
        _state()[1].close()
    _state.cache_clear()


def manager() -> JobManager:
    return _state()[0]


def prefs() -> Preferences:
    return _state()[1]


Jobs = Annotated[JobManager, Depends(manager)]


def problem(code: int, exc: Exception) -> HTTPException:
    detail = str(exc)
    hint = getattr(exc, "hint", None)
    return HTTPException(code, f"{detail} {hint}" if hint else detail)


def to_job(record: JobRecord) -> Job:
    progress = Progress(**record.progress) if record.progress else None
    return Job(
        id=record.id,
        url=record.url,
        state=record.state.value,
        created_at=record.created_at,
        updated_at=record.updated_at,
        progress=progress,
        output_path=record.output_path,
        output_size_bytes=record.output_size,
        error=record.error,
        error_code=(
            "output_exists"
            if record.error and record.error.startswith("The output file already exists")
            else None
        ),
        quality=record.quality,
        retryable=record.retryable,
        has_log=bool(record.events),
    )


def find_job(jobs: JobManager, job_id: str) -> JobRecord:
    record = jobs.get(job_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such download.")
    return record
