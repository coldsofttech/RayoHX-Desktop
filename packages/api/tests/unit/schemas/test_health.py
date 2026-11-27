import pytest
from pydantic import ValidationError

from rayohx_api.schemas import HealthResponse, ReadyResponse


def test_health_defaults() -> None:
    assert HealthResponse().model_dump() == {"status": "ok"}


def test_health_rejects_other_status() -> None:
    with pytest.raises(ValidationError):
        HealthResponse(status="down")  # type: ignore[arg-type]


def test_ready_requires_version() -> None:
    assert ReadyResponse(version="1.0").model_dump() == {"status": "ready", "version": "1.0"}
    with pytest.raises(ValidationError):
        ReadyResponse()  # type: ignore[call-arg]
