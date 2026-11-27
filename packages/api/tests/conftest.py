from collections.abc import Iterator
from pathlib import Path

import pytest

from rayohx_api.config import get_settings


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Mark every test in an ``integration`` folder (core, cli, api, ui) as an integration test."""
    for item in items:
        if "integration" in item.path.parts:
            item.add_marker(pytest.mark.integration)


@pytest.fixture(autouse=True)
def _fresh_state(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    """Give every test new settings, with no API key needed and its own database file."""
    monkeypatch.setenv("RAYOHX_API_DB_PATH", str(tmp_path / "rayohx.db"))
    monkeypatch.setenv("RAYOHX_API_AUTH_MODE", "none")
    monkeypatch.delenv("RAYOHX_API_API_KEYS", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
