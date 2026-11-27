"""Models for looking at a playlist."""

from typing import Any

from pydantic import BaseModel, Field

from rayohx_api.schemas.v1.common import Network, Source


class InspectRequest(Source):
    network: Network = Field(default_factory=Network)


class InspectResponse(BaseModel):
    """A master or media playlist as plain data (see ``rayohx.serialization``)."""

    playlist: dict[str, Any]
