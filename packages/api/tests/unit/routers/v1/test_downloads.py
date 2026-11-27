import time
from pathlib import Path
from typing import Any, ClassVar

import pytest
from fastapi.testclient import TestClient

URL = "https://cdn.example.com/m.m3u8"
BASE = "/api/v1/downloads"


class FakeDownloader:
    """Stands in for the engine: runs until cancelled."""

    instances: ClassVar[list["FakeDownloader"]] = []

    def __init__(self, url: str, *, cancel: Any, config: Any = None, **kwargs: Any) -> None:
        import threading

        from rayohx.events import EventBus

        self.url = url
        self.config = config
        self.kwargs = kwargs
        self.events = EventBus()
        self.cancel_token = cancel
        self.paused = False
        self.started = threading.Event()
        FakeDownloader.instances.append(self)

    def pause(self) -> None:
        self.paused = True

    def resume(self) -> None:
        self.paused = False

    def run(self) -> Any:
        from rayohx.enums import DownloadState
        from rayohx.models import DownloadProgress

        class Result:
            state = DownloadState.CANCELLED
            progress = DownloadProgress()
            error = None
            output = None

        self.started.set()
        self.cancel_token.wait(5)
        return Result()


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> type[FakeDownloader]:
    FakeDownloader.instances = []
    monkeypatch.setattr("rayohx.downloader.Downloader", FakeDownloader)
    return FakeDownloader


def _start(client: TestClient, **extra: Any) -> dict[str, Any]:
    response = client.post(BASE, json={"url": URL, **extra})
    assert response.status_code == 202
    return response.json()["items"][0]  # type: ignore[no-any-return]


def _wait_for(client: TestClient, job_id: str, state: str) -> None:
    for _ in range(50):
        if client.get(f"{BASE}/{job_id}").json()["state"] == state:
            return
        time.sleep(0.1)
    raise AssertionError(f"job never reached {state}")


def test_empty_list(client: TestClient) -> None:
    assert client.get(BASE).json() == {"items": []}


def test_download_lifecycle(client: TestClient, fake: type[FakeDownloader]) -> None:
    job = _start(client, url="https://cdn.example.com/m.m3u8?token=secret", filename="a.mp4")
    assert "secret" not in job["url"]
    assert client.post(f"{BASE}/{job['id']}/pause").status_code == 200
    assert client.post(f"{BASE}/{job['id']}/resume").status_code == 200
    assert client.delete(f"{BASE}/{job['id']}").status_code == 409
    client.post(f"{BASE}/{job['id']}/cancel")
    _wait_for(client, job["id"], "cancelled")
    events = client.get(f"{BASE}/{job['id']}/events")
    assert "event: job" in events.text
    assert client.delete(f"{BASE}/{job['id']}").status_code == 204
    assert client.get(BASE).json() == {"items": []}


def test_create_returns_job_and_it_can_be_fetched(
    client: TestClient, fake: type[FakeDownloader]
) -> None:
    job = _start(client)
    assert set(job) >= {"id", "url", "state", "created_at", "updated_at"}
    assert client.get(f"{BASE}/{job['id']}").json()["id"] == job["id"]
    client.post(f"{BASE}/{job['id']}/cancel")


def test_list_is_newest_first(client: TestClient, fake: type[FakeDownloader]) -> None:
    ids = [_start(client)["id"] for _ in range(3)]
    assert [item["id"] for item in client.get(BASE).json()["items"]] == ids[::-1]
    for job_id in ids:
        client.post(f"{BASE}/{job_id}/cancel")


def test_pause_and_resume_reach_the_downloader(
    client: TestClient, fake: type[FakeDownloader]
) -> None:
    job = _start(client)
    downloader = fake.instances[-1]
    client.post(f"{BASE}/{job['id']}/pause")
    assert downloader.paused is True
    client.post(f"{BASE}/{job['id']}/resume")
    assert downloader.paused is False
    client.post(f"{BASE}/{job['id']}/cancel")


def test_cancel_before_start_is_immediate(
    client: TestClient, fake: type[FakeDownloader], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RAYOHX_API_MAX_ACTIVE_DOWNLOADS", "1")
    from rayohx_api.config import get_settings
    from rayohx_api.routers.v1 import reset_state

    get_settings.cache_clear()
    reset_state()
    running = _start(client)
    queued = _start(client)
    assert client.post(f"{BASE}/{queued['id']}/cancel").json()["state"] == "cancelled"
    client.post(f"{BASE}/{running['id']}/cancel")


def test_create_uses_saved_defaults(client: TestClient, fake: type[FakeDownloader]) -> None:
    client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 7}})
    job = _start(
        client,
        selection={"quality": "720p", "audio": ["en"], "video_only": True},
        output={"format": "mp4"},
    )
    config = fake.instances[-1].config
    assert config.concurrency == 7
    assert config.selection.quality == "720p"
    assert config.selection.audio_languages == ("en",)
    assert config.selection.video_only is True
    assert config.output.format.value == "mp4"
    client.post(f"{BASE}/{job['id']}/cancel")


