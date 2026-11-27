"""Runs downloads in background threads and keeps their state and engine log.

Routes call this; the work itself is done by ``rayohx``. When given a store, the list is
saved and restored across restarts (unfinished jobs come back as failed); partial downloads still
resume because the engine keeps its own state on disk.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from rayohx import CancellationToken
from rayohx.enums import DownloadState

from rayohx_api.store import MAX_EVENTS

if TYPE_CHECKING:
    from pathlib import Path
    from typing import Any

    from rayohx.downloader import Downloader
    from rayohx.events import DownloadEvent

    from rayohx_api.schemas.v1.downloads import DownloadCreate
    from rayohx_api.store import Store

MAX_JOBS = 200
#: Event names that fire for every segment; progress already covers them.
_QUIET = frozenset({"download_progress", "segment_started", "segment_completed"})
_BAD_NAME = r'[\\/:*?"<>|\x00-\x1f]'


class UnsafeFilenameError(ValueError):
    """The client asked for a name that could leave the download folder."""


def safe_filename(name: str) -> str:
    import re

    cleaned = name.strip()
    if not cleaned or cleaned in {".", ".."} or re.search(_BAD_NAME, cleaned):
        raise UnsafeFilenameError("Use a plain file name without folders or special characters.")
    return cleaned


def _plain(value: Any) -> Any:
    """Turn a dumped request into plain values, revealing secrets so a retry can use them."""
    from pydantic import SecretStr

    if isinstance(value, SecretStr):
        return value.get_secret_value()
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


@dataclass
class JobRecord:
    id: str
    url: str
    state: DownloadState = DownloadState.QUEUED
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    progress: dict[str, Any] | None = None
    output_path: str | None = None
    output_size: int | None = None
    error: str | None = None
    quality: str | None = None
    #: What it takes to run this job again, secrets included. Kept in the local database only.
    request: dict[str, Any] | None = None
    #: What the engine reported, most recent last. Also saved in the store when there is one.
    events: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=MAX_EVENTS))
    downloader: Downloader | None = None
    token: CancellationToken = field(default_factory=CancellationToken)

    @property
    def retryable(self) -> bool:
        return self.state in (DownloadState.FAILED, DownloadState.CANCELLED)


class JobManager:
    def __init__(self, directory: Path, max_active: int, store: Store | None = None) -> None:
        import threading
        from collections import OrderedDict

        self.directory = directory
        self._store = store
        self._slots = threading.BoundedSemaphore(max_active)
        self._jobs: OrderedDict[str, JobRecord] = OrderedDict()
        self._lock = threading.RLock()
        if store:
            for record in store.load():
                self._jobs[record.id] = record

    def _save(self, record: JobRecord) -> None:
        if self._store:
            self._store.save(record)

    def all(self) -> list[JobRecord]:
        with self._lock:
            return list(reversed(self._jobs.values()))

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def create(self, request: DownloadCreate, *, local_paths: bool) -> list[JobRecord]:
        """Start one job for each address in the request."""
        import threading
        import uuid

        from rayohx._redaction import redact_url
        from rayohx.downloader.batch import batch_outputs
        from rayohx.errors import ConfigurationError

        from rayohx_api.build import download_config, sources

        urls = sources(request)
        if request.filename and len(urls) > 1:
            raise ConfigurationError("A file name can only be given for a single download.")
        filename = safe_filename(request.filename) if request.filename else None
        self.directory.mkdir(parents=True, exist_ok=True)
        config = download_config(request, base=self.directory, local=local_paths)
        folder = config.output.directory or self.directory
        folder.mkdir(parents=True, exist_ok=True)
        if filename:
            outputs: list[Path | None] = [folder / filename]
        elif len(urls) > 1:
            outputs = list(batch_outputs(urls, folder))
        else:
            outputs = [None]
        records = []
        for url, output in zip(urls, outputs, strict=True):
            update: dict[str, Any] = {"filename": output.name} if output else {}
            if request.playlist_text is None:
                update |= {"url": url, "urls": []}
            job_request = request.model_copy(update=update)
            record = JobRecord(
                id=uuid.uuid4().hex[:12],
                url=redact_url(url),
                quality=request.selection.quality,
                request=_plain(job_request.model_dump()),
            )
            self._attach(record, url, output, config, request.playlist_text)
            records.append(record)
        with self._lock:
            for record in records:
                self._jobs[record.id] = record
                self._save(record)
            if not self._store:
                self._trim()
        for record in records:
            threading.Thread(target=self._run, args=(record,), daemon=True).start()
        return records

    def _attach(
        self,
        record: JobRecord,
        url: str,
        output: Path | None,
        config: Any,
        playlist_text: str | None,
    ) -> None:
        from functools import partial

        from rayohx.downloader import Downloader

        record.downloader = Downloader(
            url,
            output=output,
            config=config,
            cancel=record.token,
            download_id=record.id,
            playlist_text=playlist_text,
        )
        record.downloader.events.subscribe(partial(self._on_event, record))

    def retry(self, record: JobRecord, *, local_paths: bool, overwrite: bool = False) -> bool:
        """Run a failed or cancelled job again from its saved request; partial files resume.

        `overwrite` replaces an existing output file for this run only.
        """
        import threading

        from rayohx_api.build import download_config, sources
        from rayohx_api.schemas.v1.downloads import DownloadCreate

        with self._lock:
            if not record.retryable:
                return False
            # Jobs saved before requests were kept only have the address and quality.
            saved = record.request or {
                "url": record.url,
                "selection": {"quality": record.quality or "best"},
            }
            if overwrite:
                saved = {**saved, "output": {**(saved.get("output") or {}), "overwrite": True}}
            request = DownloadCreate.model_validate(saved)
            config = download_config(request, base=self.directory, local=local_paths)
            folder = config.output.directory or self.directory
            folder.mkdir(parents=True, exist_ok=True)
            filename = safe_filename(request.filename) if request.filename else None
            output = folder / filename if filename else None
            record.token = CancellationToken()
            record.state = DownloadState.QUEUED
            record.error = None
            record.progress = None
            record.output_path = None
            record.output_size = None
            record.updated_at = time.time()
            self._attach(record, sources(request)[0], output, config, request.playlist_text)
            self._save(record)
        threading.Thread(target=self._run, args=(record,), daemon=True).start()
        return True

    def _trim(self) -> None:
        for key in [k for k, j in self._jobs.items() if j.state.is_terminal]:
            if len(self._jobs) <= MAX_JOBS:
                break
            del self._jobs[key]

    def _on_event(self, record: JobRecord, event: DownloadEvent) -> None:
        from rayohx.serialization import progress_to_dict

        with self._lock:
            changed = record.state is not event.state
            record.state = event.state
            record.updated_at = time.time()
            if event.progress is not None:
                record.progress = progress_to_dict(event.progress)
        if event.type.value not in _QUIET:
            line = {
                "time": event.timestamp,
                "type": event.type.value,
                "state": event.state.value,
                "message": event.message,
                "segment": event.segment_index,
            }
            record.events.append(line)
            if self._store:
                self._store.add_event(record.id, line)
        if changed:
            self._save(record)

    def _run(self, record: JobRecord) -> None:
        from rayohx.serialization import progress_to_dict

        assert record.downloader is not None  # noqa: S101
        with self._slots:
            if record.token.is_cancelled:
                with self._lock:
                    record.state = DownloadState.CANCELLED
                    record.updated_at = time.time()
                    self._save(record)
                return
            result = record.downloader.run()
        with self._lock:
            record.state = result.state
            record.progress = progress_to_dict(result.progress)
            record.error = result.error
            if result.output:
                record.output_path = result.output.path.name
                record.output_size = result.output.size_bytes
            record.updated_at = time.time()
            self._save(record)

    def pause(self, record: JobRecord) -> None:
        if record.downloader:
            record.downloader.pause()

    def resume(self, record: JobRecord) -> None:
        if record.downloader:
            record.downloader.resume()

    def cancel(self, record: JobRecord) -> None:
        record.token.cancel()
        with self._lock:
            if record.state is DownloadState.QUEUED:
                record.state = DownloadState.CANCELLED
                record.updated_at = time.time()
                self._save(record)

    def remove(self, record: JobRecord) -> bool:
        """Forget a finished job. Running ones must be cancelled first."""
        if not record.state.is_terminal:
            return False
        with self._lock:
            self._jobs.pop(record.id, None)
        if self._store:
            self._store.delete([record.id])
        return True

    def clear(self) -> int:
        """Forget every finished job, keeping the ones still queued or running."""
        with self._lock:
            done = [k for k, j in self._jobs.items() if j.state.is_terminal]
            for key in done:
                del self._jobs[key]
        if self._store:
            self._store.delete(done)
        return len(done)
