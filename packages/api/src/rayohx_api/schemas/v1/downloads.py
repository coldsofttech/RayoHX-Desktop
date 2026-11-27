"""Models for starting, listing and following downloads."""

from pydantic import BaseModel, Field

from rayohx_api.schemas.v1.common import Engine, Network, Output, Selection, Source, Storage


class DownloadCreate(Source):
    filename: str | None = Field(
        default=None,
        max_length=200,
        description="File name inside the download folder. Folders are not accepted.",
    )
    network: Network = Field(default_factory=Network)
    selection: Selection = Field(default_factory=Selection)
    storage: Storage = Field(default_factory=Storage)
    output: Output = Field(default_factory=Output)
    engine: Engine = Field(default_factory=Engine)


class Progress(BaseModel):
    state: str
    downloaded_bytes: int = 0
    written_bytes: int = 0
    total_bytes: int | None = None
    completed_segments: int = 0
    total_segments: int | None = None
    fraction: float | None = None
    speed: float = 0.0
    average_speed: float = 0.0
    eta_seconds: float | None = None
    active_workers: int = 0


class Job(BaseModel):
    id: str
    url: str = Field(description="The address with any signing token removed.")
    state: str
    created_at: float
    updated_at: float
    progress: Progress | None = None
    output_path: str | None = None
    output_size_bytes: int | None = None
    error: str | None = None
    error_code: str | None = Field(
        default=None,
        description="A stable name for a failure a client can act on, such as output_exists.",
    )
    quality: str | None = Field(default=None, description="The quality that was asked for.")
    retryable: bool = Field(default=False, description="Can be started again with retry.")
    has_log: bool = Field(default=False, description="The engine has reported something to show.")


class EngineEvent(BaseModel):
    time: float
    type: str
    state: str
    message: str | None = None
    segment: int | None = None


class RetryRequest(BaseModel):
    overwrite: bool = Field(
        default=False, description="Replace an existing output file for this run only."
    )


class JobList(BaseModel):
    items: list[Job]