def test_request_options_win_over_saved_defaults(
    client: TestClient, fake: type[FakeDownloader]
) -> None:
    saved = {"selection": {"quality": "720p", "video_only": True}, "engine": {"concurrency": 7}}
    client.put("/api/v1/settings/defaults", json=saved)
    job = _start(client, selection={"quality": "480p"})
    config = fake.instances[-1].config
    assert (config.selection.quality, config.selection.video_only) == ("480p", True)
    assert config.concurrency == 7
    client.post(f"{BASE}/{job['id']}/cancel")


def test_log_lists_what_the_engine_reported(client: TestClient, fake: type[FakeDownloader]) -> None:
    from rayohx.enums import DownloadState, EventType
    from rayohx.events import DownloadEvent

    job = _start(client)
    assert client.get(f"{BASE}/{job['id']}/log").json() == []
    engine = fake.instances[-1]
    engine.events.emit(
        DownloadEvent(
            type=EventType.DOWNLOAD_STARTED,
            download_id=job["id"],
            state=DownloadState.DOWNLOADING,
            message="Started",
        )
    )
    log = client.get(f"{BASE}/{job['id']}/log").json()
    assert [(e["type"], e["state"], e["message"]) for e in log] == [
        ("download_started", "downloading", "Started")
    ]
    client.post(f"{BASE}/{job['id']}/cancel")


def test_log_of_an_unknown_download_is_404(client: TestClient) -> None:
    assert client.get(f"{BASE}/nope/log").status_code == 404


def test_create_saves_inside_download_folder(
    client: TestClient, fake: type[FakeDownloader], tmp_path: Any
) -> None:
    job = _start(client, filename="a.mp4")
    assert fake.instances[-1].kwargs["output"] == tmp_path / "a.mp4"
    client.post(f"{BASE}/{job['id']}/cancel")


@pytest.mark.parametrize("name", ["../x.mp4", "a/b.mp4", "a\\b.mp4", "..", "a:b"])
def test_filename_cannot_escape_folder(client: TestClient, name: str) -> None:
    response = client.post(BASE, json={"url": URL, "filename": name})
    assert response.status_code == 422
    assert client.get(BASE).json() == {"items": []}


def test_create_engine_error_is_422(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from rayohx.errors import RayoHXError

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RayoHXError("bad setup")

    monkeypatch.setattr("rayohx.downloader.Downloader", boom)
    response = client.post(BASE, json={"url": URL})
    assert response.status_code == 422
    assert "bad setup" in response.json()["detail"]
    assert client.get(BASE).json() == {"items": []}


@pytest.mark.parametrize("fmt", ["auto", "ts", "mp4", "segments"])
def test_every_accepted_format_is_supported_by_the_engine(
    client: TestClient, fake: type[FakeDownloader], fmt: str
) -> None:
    job = _start(client, output={"format": fmt})
    assert fake.instances[-1].config.output.format.value == fmt
    client.post(f"{BASE}/{job['id']}/cancel")


@pytest.mark.parametrize(
    "body", [{}, {"url": ""}, {"urls": ["a"] * 101}, {"url": URL, "output": {"format": "mkv"}}]
)
def test_create_validates_body(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(BASE, json=body).status_code == 422


def test_unknown_download_is_404(client: TestClient) -> None:
    response = client.get(f"{BASE}/nope")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "pause"),
        ("post", "resume"),
        ("post", "cancel"),
        ("get", "events"),
        ("get", ""),
        ("delete", ""),
    ],
)
def test_unknown_job_actions_are_404(client: TestClient, method: str, path: str) -> None:
    url = f"{BASE}/nope" + (f"/{path}" if path else "")
    assert getattr(client, method)(url).status_code == 404


def test_events_stream_headers_and_payload(client: TestClient, fake: type[FakeDownloader]) -> None:
    import json

    job = _start(client)
    client.post(f"{BASE}/{job['id']}/cancel")
    _wait_for(client, job["id"], "cancelled")
    response = client.get(f"{BASE}/{job['id']}/events")
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-accel-buffering"] == "no"
    data = [line for line in response.text.splitlines() if line.startswith("data: ")]
    assert len(data) == 1
    assert json.loads(data[0].removeprefix("data: "))["state"] == "cancelled"
    assert response.text.endswith("\n\n")


def test_remove_unknown_vs_running(client: TestClient, fake: type[FakeDownloader]) -> None:
    job = _start(client)
    conflict = client.delete(f"{BASE}/{job['id']}")
    assert conflict.status_code == 409
    assert "Cancel" in conflict.json()["detail"]
    client.post(f"{BASE}/{job['id']}/cancel")


def _post(client: TestClient, **body: object) -> Any:
    return client.post(BASE, json={"url": URL, **body})


def test_local_files_are_refused_by_default(client: TestClient) -> None:
    for network in ({"cookie_file": "/etc/passwd"}, {"client_cert": "/x.pem"}, {"ca_bundle": "/c"}):
        response = _post(client, network=network)
        assert response.status_code == 422, network
        assert "ALLOW_LOCAL_PATHS" in response.json()["detail"]
    assert _post(client, engine={"allow_file_keys": True}).status_code == 422
    assert _post(client, output={"ffmpeg": "/bin/ffmpeg"}).status_code == 422
    assert client.get(BASE).json() == {"items": []}


