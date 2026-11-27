"""Inspect, auth and request limits against the real API process."""

from pathlib import Path

import httpx
from rayohx_pytest.hls import HlsServer
from rayohx_pytest.servers import free_port

from tests.helpers.live import ApiProcess


def test_inspect_lists_the_variants_of_a_real_master_playlist(tmp_path: Path) -> None:
    with HlsServer() as site, ApiProcess(tmp_path) as api:
        response = api.client.post("/api/v1/inspect", json={"url": site.master_url})
        assert response.status_code == 200
        variants = response.json()["playlist"]["variants"]
        assert [v["resolution"] for v in variants] == ["640x360", "1280x720"]


def test_inspect_sends_the_given_headers_to_the_origin(tmp_path: Path) -> None:
    with HlsServer() as site, ApiProcess(tmp_path) as api:
        api.client.post(
            "/api/v1/inspect",
            json={"url": site.master_url, "network": {"headers": {"X-Test": "yes"}}},
        )
        assert site.headers_seen[0]["x-test"] == "yes"


def test_inspect_an_unreachable_host_is_a_clean_422(tmp_path: Path) -> None:
    with ApiProcess(tmp_path) as api:
        # The engine retries a refused connection with a backoff before it gives up.
        response = api.client.post(
            "/api/v1/inspect",
            json={"url": f"http://127.0.0.1:{free_port()}/index.m3u8"},
            timeout=90,
        )
        assert response.status_code == 422
        assert response.headers["content-type"].startswith("application/problem+json")


def test_inspect_a_missing_playlist_is_a_clean_422(tmp_path: Path) -> None:
    with HlsServer() as site, ApiProcess(tmp_path) as api:
        assert (
            api.client.post("/api/v1/inspect", json={"url": f"{site.url}/gone.m3u8"}).status_code
            == 422
        )


def test_routes_need_the_api_key_over_a_real_socket(tmp_path: Path) -> None:
    with ApiProcess(tmp_path, auth_mode="api_key", api_keys='["s3cret"]') as api:
        assert api.client.get("/health").status_code == 200
        assert api.client.get("/api/v1/settings").status_code == 401
        wrong = api.client.get("/api/v1/settings", headers={"X-API-Key": "nope"})
        assert wrong.status_code == 401
        assert wrong.headers["www-authenticate"] == "ApiKey"
        ok = api.client.get("/api/v1/settings", headers={"X-API-Key": "s3cret"})
        assert ok.status_code == 200
        assert ok.headers["cache-control"] == "no-store"
        assert ok.headers["x-frame-options"] == "DENY"
        assert "default-src 'none'" in ok.headers["content-security-policy"]


def test_downloads_need_the_api_key_too(tmp_path: Path) -> None:
    with (
        HlsServer(count=1) as site,
        ApiProcess(tmp_path, auth_mode="api_key", api_keys='["s3cret"]') as api,
    ):
        body = {"url": site.playlist_url, "output": {"format": "ts"}}
        assert api.client.post("/api/v1/downloads", json=body).status_code == 401
        assert site.segment_requests == []
        ok = api.client.post("/api/v1/downloads", json=body, headers={"X-API-Key": "s3cret"})
        assert ok.status_code == 202


def test_an_oversized_body_is_413_before_it_is_read(tmp_path: Path) -> None:
    with ApiProcess(tmp_path, max_body_bytes="200") as api:
        big = {"url": "http://127.0.0.1:1/" + "a" * 500}
        response = api.client.post("/api/v1/inspect", json=big)
        assert response.status_code == 413
        assert response.headers["content-type"].startswith("application/problem+json")
        assert api.client.get("/health").status_code == 200


def test_every_response_carries_a_request_id(tmp_path: Path) -> None:
    with ApiProcess(tmp_path) as api:
        assert (
            api.client.get("/health", headers={"X-Request-ID": "abc"}).headers["x-request-id"]
            == "abc"
        )
        assert httpx.get(f"{api.url}/health").headers["x-request-id"]
