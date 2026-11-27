import httpx
import rayohx


def test_health(base_url: str) -> None:
    assert httpx.get(f"{base_url}/health").json() == {"status": "ok"}


def test_ready_reports_version(base_url: str) -> None:
    assert httpx.get(f"{base_url}/ready").json()["version"] == rayohx.__version__


def test_security_headers(base_url: str) -> None:
    assert httpx.get(f"{base_url}/health").headers["x-content-type-options"] == "nosniff"