@pytest.mark.parametrize("bad", ["../x", "/srv/x", "a/../../x"])
def test_folders_cannot_leave_download_dir(client: TestClient, bad: str) -> None:
    assert _post(client, output={"directory": bad}).status_code == 422
    assert _post(client, storage={"workspace": bad}).status_code == 422


def test_conflicting_selection_is_422(client: TestClient) -> None:
    response = _post(client, selection={"variant": 1, "codec": "hevc"})
    assert response.status_code == 422
    assert "variant" in response.json()["detail"]


def test_a_batch_starts_one_job_per_address(client: TestClient, fake: type[FakeDownloader]) -> None:
    response = client.post(
        BASE,
        json={
            "urls": ["https://a.example.com/x.m3u8", "https://b.example.com/x.m3u8"],
            "network": {
                "proxy": {"url": "socks5h://127.0.0.1:1080", "username": "u", "password": "s3cret"},
                "cookies": {"a": "b"},
                "retries": 5,
            },
            "selection": {"codec": "hevc", "max_frame_rate": 30, "audio_names": ["English"]},
            "storage": {"strategy": "buffered", "reserve_bytes": 0},
            "output": {"format": "mp4", "directory": "shows", "validate": False},
            "engine": {"concurrency": 8, "resume": False},
        },
    )
    assert response.status_code == 202
    jobs = response.json()["items"]
    assert len(jobs) == 2
    assert "s3cret" not in str(jobs)
    config = fake.instances[-1].config
    assert config.concurrency == 8
    assert config.resume is False
    assert config.network.retries == 5
    assert config.network.cookies == {"a": "b"}
    assert config.selection.audio_names == ("English",)
    assert config.output.validate is False
    for job in jobs:
        client.post(f"{BASE}/{job['id']}/cancel")


def test_filename_with_a_batch_is_rejected(client: TestClient) -> None:
    response = client.post(
        BASE, json={"urls": ["https://a/x.m3u8", "https://b/x.m3u8"], "filename": "a.mp4"}
    )
    assert response.status_code == 422
    assert client.get(BASE).json() == {"items": []}


def test_playlist_text_is_handed_to_the_engine(
    client: TestClient, fake: type[FakeDownloader]
) -> None:
    response = client.post(BASE, json={"playlist_text": "#EXTM3U", "base_url": URL})
    assert response.status_code == 202
    assert fake.instances[-1].kwargs["playlist_text"] == "#EXTM3U"
    client.post(f"{BASE}/{response.json()['items'][0]['id']}/cancel")


def test_local_paths_are_accepted_when_enabled(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, fake: type[FakeDownloader]
) -> None:
    from fastapi.testclient import TestClient

    from rayohx_api.config import get_settings
    from rayohx_api.main import create_app
    from rayohx_api.routers.v1 import reset_state

    cookies = tmp_path / "c.txt"
    cookies.write_text("# c\n.example.com\tTRUE\t/\tFALSE\t0\tsid\tabc\n")
    monkeypatch.setenv("RAYOHX_API_ALLOW_LOCAL_PATHS", "true")
    monkeypatch.setenv("RAYOHX_API_DOWNLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()
    reset_state()
    local = TestClient(create_app())
    response = local.post(BASE, json={"url": URL, "network": {"cookie_file": str(cookies)}})
    assert response.status_code == 202
    assert fake.instances[-1].config.network.cookies == {"sid": "abc"}
    local.post(f"{BASE}/{response.json()['items'][0]['id']}/cancel")


def test_retry_can_overwrite_an_existing_file_for_that_run(
    client: TestClient, fake: type[FakeDownloader]
) -> None:
    job = _start(client)
    client.post(f"{BASE}/{job['id']}/cancel")
    _wait_for(client, job["id"], "cancelled")
    assert client.post(f"{BASE}/{job['id']}/retry", json={"overwrite": True}).status_code == 200
    assert fake.instances[-1].config.output.overwrite is True
    client.post(f"{BASE}/{job['id']}/cancel")
    _wait_for(client, job["id"], "cancelled")
    assert client.post(f"{BASE}/{job['id']}/retry").status_code == 200
    assert fake.instances[-1].config.output.overwrite is False


def test_an_existing_output_file_is_reported_with_a_code(
    client: TestClient, fake: type[FakeDownloader], monkeypatch: pytest.MonkeyPatch
) -> None:
    from rayohx_api.routers.v1.deps import manager, to_job

    job = _start(client)
    client.post(f"{BASE}/{job['id']}/cancel")
    _wait_for(client, job["id"], "cancelled")
    record = manager().get(job["id"])
    assert record is not None
    record.error = "The output file already exists: x.ts"
    assert to_job(record).error_code == "output_exists"
    record.error = "boom"
    assert to_job(record).error_code is None
