import pytest
from pydantic import ValidationError

from rayohx_api.schemas.v1 import QUALITY, Network, Proxy, Selection, Source, Storage


@pytest.mark.parametrize("value", ["best", "WORST", "Auto", "720p", "1080p", "2160p"])
def test_quality_accepts(value: str) -> None:
    assert Selection(quality=value).quality == value


@pytest.mark.parametrize("value", ["", "fast", "72p", "12345p", "720", "best ", "720px"])
def test_quality_rejects(value: str) -> None:
    with pytest.raises(ValidationError):
        Selection(quality=value)


def test_quality_pattern_is_exported() -> None:
    assert QUALITY.startswith("(?i)")


def test_network_defaults_are_independent() -> None:
    first, second = Network(), Network()
    first.headers["X"] = "1"
    assert second.headers == {}


def test_network_header_limit() -> None:
    Network(headers={str(i): "v" for i in range(32)})
    with pytest.raises(ValidationError):
        Network(headers={str(i): "v" for i in range(33)})


def test_network_collections_are_limited() -> None:
    Network(cookies={str(i): "v" for i in range(64)}, credential_hosts=["h"] * 16)
    with pytest.raises(ValidationError):
        Network(cookies={str(i): "v" for i in range(65)})
    with pytest.raises(ValidationError):
        Network(credential_hosts=["h"] * 17)


def test_proxy_needs_an_address() -> None:
    assert Proxy(url="socks5://h:1").password is None
    with pytest.raises(ValidationError):
        Proxy()  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        Proxy(url="u" * 2049)


@pytest.mark.parametrize("value", ["480p", "1080P"])
def test_max_resolution_accepts_a_height(value: str) -> None:
    assert Selection(max_resolution=value).max_resolution == value


@pytest.mark.parametrize("value", ["1280x720", "high", "p720"])
def test_max_resolution_rejects_other_text(value: str) -> None:
    with pytest.raises(ValidationError):
        Selection(max_resolution=value)


def test_resolution_is_width_by_height() -> None:
    assert Selection(resolution="1280x720").resolution == "1280x720"
    with pytest.raises(ValidationError):
        Selection(resolution="720p")


def test_storage_sizes_must_be_positive_except_the_reserve() -> None:
    assert Storage(reserve_bytes=0).reserve_bytes == 0
    for field in ("buffer_bytes", "max_temp_bytes"):
        with pytest.raises(ValidationError):
            Storage.model_validate({field: 0})
    with pytest.raises(ValidationError):
        Storage(reserve_bytes=-1)


def test_source_defaults_are_independent() -> None:
    first, second = Source(), Source()
    first.urls.append("x")
    assert second.urls == []
    assert first.url is None
