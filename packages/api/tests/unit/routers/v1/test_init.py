import pytest
from fastapi.testclient import TestClient

from rayohx_api.config import get_settings
from rayohx_api.main import create_app
from rayohx_api.routers import v1

PROTECTED = [
    ("get", "/api/v1/settings"),
    ("patch", "/api/v1/settings"),
    ("get", "/api/v1/downloads"),
    ("post", "/api/v1/downloads"),
    ("get", "/api/v1/downloads/x"),
    ("post", "/api/v1/inspect"),
    ("post", "/api/v1/clean"),
]


def test_exports() -> None:
    assert sorted(v1.__all__) == ["reset_state", "router"]


def test_all_route_modules_are_mounted() -> None:
    paths = set(create_app().openapi()["paths"])
    expected = {"/inspect", "/downloads", "/downloads/{job_id}", "/settings", "/clean"}
    assert {f"/api/v1{path}" for path in expected} <= paths


@pytest.fixture
def secured(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    monkeypatch.setenv("RAYOHX_API_API_KEYS", '["s3cret"]')
    get_settings.cache_clear()
    return TestClient(create_app())


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_every_route_requires_an_api_key(secured: TestClient, method: str, path: str) -> None:
    assert getattr(secured, method)(path).status_code == 401
    assert getattr(secured, method)(path, headers={"X-API-Key": "bad"}).status_code == 401


def test_valid_key_reaches_the_route(secured: TestClient) -> None:
    response = secured.get("/api/v1/settings", headers={"X-API-Key": "s3cret"})
    assert response.status_code == 200


def test_embedded_app_skips_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
    monkeypatch.delenv("RAYOHX_API_API_KEYS", raising=False)
    get_settings.cache_clear()
    assert TestClient(create_app(embedded=True)).get("/api/v1/settings").status_code == 200
