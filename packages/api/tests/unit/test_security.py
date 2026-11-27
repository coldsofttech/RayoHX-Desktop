import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rayohx_api.config import get_settings
from rayohx_api.errors import PROBLEM_JSON
from rayohx_api.main import create_app
from rayohx_api.security import (
    API_CSP,
    HSTS,
    BodyLimitMiddleware,
    SecurityHeadersMiddleware,
)


def _headers_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)

    for path in ("/plain", "/api/ping", "/docs", "/redoc", "/docs/oauth2", "/apix"):

        def handler() -> dict[str, bool]:
            return {"ok": True}

        app.get(path)(handler)

    @app.get("/own")
    def own() -> object:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {}, headers={"X-Frame-Options": "SAMEORIGIN", "Content-Security-Policy": "mine"}
        )

    return app


@pytest.fixture
def headers_client() -> TestClient:
    return TestClient(_headers_app())


def test_baseline_headers(headers_client: TestClient) -> None:
    headers = headers_client.get("/plain").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert headers["Content-Security-Policy"] == API_CSP
    assert "frame-ancestors 'none'" in API_CSP


def test_api_paths_are_not_cached(headers_client: TestClient) -> None:
    assert headers_client.get("/api/ping").headers["Cache-Control"] == "no-store"
    assert "Cache-Control" not in headers_client.get("/plain").headers
    assert "Cache-Control" not in headers_client.get("/apix").headers


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/docs/oauth2"])
def test_docs_get_no_csp_but_keep_other_headers(headers_client: TestClient, path: str) -> None:
    headers = headers_client.get(path).headers
    assert "Content-Security-Policy" not in headers
    assert headers["X-Content-Type-Options"] == "nosniff"


def test_hsts_only_over_https() -> None:
    app = _headers_app()
    assert TestClient(app).get("/plain").headers.get("Strict-Transport-Security") is None
    secure = TestClient(app, base_url="https://testserver").get("/plain")
    assert secure.headers["Strict-Transport-Security"] == HSTS


def test_existing_headers_are_not_overwritten(headers_client: TestClient) -> None:
    headers = headers_client.get("/own").headers
    assert headers["X-Frame-Options"] == "SAMEORIGIN"
    assert headers["Content-Security-Policy"] == "mine"


def test_headers_are_added_to_error_responses(headers_client: TestClient) -> None:
    response = headers_client.get("/missing")
    assert response.status_code == 404
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def _limit_app(max_bytes: int) -> TestClient:
    app = FastAPI()
    app.add_middleware(BodyLimitMiddleware, max_bytes=max_bytes)

    @app.post("/echo")
    async def echo(payload: dict[str, str]) -> dict[str, str]:
        return payload

    return TestClient(app)


def test_body_at_the_limit_is_accepted() -> None:
    body = b'{"a":"b"}'
    response = _limit_app(len(body)).post(
        "/echo", content=body, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200


def test_body_over_the_limit_is_413_problem() -> None:
    body = b'{"a":"b"}'
    response = _limit_app(len(body) - 1).post(
        "/echo", content=body, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert response.headers["content-type"].startswith(PROBLEM_JSON)
    assert response.json() == {
        "type": "about:blank",
        "title": "Content Too Large",
        "status": 413,
        "detail": f"Request body is larger than {len(body) - 1} bytes.",
    }


def test_requests_without_a_body_pass() -> None:
    app = FastAPI()
    app.add_middleware(BodyLimitMiddleware, max_bytes=1)

    @app.get("/ok")
    def ok() -> dict[str, bool]:
        return {"ok": True}

    assert TestClient(app).get("/ok").status_code == 200


@pytest.mark.parametrize("declared", ["abc", "-5", "", "1.5"])
def test_malformed_content_length_is_ignored(declared: str) -> None:
    app = FastAPI()
    app.add_middleware(BodyLimitMiddleware, max_bytes=1)

    @app.get("/ok")
    def ok() -> dict[str, bool]:
        return {"ok": True}

    assert TestClient(app).get("/ok", headers={"Content-Length": declared}).status_code != 413


def test_create_app_uses_configured_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAYOHX_API_MAX_BODY_BYTES", "10")
    get_settings.cache_clear()
    app = create_app()

    @app.post("/items")
    def items(body: dict[str, str]) -> dict[str, str]:
        return body

    assert TestClient(app).post("/items", json={"name": "A" * 50}).status_code == 413


def test_embedded_app_keeps_body_limit_but_drops_security_headers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RAYOHX_API_MAX_BODY_BYTES", "10")
    get_settings.cache_clear()
    client = TestClient(create_app(embedded=True))
    assert "X-Frame-Options" not in client.get("/health").headers
    assert client.post("/health", content=b"x" * 50).status_code == 413
