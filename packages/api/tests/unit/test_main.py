import pytest
from fastapi.testclient import TestClient

from rayohx_api.auth import authenticate, embedded_principal
from rayohx_api.config import get_settings
from rayohx_api.logs import REQUEST_ID_HEADER
from rayohx_api.main import create_app


def test_standalone_refuses_to_start_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    get_settings.cache_clear()
    with pytest.raises(ValueError, match="RAYOHX_API_API_KEYS"):
        create_app()


def test_embedded_starts_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    get_settings.cache_clear()
    app = create_app(embedded=True)
    assert app.dependency_overrides[authenticate] is embedded_principal


def test_standalone_has_no_auth_override() -> None:
    assert authenticate not in create_app().dependency_overrides


def test_docs_hidden_by_default() -> None:
    client = TestClient(create_app())
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_docs_can_be_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_DOCS_ENABLED", "true")
    get_settings.cache_clear()
    client = TestClient(create_app())
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/docs").status_code == 200


def test_openapi_title_and_v1_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_DOCS_ENABLED", "true")
    get_settings.cache_clear()
    spec = TestClient(create_app()).get("/openapi.json").json()
    assert spec["info"]["title"] == "rayohx-api"
    assert any(path.startswith("/api/v1/") for path in spec["paths"])


def test_responses_carry_request_id() -> None:
    response = TestClient(create_app()).get("/health", headers={REQUEST_ID_HEADER: "rid"})
    assert response.status_code == 200
    assert response.headers[REQUEST_ID_HEADER] == "rid"


def test_security_headers_only_when_standalone() -> None:
    standalone = TestClient(create_app()).get("/health").headers
    embedded = TestClient(create_app(embedded=True)).get("/health").headers
    assert set(embedded) < set(standalone)


def test_cors_enabled_only_for_configured_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_CORS_ORIGINS", '["http://ui.test"]')
    get_settings.cache_clear()
    client = TestClient(create_app())
    allowed = client.get("/health", headers={"Origin": "http://ui.test"})
    denied = client.get("/health", headers={"Origin": "http://evil.test"})
    assert allowed.headers["access-control-allow-origin"] == "http://ui.test"
    assert "access-control-allow-origin" not in denied.headers
