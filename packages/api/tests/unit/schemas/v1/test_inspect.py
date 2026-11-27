import pytest
from pydantic import ValidationError

from rayohx_api.schemas.v1 import InspectRequest, InspectResponse

URL = "https://example.test/master.m3u8"


def test_request_defaults() -> None:
    request = InspectRequest(url=URL)
    assert request.url == URL
    assert request.urls == []
    assert request.network.headers == {}


@pytest.mark.parametrize(
    "data",
    [
        {"url": "u" * 4097},
        {"urls": ["x"] * 101},
        {"base_url": "b" * 4097},
        {"network": {"retries": 99}},
    ],
)
def test_request_rejects_invalid(data: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        InspectRequest.model_validate(data)


def test_request_takes_playlist_text_and_a_base_address() -> None:
    request = InspectRequest(playlist_text="#EXTM3U", base_url=URL)
    assert request.url is None
    assert request.playlist_text == "#EXTM3U"


def test_response_wraps_plain_data() -> None:
    assert InspectResponse(playlist={"kind": "master", "n": [1]}).playlist["kind"] == "master"
    with pytest.raises(ValidationError):
        InspectResponse(playlist="text")  # type: ignore[arg-type]
