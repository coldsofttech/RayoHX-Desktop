"""Downloads through the real API process, from a real local HLS site to a real file."""

import json
import time
from pathlib import Path

import httpx
import pytest
from rayohx_pytest.hls import HlsServer, expected

from tests.helpers.live import ApiProcess

TERMINAL = ("completed", "failed", "cancelled")


def test_download_completes_and_the_file_matches(tmp_path: Path) -> None:
    with HlsServer(count=8) as site, ApiProcess(tmp_path) as api:
        job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
        done = api.wait_for(job["id"], *TERMINAL)
        assert done["state"] == "completed", done
        assert done["output_path"] == "clip.ts"
        assert done["output_size_bytes"] == len(expected(8))
        assert done["progress"]["fraction"] == 1.0
        assert (tmp_path / "clip.ts").read_bytes() == expected(8)
        assert sorted(site.segment_requests) == list(range(8))
        assert [item["id"] for item in api.client.get("/api/v1/downloads").json()["items"]] == [
            job["id"]
        ]
        assert api.client.delete(f"/api/v1/downloads/{job['id']}").status_code == 204
        assert (tmp_path / "clip.ts").exists()


def test_the_signing_token_is_never_returned(tmp_path: Path) -> None:
    with HlsServer(count=2) as site, ApiProcess(tmp_path) as api:
        job = api.start_download(f"{site.playlist_url}?token=hunter2", format="ts")
        done = api.wait_for(job["id"], *TERMINAL)
        assert "hunter2" not in json.dumps(done)
        assert "hunter2" not in json.dumps(api.client.get("/api/v1/downloads").json())


def test_request_headers_reach_the_origin(tmp_path: Path) -> None:
    with HlsServer(count=2) as site, ApiProcess(tmp_path) as api:
        job = api.start_download(
            site.playlist_url, format="ts", network={"headers": {"X-Test": "yes"}}
        )
        api.wait_for(job["id"], *TERMINAL)
        assert all(seen.get("x-test") == "yes" for seen in site.headers_seen)


def test_event_stream_follows_a_download_to_the_end(tmp_path: Path) -> None:
    with HlsServer(count=6, delay=0.2) as site, ApiProcess(tmp_path) as api:
        job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
        states: list[str] = []
        with httpx.stream(
            "GET", f"{api.url}/api/v1/downloads/{job['id']}/events", timeout=30
        ) as response:
            assert response.headers["content-type"].startswith("text/event-stream")
            assert response.headers["cache-control"] == "no-store"
            for line in response.iter_lines():
                if line.startswith("data: "):
                    states.append(json.loads(line.removeprefix("data: "))["state"])
        assert states[-1] == "completed"
        assert len(states) >= 2
        assert states == [s for i, s in enumerate(states) if i == 0 or s != states[i - 1]]


def test_a_client_that_drops_the_stream_does_not_stop_the_download(tmp_path: Path) -> None:
    with HlsServer(count=4, delay=0.3) as site, ApiProcess(tmp_path) as api:
        job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
        with httpx.stream("GET", f"{api.url}/api/v1/downloads/{job['id']}/events") as response:
            next(response.iter_lines())
        assert api.wait_for(job["id"], *TERMINAL)["state"] == "completed"
        assert api.client.get("/health").status_code == 200


def test_pause_stops_new_segments_and_resume_finishes(tmp_path: Path) -> None:
    with HlsServer(count=12, delay=0.3) as site, ApiProcess(tmp_path) as api:
        api.client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 1}})
        job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
        while len(site.segment_requests) < 2:
            time.sleep(0.05)
        assert api.client.post(f"/api/v1/downloads/{job['id']}/pause").status_code == 200
        api.wait_for(job["id"], "paused")
        time.sleep(0.6)  # let the segment that was already being fetched finish
        settled = len(site.segment_requests)
        time.sleep(1.0)
        assert len(site.segment_requests) == settled
        assert settled < 12
        api.client.post(f"/api/v1/downloads/{job['id']}/resume")
        assert api.wait_for(job["id"], *TERMINAL)["state"] == "completed"
        assert sorted(site.segment_requests) == list(range(12))
        assert (tmp_path / "clip.ts").read_bytes() == expected(12)


def test_cancel_stops_the_download_and_leaves_no_output(tmp_path: Path) -> None:
    with HlsServer(count=10, delay=0.3) as site, ApiProcess(tmp_path) as api:
        api.client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 1}})
        job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
        while not site.segment_requests:
            time.sleep(0.05)
        api.client.post(f"/api/v1/downloads/{job['id']}/cancel")
        assert api.wait_for(job["id"], *TERMINAL)["state"] == "cancelled"
        assert len(set(site.segment_requests)) < 10
        assert not (tmp_path / "clip.ts").exists()
        assert api.client.delete(f"/api/v1/downloads/{job['id']}").status_code == 204


