"""Models for reading and changing the defaults."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from rayohx_api.schemas.v1.common import (
    Engine,
    Network,
    Output,
    Selection,
    Storage,
)


class Limits(BaseModel):
    """What the engine accepts, so a client can offer only valid choices."""

    min_concurrency: int = Field(description="Fewest parallel segments.")
    max_concurrency: int = Field(description="Most parallel segments.")


class SettingsView(BaseModel):
    download_dir: str
    max_active_downloads: int
    allow_local_paths: bool
    theme: Literal["light", "dark"] | None = Field(
        default=None, description="Chosen theme; none until one is chosen."
    )
    limits: Limits
    version: str
    defaults: dict[str, Any] = Field(description="Only the default options that were set.")


class SettingsUpdate(BaseModel):
    theme: Literal["light", "dark"] | None = None
    download_dir: str | None = Field(
        default=None,
        min_length=1,
        max_length=1024,
        description="Folder new downloads are saved in.",
    )


class Defaults(BaseModel):
    """Options used for every download unless the request sets its own. Passwords are not kept."""

    network: Network = Field(default_factory=Network)
    selection: Selection = Field(default_factory=Selection)
    storage: Storage = Field(default_factory=Storage)
    output: Output = Field(default_factory=Output)
    engine: Engine = Field(default_factory=Engine)
