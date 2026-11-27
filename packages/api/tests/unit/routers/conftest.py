from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rayohx_api.config import get_settings
from rayohx_api.main import create_app
from rayohx_api.routers.v1 import reset_state


@pytest.fixture(autouse=True)
def _fresh_jobs() -> Iterator[None]:
    """Jobs and preferences live in a process-wide cache; start and end each test without them."""
    reset_state()
    yield
    reset_state()


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    monkeypatch.setenv("RAYOHX_API_DOWNLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()
    reset_state()
    return TestClient(create_app())
