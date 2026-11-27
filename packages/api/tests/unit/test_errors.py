import logging

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from rayohx_api.errors import PROBLEM_JSON, problem, register_error_handlers


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/http")
    def http_error() -> None:
        raise HTTPException(404, "nope", headers={"X-Extra": "1"})

    @app.get("/validate")
    def validate(n: int) -> int:
        return n

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internals")

    return TestClient(app, raise_server_exceptions=False)


def test_problem_builds_body_and_headers() -> None:
    response = problem(409, "clash", headers={"X-A": "b"}, job="1")
    assert response.status_code == 409
    assert response.media_type == PROBLEM_JSON
    assert response.headers["x-a"] == "b"
    assert response.body == (
        b'{"type":"about:blank","title":"Conflict","status":409,"detail":"clash","job":"1"}'
    )


def test_problem_omits_empty_detail() -> None:
    assert b"detail" not in problem(500).body


def test_http_exception_is_problem_json(client: TestClient) -> None:
    response = client.get("/http")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_JSON)
    assert response.headers["x-extra"] == "1"
    assert response.json() == {
        "type": "about:blank",
        "title": "Not Found",
        "status": 404,
        "detail": "nope",
    }


def test_unknown_route_is_problem_json(client: TestClient) -> None:
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith(PROBLEM_JSON)


def test_validation_error_lists_errors(client: TestClient) -> None:
    response = client.get("/validate", params={"n": "x"})
    body = response.json()
    assert response.status_code == 422
    assert body["detail"] == "Request validation failed."
    assert body["errors"][0]["loc"] == ["query", "n"]


def test_unexpected_error_hides_details_and_logs(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.ERROR, logger="rayohx_api.errors"):
        response = client.get("/boom")
    assert response.status_code == 500
    assert response.json() == {
        "type": "about:blank",
        "title": "Internal Server Error",
        "status": 500,
    }
    assert "secret internals" not in response.text
    assert any(r.message == "Unhandled error" for r in caplog.records)
