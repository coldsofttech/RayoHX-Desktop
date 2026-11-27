from pathlib import Path
from types import SimpleNamespace

import pytest
from rayohx.enums import DownloadState, EventType

from rayohx_api import jobs
from rayohx_api.jobs import JobManager, JobRecord, UnsafeFilenameError, safe_filename
from rayohx_api.schemas.v1 import DownloadCreate


@pytest.mark.parametrize("name", ["", "  ", ".", "..", "a/b.mp4", "a\b.mp4", "a:b", "a\x00b"])
def test_unsafe_filenames_are_rejected(name: str) -> None:
    with pytest.raises(UnsafeFilenameError):
        safe_filename(name)


def test_plain_filename_is_trimmed() -> None:
    assert safe_filename("  movie.mp4 ") == "movie.mp4"


def test_remove_only_finished_jobs(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    running = JobRecord(id="a", url="u", state=DownloadState.DOWNLOADING)
    done = JobRecord(id="b", url="u", state=DownloadState.COMPLETED)
    manager._jobs.update({"a": running, "b": done})
    assert manager.remove(running) is False
    assert manager.remove(done) is True
    assert manager.get("b") is None
    assert [j.id for j in manager.all()] == ["a"]


def test_cancel_queued_job_is_cancelled_at_once(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u")
    manager.cancel(record)
    assert record.token.is_cancelled
    assert record.state is DownloadState.CANCELLED


def test_cancelled_before_start_never_runs(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u", downloader=SimpleNamespace())  # type: ignore[arg-type]
    record.token.cancel()
    manager._run(record)
    assert record.state is DownloadState.CANCELLED


def test_trim_drops_oldest_finished_jobs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(jobs, "MAX_JOBS", 2)
    manager = JobManager(tmp_path, max_active=1)
    for i in range(4):
        manager._jobs[str(i)] = JobRecord(id=str(i), url="u", state=DownloadState.COMPLETED)
    manager._jobs["live"] = JobRecord(id="live", url="u", state=DownloadState.DOWNLOADING)
    manager._trim()
    assert len(manager._jobs) == 2
    assert "live" in manager._jobs


def test_run_records_output(tmp_path: Path) -> None:
    from rayohx.models import DownloadProgress

    result = SimpleNamespace(
        state=DownloadState.COMPLETED,
        progress=DownloadProgress(),
        error=None,
        output=SimpleNamespace(path=tmp_path / "a.mp4", size_bytes=7),
    )
    record = JobRecord(id="a", url="u", downloader=SimpleNamespace(run=lambda: result))  # type: ignore[arg-type]
    JobManager(tmp_path, max_active=1)._run(record)
    assert (record.state, record.output_path, record.output_size) == (
        DownloadState.COMPLETED,
        "a.mp4",
        7,
    )


def test_list_is_newest_first_and_get_finds_by_id(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    for name in ("a", "b", "c"):
        manager._jobs[name] = JobRecord(id=name, url="u")
    assert [j.id for j in manager.all()] == ["c", "b", "a"]
    assert manager.get("b") is manager._jobs["b"]
    assert manager.get("missing") is None


def test_cancel_running_job_only_sets_token(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u", state=DownloadState.DOWNLOADING)
    manager.cancel(record)
    assert record.token.is_cancelled
    assert record.state is DownloadState.DOWNLOADING


def test_pause_and_resume_delegate_to_downloader(tmp_path: Path) -> None:
    calls: list[str] = []
    downloader = SimpleNamespace(
        pause=lambda: calls.append("pause"), resume=lambda: calls.append("resume")
    )
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u", downloader=downloader)  # type: ignore[arg-type]
    manager.pause(record)
    manager.resume(record)
    assert calls == ["pause", "resume"]


def test_pause_and_resume_without_downloader_do_nothing(tmp_path: Path) -> None:
    manager = JobManager(tmp_path, max_active=1)
    record = JobRecord(id="a", url="u")
    manager.pause(record)
    manager.resume(record)


def test_run_records_failure(tmp_path: Path) -> None:
    from rayohx.models import DownloadProgress

    result = SimpleNamespace(
        state=DownloadState.FAILED, progress=DownloadProgress(), error="boom", output=None
    )
    record = JobRecord(id="a", url="u", downloader=SimpleNamespace(run=lambda: result))  # type: ignore[arg-type]
    JobManager(tmp_path, max_active=1)._run(record)
    assert record.state is DownloadState.FAILED
    assert record.error == "boom"
    assert record.output_path is None


def test_on_event_updates_state_and_progress(tmp_path: Path) -> None:
    from rayohx.models import DownloadProgress

    record = JobRecord(id="a", url="u")
    event = SimpleNamespace(
        type=EventType.DOWNLOAD_PAUSED,
        state=DownloadState.DOWNLOADING,
        progress=DownloadProgress(),
        timestamp=1.0,
        message=None,
        segment_index=None,
    )
    JobManager(tmp_path, max_active=1)._on_event(record, event)  # type: ignore[arg-type]
    assert record.state is DownloadState.DOWNLOADING
    assert record.progress is not None


def test_on_event_without_progress_keeps_previous(tmp_path: Path) -> None:
    record = JobRecord(id="a", url="u", progress={"x": 1})
    event = SimpleNamespace(
        type=EventType.DOWNLOAD_PAUSED,
        state=DownloadState.PAUSED,
        progress=None,
        timestamp=1.0,
        message=None,
        segment_index=None,
    )
    JobManager(tmp_path, max_active=1)._on_event(record, event)  # type: ignore[arg-type]
    assert record.progress == {"x": 1}


def _event(kind: EventType, **extra: object) -> SimpleNamespace:
    values = {
        "type": kind,
        "state": DownloadState.DOWNLOADING,
        "progress": None,
        "timestamp": 2.5,
        "message": None,
        "segment_index": None,
    }
    return SimpleNamespace(**{**values, **extra})


def test_on_event_keeps_a_log_without_per_segment_noise(tmp_path: Path) -> None:
    record = JobRecord(id="a", url="u")
    manager = JobManager(tmp_path, max_active=1)
    manager._on_event(record, _event(EventType.DOWNLOAD_STARTED, message="go"))  # type: ignore[arg-type]
    for noisy in (
        EventType.SEGMENT_STARTED,
        EventType.SEGMENT_COMPLETED,
        EventType.DOWNLOAD_PROGRESS,
    ):
        manager._on_event(record, _event(noisy, segment_index=3))  # type: ignore[arg-type]
    assert list(record.events) == [
        {
            "time": 2.5,
            "type": "download_started",
            "state": "downloading",
            "message": "go",
            "segment": None,
        }
    ]


def test_the_log_keeps_only_the_latest_events(tmp_path: Path) -> None:
    record = JobRecord(id="a", url="u")
    manager = JobManager(tmp_path, max_active=1)
    for number in range(250):
        manager._on_event(record, _event(EventType.DOWNLOAD_STARTED, message=str(number)))  # type: ignore[arg-type]
    assert len(record.events) == 200
    assert record.events[-1]["message"] == "249"


def test_create_rejects_unsafe_filename_before_starting(tmp_path: Path) -> None:
    manager = JobManager(tmp_path / "dl", max_active=1)
    request = DownloadCreate(url="https://a.test/m.m3u8", filename="../evil.mp4")
    with pytest.raises(UnsafeFilenameError):
        manager.create(request, local_paths=False)
    assert manager.all() == []
    assert not (tmp_path / "dl").exists()


def test_create_rejects_a_file_name_for_a_batch(tmp_path: Path) -> None:
    from rayohx.errors import ConfigurationError

    manager = JobManager(tmp_path, max_active=1)
    request = DownloadCreate(urls=["https://a.test/1.m3u8", "https://a.test/2.m3u8"], filename="x")
    with pytest.raises(ConfigurationError, match="single download"):
        manager.create(request, local_paths=False)
    assert manager.all() == []


def test_create_starts_one_job_per_address(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, object]] = []

    class Stub:
        def __init__(self, url: str, **kwargs: object) -> None:
            from rayohx.events import EventBus

            created.append({"url": url, **kwargs})
            self.events = EventBus()

        def run(self) -> None:
            raise AssertionError("not reached")

    monkeypatch.setattr("rayohx.downloader.Downloader", Stub)
    monkeypatch.setattr(JobManager, "_run", lambda self, record: None)
    manager = JobManager(tmp_path, max_active=1)
    request = DownloadCreate(
        urls=["https://a.test/1.m3u8?token=hunter2", "https://b.test/2.m3u8"],
        output={"directory": "shows"},  # type: ignore[arg-type]
    )
    records = manager.create(request, local_paths=False)
    assert [r.id for r in manager.all()] == [r.id for r in reversed(records)]
    assert all("hunter2" not in r.url for r in records)
    assert [c["url"] for c in created] == [
        "https://a.test/1.m3u8?token=hunter2",
        "https://b.test/2.m3u8",
    ]
    assert all(c["output"].parent == tmp_path / "shows" for c in created)  # type: ignore[attr-defined]
    assert (tmp_path / "shows").is_dir()


def test_create_passes_playlist_text_to_the_engine(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, object] = {}

    class Stub:
        def __init__(self, url: str, **kwargs: object) -> None:
            from rayohx.events import EventBus

            seen.update(url=url, **kwargs)
            self.events = EventBus()

    monkeypatch.setattr("rayohx.downloader.Downloader", Stub)
    monkeypatch.setattr(JobManager, "_run", lambda self, record: None)
    request = DownloadCreate(playlist_text="#EXTM3U", base_url="https://a.test/m.m3u8")
    JobManager(tmp_path, max_active=1).create(request, local_paths=False)
    assert seen["url"] == "https://a.test/m.m3u8"
    assert seen["playlist_text"] == "#EXTM3U"
    assert seen["output"] is None


@pytest.mark.parametrize("request_saved", [False, True])
def test_retry_overwrite_applies_to_that_run_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, request_saved: bool
) -> None:
    seen: list[bool] = []

    def attach(
        self: JobManager,
        record: JobRecord,
        source: str,
        output: object,
        config: object,
        text: object,
    ) -> None:
        seen.append(config.output.overwrite)  # type: ignore[attr-defined]

    monkeypatch.setattr(JobManager, "_attach", attach)
    monkeypatch.setattr(JobManager, "_run", lambda self, record: None)
    manager = JobManager(tmp_path, max_active=1)
    saved = (
        {"url": "https://a.test/m.m3u8", "output": {"directory": "x"}} if request_saved else None
    )
    record = JobRecord(
        id="a", url="https://a.test/m.m3u8", state=DownloadState.FAILED, request=saved
    )
    manager._jobs["a"] = record
    assert manager.retry(record, local_paths=True, overwrite=True)
    record.state = DownloadState.FAILED
    assert manager.retry(record, local_paths=True)
    assert seen == [True, False]
