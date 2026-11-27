import json
import logging
import sys
from collections.abc import Iterator
from types import TracebackType

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rayohx_api.logs import (
    REQUEST_ID_HEADER,
    JsonFormatter,
    RequestIdMiddleware,
    configure_logging,
    request_id_var,
)


@pytest.fixture
def restore_root_logger() -> Iterator[None]:
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    yield
    root.handlers[:] = handlers
    root.setLevel(level)


def _record(
    exc_info: tuple[type[BaseException], BaseException, TracebackType | None] | None = None,
) -> logging.LogRecord:
    return logging.LogRecord("name", logging.WARNING, __file__, 1, "hi %s", ("there",), exc_info)


def test_formatter_emits_json_with_request_id() -> None:
    token = request_id_var.set("abc")
    try:
        payload = json.loads(JsonFormatter().format(_record()))
    finally:
        request_id_var.reset(token)
    assert payload["level"] == "WARNING"
    assert payload["logger"] == "name"
    assert payload["message"] == "hi there"
    assert payload["request_id"] == "abc"
    assert "exception" not in payload


def test_formatter_defaults_request_id_and_includes_exception() -> None:
    try:
        raise ValueError("bad")
    except ValueError:
        exc_info = sys.exc_info()
    assert exc_info[0] is not None
    payload = json.loads(JsonFormatter().format(_record(exc_info)))
    assert payload["request_id"] == "-"
    assert "ValueError: bad" in payload["exception"]


@pytest.mark.usefixtures("restore_root_logger")
def test_configure_logging_installs_single_json_handler() -> None:
    configure_logging("debug")
    root = logging.getLogger()
    assert len(root.handlers) == 1
    assert isinstance(root.handlers[0].formatter, JsonFormatter)
    assert root.level == logging.DEBUG


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/id")
    def current() -> dict[str, str]:
        return {"id": request_id_var.get()}

    return TestClient(app)


def test_middleware_generates_request_id(client: TestClient) -> None:
    response = client.get("/id")
    generated = response.headers[REQUEST_ID_HEADER]
    assert len(generated) == 32
    assert response.json() == {"id": generated}


def test_middleware_reuses_caller_request_id_and_resets(client: TestClient) -> None:
    response = client.get("/id", headers={REQUEST_ID_HEADER: "mine"})
    assert response.headers[REQUEST_ID_HEADER] == "mine"
    assert response.json() == {"id": "mine"}
    assert request_id_var.get() == "-"
