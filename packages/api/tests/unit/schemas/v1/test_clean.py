import pytest
from pydantic import ValidationError

from rayohx_api.schemas.v1 import CleanedFolder, CleanRequest, CleanResponse


def test_request_defaults_to_dry_run() -> None:
    request = CleanRequest()
    assert request.older_than_days == 0
    assert request.dry_run is True


def test_request_rejects_negative_age() -> None:
    assert CleanRequest(older_than_days=0.5).older_than_days == 0.5
    with pytest.raises(ValidationError):
        CleanRequest(older_than_days=-1)


def test_response_round_trip() -> None:
    response = CleanResponse(
        dry_run=False,
        folders=[CleanedFolder(name="x", size_bytes=3, age_days=1.5)],
        freed_bytes=3,
        skipped_in_use=1,
    )
    assert CleanResponse.model_validate(response.model_dump()) == response


def test_response_requires_all_fields() -> None:
    with pytest.raises(ValidationError):
        CleanResponse(dry_run=True, folders=[])  # type: ignore[call-arg]
