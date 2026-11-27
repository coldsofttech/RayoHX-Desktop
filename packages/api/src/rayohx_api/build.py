"""Turns an API request into the engine's settings. Holds the rules for what a client may ask."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

    from rayohx.config import DownloadConfig, NetworkConfig

    from rayohx_api.schemas.v1.common import Network
    from rayohx_api.schemas.v1.downloads import DownloadCreate
    from rayohx_api.schemas.v1.inspect import InspectRequest

LOCAL_PATHS_HINT = "Set RAYOHX_API_ALLOW_LOCAL_PATHS=true if you trust every client."

DEFAULT_CONCURRENCY = 4


def subfolder(base: Path, name: str | None, what: str) -> Path | None:
    """A folder inside ``base`` named by a client. It can never lead outside ``base``."""
    from pathlib import Path

    from rayohx.errors import ConfigurationError

    if not name:
        return None
    candidate = Path(name)
    if candidate.is_absolute() or ".." in candidate.parts or "\0" in name:
        raise ConfigurationError(
            f"The {what} must be a folder inside the download folder.",
            hint="Use a relative name such as shows/season1.",
        )
    resolved = (base / candidate).resolve()
    if not resolved.is_relative_to(base.resolve()):
        raise ConfigurationError(f"The {what} must be inside the download folder.")
    return resolved


def local_path(value: str | None, *, allowed: bool, what: str) -> Path | None:
    from pathlib import Path

    from rayohx.errors import ConfigurationError

    if not value:
        return None
    if not allowed:
        raise ConfigurationError(
            f"{what} refers to a file on the server, which this API does not allow.",
            hint=LOCAL_PATHS_HINT,
        )
    return Path(value).expanduser()


def _file_keys(wanted: bool, local: bool) -> bool:
    from rayohx.errors import ConfigurationError

    if wanted and not local:
        raise ConfigurationError(
            "Reading key files on the server is not allowed.", hint=LOCAL_PATHS_HINT
        )
    return wanted


def read_cookie_file(path: Path) -> dict[str, str]:
    """Cookies from a Netscape ``cookies.txt``."""
    from rayohx.errors import ConfigurationError

    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ConfigurationError(f"The cookie file {path} cannot be read.") from exc
    cookies: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.removeprefix("#HttpOnly_")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) < 7 or not fields[5].strip():
            raise ConfigurationError(
                f"The cookie file {path} is not in the Netscape cookies.txt format."
            )
        cookies[fields[5].strip()] = fields[6].strip()
    return cookies


def network_config(net: Network, *, local: bool) -> NetworkConfig:
    from rayohx.config import NetworkConfig, ProxyConfig

    headers: dict[str, str] = {}
    if net.referer:
        headers["Referer"] = net.referer
    if net.origin:
        headers["Origin"] = net.origin
    for name, value in net.headers.items():
        for existing in [k for k in headers if k.lower() == name.lower()]:
            del headers[existing]
        headers[name] = value
    cookie_file = local_path(net.cookie_file, allowed=local, what="The cookie file")
    ca_bundle = local_path(net.ca_bundle, allowed=local, what="The CA bundle")
    options: dict[str, object] = {
        "headers": headers,
        "cookies": {**(read_cookie_file(cookie_file) if cookie_file else {}), **net.cookies},
        "verify_tls": False if net.insecure else (ca_bundle or True),
        "credential_hosts": tuple(net.credential_hosts),
        "proxy_from_env": net.env_proxy,
        "client_cert": local_path(net.client_cert, allowed=local, what="The client certificate"),
        "client_key": local_path(net.client_key, allowed=local, what="The client key"),
        "client_key_password": (
            net.client_key_password.get_secret_value() if net.client_key_password else None
        ),
    }
    optional = {
        "user_agent": net.user_agent,
        "connect_timeout": net.connect_timeout,
        "read_timeout": net.read_timeout,
        "total_timeout": net.timeout,
        "retries": net.retries,
        "backoff_factor": net.backoff,
        "max_redirects": net.max_redirects,
        "rate_limit": net.rate_limit,
    }
    options.update({k: v for k, v in optional.items() if v is not None})
    if net.proxy:
        options["proxy"] = ProxyConfig(
            url=net.proxy.url,
            username=net.proxy.username,
            password=net.proxy.password.get_secret_value() if net.proxy.password else None,
        )
    return NetworkConfig(**options)  # type: ignore[arg-type]


def download_config(request: DownloadCreate, *, base: Path, local: bool) -> DownloadConfig:
    """Build and validate the settings. Raises ``ConfigurationError`` with a fix-it message."""
    from rayohx.config import DownloadConfig, OutputConfig, SelectionConfig, StorageConfig
    from rayohx.enums import OutputFormat, RemuxBackend, StorageStrategy

    sel, store, out, eng = request.selection, request.storage, request.output, request.engine
    storage: dict[str, object] = {
        "strategy": StorageStrategy(store.strategy),
        "workspace_dir": subfolder(base, store.workspace, "workspace folder"),
        "check_space": store.space_check,
        "keep_state_on_failure": store.keep_state,
    }
    for key, value in (
        ("buffer_bytes", store.buffer_bytes),
        ("max_temp_bytes", store.max_temp_bytes),
        ("reserve_bytes", store.reserve_bytes),
    ):
        if value is not None:
            storage[key] = value
    return DownloadConfig(
        concurrency=eng.concurrency or DEFAULT_CONCURRENCY,
        resume=eng.resume,
        allow_file_keys=_file_keys(eng.allow_file_keys, local),
        network=network_config(request.network, local=local),
        storage=StorageConfig(**storage),  # type: ignore[arg-type]
        output=OutputConfig(
            directory=subfolder(base, out.directory, "output folder") or base,
            format=OutputFormat(out.format),
            overwrite=out.overwrite,
            validate=out.validate_output,
            remux_backend=RemuxBackend(out.remux_backend),
            ffmpeg_path=local_path(out.ffmpeg, allowed=local, what="The FFmpeg path"),
        ),
        selection=SelectionConfig(
            quality=sel.quality,
            max_resolution=sel.max_resolution,
            max_bitrate=sel.max_bitrate,
            variant=sel.variant,
            resolution=sel.resolution,
            bandwidth=sel.bandwidth,
            variant_name=sel.variant_name,
            codec=sel.codec,
            video_range=sel.video_range,
            max_frame_rate=sel.max_frame_rate,
            audio_languages=tuple(sel.audio),
            audio_names=tuple(sel.audio_names),
            subtitle_languages=tuple(sel.subtitles),
            subtitle_names=tuple(sel.subtitle_names),
            video_only=sel.video_only,
        ),
    )


def sources(request: DownloadCreate | InspectRequest) -> list[str]:
    """The playlist addresses a request names. Local text needs exactly one base address."""
    from rayohx.errors import ConfigurationError

    found = ([request.url] if request.url else []) + list(request.urls)
    if request.playlist_text is not None:
        if not request.base_url:
            raise ConfigurationError(
                "Playlist text needs a base address.",
                hint="Give base_url, so relative addresses inside it can be resolved.",
            )
        if found:
            raise ConfigurationError("Give either playlist text or addresses, not both.")
        return [request.base_url]
    if request.base_url:
        raise ConfigurationError("base_url is only used together with playlist_text.")
    if not found:
        raise ConfigurationError(
            "There is nothing to download.", hint="Give url, urls or playlist_text."
        )
    return found
