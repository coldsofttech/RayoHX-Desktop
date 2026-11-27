"""Models and patterns shared by the ``/api/v1`` schemas."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, SecretStr
from rayohx.config.download import MAX_CONCURRENCY

MIN_CONCURRENCY = 1
QUALITY = r"(?i)^(best|worst|auto|\d{3,4}p)$"

Bytes = Annotated[int, Field(ge=1)]


class Proxy(BaseModel):
    url: str = Field(
        max_length=2048, description="http://, https://, socks5:// or socks5h:// address."
    )
    username: str | None = None
    password: SecretStr | None = None


class Network(BaseModel):
    """How requests are made. Every field is optional; unset ones use the engine's defaults."""

    headers: dict[str, str] = Field(default_factory=dict, max_length=32)
    cookies: dict[str, str] = Field(default_factory=dict, max_length=64)
    cookie_file: str | None = Field(
        default=None, description="Netscape cookies.txt on the server. Needs local paths enabled."
    )
    user_agent: str | None = Field(default=None, max_length=512)
    referer: str | None = Field(default=None, max_length=2048)
    origin: str | None = Field(default=None, max_length=2048)
    proxy: Proxy | None = None
    env_proxy: bool = False
    backoff: float | None = Field(default=None, ge=0)
    max_redirects: int | None = Field(default=None, ge=0, le=50)
    insecure: bool = False
    ca_bundle: str | None = Field(default=None, description="Needs local paths enabled.")
    client_cert: str | None = Field(default=None, description="Needs local paths enabled.")
    client_key: str | None = Field(default=None, description="Needs local paths enabled.")
    client_key_password: SecretStr | None = None
    connect_timeout: float | None = Field(default=None, gt=0)
    read_timeout: float | None = Field(default=None, gt=0)
    timeout: float | None = Field(default=None, gt=0, description="Total time allowed.")
    retries: int | None = Field(default=None, ge=0, le=20)
    rate_limit: Bytes | None = Field(default=None, description="Bytes per second, all workers.")
    credential_hosts: list[str] = Field(default_factory=list, max_length=16)


class Selection(BaseModel):
    """Which tracks to download. ``variant`` cannot be combined with the other stream filters."""

    quality: str = Field(default="best", pattern=QUALITY)
    max_resolution: str | None = Field(default=None, pattern=r"(?i)^\d{3,4}p$")
    max_bitrate: Bytes | None = Field(default=None, description="Bits per second.")
    variant: int | None = Field(default=None, ge=1, description="Stream number, from 1.")
    resolution: str | None = Field(default=None, pattern=r"(?i)^\d{2,5}x\d{2,5}$")
    bandwidth: Bytes | None = Field(default=None, description="Exact bits per second.")
    variant_name: str | None = Field(default=None, max_length=200)
    codec: Literal["h264", "hevc", "vp9", "av1"] | None = None
    video_range: Literal["sdr", "pq", "hlg", "hdr"] | None = None
    max_frame_rate: float | None = Field(default=None, gt=0)
    audio: list[str] = Field(default_factory=list, max_length=16)
    audio_names: list[str] = Field(default_factory=list, max_length=16)
    subtitles: list[str] = Field(default_factory=list, max_length=16)
    subtitle_names: list[str] = Field(default_factory=list, max_length=16)
    video_only: bool = False


class Storage(BaseModel):
    strategy: Literal["auto", "direct", "streaming", "buffered", "temporary", "hybrid"] = "auto"
    workspace: str | None = Field(default=None, description="Sub-folder of the download folder.")
    buffer_bytes: Bytes | None = None
    max_temp_bytes: Bytes | None = None
    reserve_bytes: int | None = Field(default=None, ge=0)
    space_check: bool = True
    keep_state: bool = True


class Output(BaseModel):
    format: Literal["auto", "ts", "mp4", "segments"] = "auto"
    directory: str | None = Field(default=None, description="Sub-folder of the download folder.")
    overwrite: bool = False
    validate_output: bool = Field(default=True, alias="validate")
    remux_backend: Literal["auto", "native", "ffmpeg"] = "auto"
    ffmpeg: str | None = Field(default=None, description="Needs local paths enabled.")

    model_config = {"populate_by_name": True}


class Engine(BaseModel):
    concurrency: int | None = Field(
        default=None, ge=MIN_CONCURRENCY, le=MAX_CONCURRENCY, description="Parallel segments."
    )
    resume: bool = True
    allow_file_keys: bool = Field(default=False, description="Needs local paths enabled.")


class Source(BaseModel):
    """Where the playlist comes from: an address, or text you already have plus a base address."""

    url: str | None = Field(default=None, max_length=4096)
    urls: list[str] = Field(default_factory=list, max_length=100, description="Download each.")
    playlist_text: str | None = Field(default=None, max_length=1_000_000)
    base_url: str | None = Field(default=None, max_length=4096)
