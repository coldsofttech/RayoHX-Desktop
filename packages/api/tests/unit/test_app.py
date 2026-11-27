"""The assembled app, end to end. Per-module behavior lives in the matching ``test_<module>.py``."""

from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from rayohx_api.auth import Principal, authenticate
from rayohx_api.config import get_settings
from rayohx_api.main import create_app


class Item(BaseModel):
    name: str


def test_invalid_body_lists_errors() -> None:
    app = create_app()

    @app.post("/items")
    def create_item(body: Item) -> Item:
        return body

    response = TestClient(app).post("/items", json={})

    assert response.status_code == 422
    assert response.json()["errors"]


def test_unexpected_errors_do_not_leak_details() -> None:
    app = create_app()

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret detail")

    response = TestClient(app, raise_server_exceptions=False).get("/boom")

    assert response.status_code == 500
    assert "secret" not in response.text
    assert response.json()["title"] == "Internal Server Error"


def _app_with_whoami(*, embedded: bool = False) -> FastAPI:
    app = create_app(embedded=embedded)

    @app.get("/whoami")
    def whoami(principal: Annotated[Principal, Depends(authenticate)]) -> dict[str, str]:
        return {"subject": principal.subject, "method": principal.method}

    return app


class TestAuth:
    @pytest.fixture(autouse=True)
    def _api_key_mode(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "api_key")
        monkeypatch.setenv("RAYOHX_API_API_KEYS", '["s3cret"]')
        get_settings.cache_clear()

    def test_whoami_needs_a_valid_key(self) -> None:
        client = TestClient(_app_with_whoami())

        missing = client.get("/whoami")
        wrong = client.get("/whoami", headers={"X-API-Key": "nope"})
        valid = client.get("/whoami", headers={"X-API-Key": "s3cret"})

        assert missing.status_code == wrong.status_code == 401
        assert missing.headers["WWW-Authenticate"] == "ApiKey"
        assert valid.json() == {"subject": "api-key", "method": "api_key"}

    def test_embedded_app_trusts_cornea_instead(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("RAYOHX_API_API_KEYS")
        get_settings.cache_clear()

        response = TestClient(_app_with_whoami(embedded=True)).get("/whoami")

        assert response.json() == {"subject": "cornea-session", "method": "cornea"}

    def test_auth_can_be_switched_off(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "none")
        get_settings.cache_clear()

        response = TestClient(_app_with_whoami()).get("/whoami")

        assert response.json() == {"subject": "anonymous", "method": "none"}
