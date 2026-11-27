from typing import Any

import pytest
from pydantic import ValidationError

from rayohx_api.schemas.v1 import DownloadCreate, Job, JobList, Output, Progress

URL = "https://example.test/master.m3u8"


def test_download_create_defaults() -> None:
    data = DownloadCreate(url=URL).model_dump()
    assert data["url"] == URL
    assert (data["urls"], data["playlist_text"], data["base_url"], data["filename"]) == (
        [],
        None,
        None,
        None,
    )
    assert data["selection"]["quality"] == "best"
    assert data["selection"]["audio"] == []
    assert data["output"]["format"] == "auto"
    assert data["output"]["validate_output"] is True
    assert data["output"]["overwrite"] is False
    assert data["storage"]["strategy"] == "auto"
    assert data["engine"] == {"concurrency": None, "resume": True, "allow_file_keys": False}
    assert data["network"]["headers"] == {}


@pytest.mark.parametrize(
    "overrides",
    [
        {"url": "u" * 4097},
        {"filename": "f" * 201},
        {"urls": ["x"] * 101},
        {"playlist_text": "x" * 1_000_001},
        {"selection": {"audio": ["x"] * 17}},
        {"selection": {"subtitles": ["x"] * 17}},
        {"selection": {"quality": "fast"}},
        {"selection": {"codec": "mpeg2"}},
        {"selection": {"variant": 0}},
        {"selection": {"resolution": "720p"}},
        {"storage": {"strategy": "fast"}},
        {"storage": {"buffer_bytes": 0}},
        {"output": {"format": "mkv"}},
        {"output": {"remux_backend": "gstreamer"}},
        {"engine": {"concurrency": 65}},
        {"network": {"retries": 21}},
        {"network": {"max_redirects": 51}},
        {"network": {"timeout": 0}},
        {"network": {"rate_limit": 0}},
    ],
)
def test_download_create_rejects_invalid(overrides: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        DownloadCreate(**{"url": URL, **overrides})


def test_download_create_accepts_limits() -> None:
    request = DownloadCreate(
        url="u" * 4096,
        filename="f" * 200,
        urls=["x"] * 100,
        selection={"audio": ["en"] * 16, "video_only": True},  # type: ignore[arg-type]
        output={"format": "segments"},  # type: ignore[arg-type]
    )
    assert request.output.format == "segments"
    assert len(request.selection.audio) == 16


def test_output_accepts_validate_by_name_or_alias() -> None:
    assert Output(validate=False).validate_output is False
    assert Output.model_validate({"validate_output": False}).validate_output is False


def test_secrets_are_hidden() -> None:
    request = DownloadCreate(
        url=URL,
        network={  # type: ignore[arg-type]
            "client_key_password": "k3y",
            "proxy": {"url": "http://p", "password": "pw"},
        },
    )
    assert "k3y" not in repr(request)
    assert "pw'" not in repr(request)
    assert "k3y" not in request.model_dump_json()
    assert request.network.proxy is not None
    assert request.network.proxy.password is not None
    assert request.network.proxy.password.get_secret_value() == "pw"


def test_download_create_list_defaults_are_independent() -> None:
    first, second = DownloadCreate(url=URL), DownloadCreate(url=URL)
    first.selection.audio.append("en")
    assert second.selection.audio == []


def test_progress_defaults_and_required_state() -> None:
    progress = Progress(state="downloading")
    assert progress.downloaded_bytes == 0
    assert progress.total_bytes is None
    assert progress.speed == 0.0
    with pytest.raises(ValidationError):
        Progress()  # type: ignore[call-arg]


def test_job_minimal_and_full() -> None:
    job = Job(id="a", url=URL, state="queued", created_at=1.0, updated_at=2.0)
    assert job.progress is None
    assert job.output_path is None
    full = Job(
        id="a",
        url=URL,
        state="completed",
        created_at=1.0,
        updated_at=2.0,
        progress={"state": "completed", "fraction": 1.0},  # type: ignore[arg-type]
        output_path="a.mp4",
        output_size_bytes=7,
    )
    assert isinstance(full.progress, Progress)
    assert full.progress.fraction == 1.0


@pytest.mark.parametrize("missing", ["id", "url", "state", "created_at", "updated_at"])
def test_job_requires_fields(missing: str) -> None:
    data: dict[str, Any] = {
        "id": "a",
        "url": URL,
        "state": "queued",
        "created_at": 1.0,
        "updated_at": 2.0,
    }
    del data[missing]
    with pytest.raises(ValidationError):
        Job(**data)


def test_job_list_holds_jobs() -> None:
    data = {"id": "a", "url": URL, "state": "queued", "created_at": 1, "updated_at": 2}
    assert JobList(items=[data]).items[0].id == "a"  # type: ignore[list-item]
    assert JobList(items=[]).items == []