def test_downloads_beyond_the_limit_wait_in_the_queue(tmp_path: Path) -> None:
    with (
        HlsServer(count=4, gate_from=0) as site,
        ApiProcess(tmp_path, max_active_downloads="1") as api,
    ):
        first = api.start_download(site.playlist_url, filename="a.ts", format="ts")
        second = api.start_download(site.playlist_url, filename="b.ts", format="ts")
        while not site.segment_requests:
            time.sleep(0.05)
        time.sleep(0.5)
        assert api.job(first["id"])["state"] != "queued"
        assert api.job(second["id"])["state"] == "queued"
        site.release()
        assert api.wait_for(first["id"], *TERMINAL)["state"] == "completed"
        assert api.wait_for(second["id"], *TERMINAL)["state"] == "completed"
        assert (tmp_path / "b.ts").read_bytes() == expected(4)


def test_a_queued_download_cancels_at_once(tmp_path: Path) -> None:
    with (
        HlsServer(count=4, gate_from=0) as site,
        ApiProcess(tmp_path, max_active_downloads="1") as api,
    ):
        api.start_download(site.playlist_url, filename="a.ts", format="ts")
        queued = api.start_download(site.playlist_url, filename="b.ts", format="ts")
        response = api.client.post(f"/api/v1/downloads/{queued['id']}/cancel")
        assert response.json()["state"] == "cancelled"
        site.release()
        time.sleep(0.5)
        assert not (tmp_path / "b.ts").exists()


def test_a_killed_server_resumes_instead_of_starting_over(tmp_path: Path) -> None:
    count = 20
    with HlsServer(count=count, delay=0.25) as site:
        with ApiProcess(tmp_path) as first:
            first.client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 1}})
            job = first.start_download(site.playlist_url, filename="clip.ts", format="ts")
            # The engine saves its place every 2 seconds or 16 segments; die after the first save.
            while len(set(site.segment_requests)) < 12:
                time.sleep(0.05)
            first.stop(kill=True)
        site.requests.clear()
        with ApiProcess(tmp_path) as second:
            second.client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 1}})
            again = second.start_download(site.playlist_url, filename="clip.ts", format="ts")
            assert second.wait_for(again["id"], *TERMINAL)["state"] == "completed"
        assert job["id"] != again["id"]
        assert len(site.segment_requests) < count
        assert (tmp_path / "clip.ts").read_bytes() == expected(count)


def test_clean_leaves_running_downloads_alone_and_removes_leftovers(tmp_path: Path) -> None:
    with HlsServer(count=8, delay=0.3) as site:
        with ApiProcess(tmp_path) as api:
            api.client.put("/api/v1/settings/defaults", json={"engine": {"concurrency": 1}})
            job = api.start_download(site.playlist_url, filename="clip.ts", format="ts")
            while len(set(site.segment_requests)) < 3:
                time.sleep(0.05)
            during = api.client.post("/api/v1/clean", json={"dry_run": False}).json()
            assert during["folders"] == []
            assert during["skipped_in_use"] >= 1
            api.stop(kill=True)
        leftovers = [p for p in tmp_path.iterdir() if p.name.startswith(".rayohx-")]
        assert leftovers, "a killed download should leave its working folder behind"
        with ApiProcess(tmp_path) as api:
            dry = api.client.post("/api/v1/clean", json={}).json()
            assert [f["name"] for f in dry["folders"]] == [p.name for p in leftovers]
            assert dry["freed_bytes"] > 0
            assert all(p.exists() for p in leftovers)
            done = api.client.post("/api/v1/clean", json={"dry_run": False}).json()
            assert done["freed_bytes"] == dry["freed_bytes"]
        assert not any(p.exists() for p in leftovers)
        assert job["id"]


@pytest.mark.parametrize(
    "fmt",
    [
        "auto",
        "mp4",
        "ts",
        "segments",
    ],
)
def test_every_format_the_schema_accepts_starts_a_download(tmp_path: Path, fmt: str) -> None:
    with HlsServer(count=2) as site, ApiProcess(tmp_path) as api:
        response = api.client.post(
            "/api/v1/downloads", json={"url": site.playlist_url, "output": {"format": fmt}}
        )
        assert response.status_code == 202, response.text
        api.wait_for(response.json()["items"][0]["id"], *TERMINAL)
