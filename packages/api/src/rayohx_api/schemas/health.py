"""Request and response models. They define the API contract in the OpenAPI document."""

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class ReadyResponse(BaseModel):
    status: Literal["ready"] = "ready"
    version: str = Field(description="Version of the running service.")
