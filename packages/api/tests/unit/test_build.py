from pathlib import Path
from typing import Any

import pytest
from rayohx.errors import ConfigurationError

from rayohx_api.build import (
    DEFAULT_CONCURRENCY,
    download_config,
    local_path,
    network_config,
    read_cookie_file,
    sources,
    subfolder,
)
from rayohx_api.schemas.v1 import DownloadCreate, InspectRequest, Network

URL = "https://cdn.example.com/m.m3u8"


def _request(**body: Any) -> DownloadCreate:
    return DownloadCreate.model_validate({"url": URL, **body})


@pytest.mark.parametrize("name", ["../x", "/srv/x", "a/../../x", "a\0b"])
def test_subfolder_refuses_to_leave_the_base(tmp_path: Path, name: str) -> None:
    with pytest.raises(ConfigurationError, match="inside the download folder"):
        subfolder(tmp_path, name, "output folder")


def test_subfolder_resolves_inside_the_base(tmp_path: Path) -> None:
    assert subfolder(tmp_path, "shows/s1", "output folder") == (tmp_path / "shows" / "s1").resolve()
    assert subfolder(tmp_path, None, "output folder") is None
    assert subfolder(tmp_path, "", "output folder") is None


def test_subfolder_refuses_a_link_that_leaves_the_base(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    base = tmp_path / "base"
    base.mkdir()
    try:
        (base / "link").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("symbolic links are not available")
    with pytest.raises(ConfigurationError):
        subfolder(base, "link", "output folder")


def test_local_path_needs_permission() -> None:
    assert local_path(None, allowed=False, what="The file") is None
    with pytest.raises(ConfigurationError, match="does not allow") as refused:
        local_path("/etc/passwd", allowed=False, what="The file")
    assert "ALLOW_LOCAL_PATHS" in str(refused.value.hint)
    assert local_path("~/x", allowed=True, what="The file") == Path("~/x").expanduser()


def test_read_cookie_file(tmp_path: Path) -> None:
    jar = tmp_path / "c.txt"
    jar.write_text(
        "# Netscape\n\n.example.com\tTRUE\t/\tFALSE\t0\tsid\tabc\n"
        "#HttpOnly_.example.com\tTRUE\t/\tTRUE\t0\ttok\txyz\n"
    )
    assert read_cookie_file(jar) == {"sid": "abc", "tok": "xyz"}


def test_read_cookie_file_rejects_other_formats(tmp_path: Path) -> None:
    bad = tmp_path / "bad.txt"
    bad.write_text("nope\n")
    with pytest.raises(ConfigurationError, match=r"cookies.txt"):
        read_cookie_file(bad)


def test_read_cookie_file_reports_unreadable_files(tmp_path: Path) -> None:
    with pytest.raises(ConfigurationError, match="cannot be read"):
        read_cookie_file(tmp_path / "missing.txt")


def test_network_defaults_leave_the_engine_defaults() -> None:
    from rayohx.config import NetworkConfig

    config = network_config(Network(), local=False)
    assert config.retries == NetworkConfig().retries
    assert config.user_agent == NetworkConfig().user_agent
    assert config.verify_tls is True


def test_network_headers_win_over_referer_and_origin_shortcuts() -> None:
    net = Network(
        referer="https://a.test", origin="https://o.test", headers={"referer": "https://b"}
    )
    headers = dict(network_config(net, local=False).headers)
    assert headers["referer"] == "https://b"
    assert "Referer" not in headers
    assert headers["Origin"] == "https://o.test"


def test_network_options_reach_the_engine(tmp_path: Path) -> None:
    net = Network.model_validate(
        {
            "user_agent": "agent",
            "retries": 3,
            "backoff": 0.5,
            "max_redirects": 4,
            "rate_limit": 1000,
            "timeout": 60,
            "connect_timeout": 5,
            "read_timeout": 10,
            "env_proxy": True,
            "credential_hosts": ["CDN.example.com"],
            "cookies": {"a": "b"},
            "proxy": {"url": "http://p.test:8080", "username": "u", "password": "pw"},
        }
    )
    config = network_config(net, local=False)
    assert (config.user_agent, config.retries, config.max_redirects) == ("agent", 3, 4)
    assert config.rate_limit == 1000
    assert config.total_timeout == 60
    assert config.proxy_from_env is True
    assert config.credential_hosts == ("cdn.example.com",)
    assert config.proxy is not None
    assert config.proxy.password == "pw"


def test_inline_cookies_override_the_cookie_file(tmp_path: Path) -> None:
    jar = tmp_path / "c.txt"
    jar.write_text(".example.com\tTRUE\t/\tFALSE\t0\tsid\tfile\n")
    net = Network(cookie_file=str(jar), cookies={"sid": "inline"})
    assert dict(network_config(net, local=True).cookies) == {"sid": "inline"}


def test_insecure_turns_tls_checks_off_and_a_bundle_replaces_them(tmp_path: Path) -> None:
    assert network_config(Network(insecure=True), local=False).verify_tls is False
    bundle = tmp_path / "ca.pem"
    assert network_config(Network(ca_bundle=str(bundle)), local=True).verify_tls == bundle


def test_download_config_maps_every_group(tmp_path: Path) -> None:
    config = download_config(
        _request(
            selection={"quality": "720p", "codec": "hevc", "audio": ["en"], "subtitles": ["fr"]},
            storage={"strategy": "buffered", "buffer_bytes": 1024, "keep_state": False},
            output={"format": "ts", "directory": "shows", "overwrite": True, "validate": False},
            engine={"resume": False},
        ),
        base=tmp_path,
        local=False,
    )
    assert config.concurrency == DEFAULT_CONCURRENCY
    assert config.resume is False
    assert config.selection.codec == "hevc"
    assert config.selection.subtitle_languages == ("fr",)
    assert config.storage.strategy.value == "buffered"
    assert config.storage.buffer_bytes == 1024
    assert config.storage.keep_state_on_failure is False
    assert config.output.directory == (tmp_path / "shows").resolve()
    assert (config.output.format.value, config.output.overwrite) == ("ts", True)
    assert config.output.validate is False


def test_download_config_defaults_to_the_download_folder(tmp_path: Path) -> None:
    config = download_config(_request(), base=tmp_path, local=False)
    assert config.output.directory == tmp_path
    assert config.storage.workspace_dir is None


def test_a_request_concurrency_beats_the_default(tmp_path: Path) -> None:
    config = download_config(_request(engine={"concurrency": 9}), base=tmp_path, local=False)
    assert config.concurrency == 9


def test_file_keys_and_ffmpeg_need_permission(tmp_path: Path) -> None:
    with pytest.raises(ConfigurationError, match="key files"):
        download_config(_request(engine={"allow_file_keys": True}), base=tmp_path, local=False)
    allowed = download_config(
        _request(engine={"allow_file_keys": True}, output={"ffmpeg": "/bin/ffmpeg"}),
        base=tmp_path,
        local=True,
    )
    assert allowed.allow_file_keys is True
    assert allowed.output.ffmpeg_path == Path("/bin/ffmpeg")


def test_sources_collects_url_and_urls() -> None:
    assert sources(DownloadCreate(url=URL, urls=["https://b/x.m3u8"])) == [URL, "https://b/x.m3u8"]
    assert sources(InspectRequest(urls=["https://b/x.m3u8"])) == ["https://b/x.m3u8"]


def test_sources_uses_the_base_address_for_playlist_text() -> None:
    request = DownloadCreate(playlist_text="#EXTM3U", base_url=URL)
    assert sources(request) == [URL]


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ({}, "nothing to download"),
        ({"playlist_text": "#EXTM3U"}, "base address"),
        ({"playlist_text": "#EXTM3U", "base_url": URL, "url": URL}, "not both"),
        ({"base_url": URL, "url": URL}, "only used together"),
    ],
)
def test_sources_rejects_unusable_requests(body: dict[str, str], message: str) -> None:
    with pytest.raises(ConfigurationError, match=message):
        sources(DownloadCreate.model_validate(body))
