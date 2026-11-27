from fastapi.testclient import TestClient
from rayohx import __version__


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_library_version(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "version": __version__}


def test_probes_need_no_api_key(monkeypatch, client: TestClient) -> None:  # type: ignore[no-untyped-def]
    from rayohx_api.config import get_settings
    from rayohx_api.main import create_app

    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    monkeypatch.setenv("RAYOHX_API_API_KEYS", '["k"]')
    get_settings.cache_clear()
    secured = TestClient(create_app())
    assert secured.get("/health").status_code == 200
    assert secured.get("/ready").status_code == 200


def test_probes_reject_other_methods(client: TestClient) -> None:
    assert client.post("/health").status_code == 405
    assert client.post("/ready").status_code == 405
