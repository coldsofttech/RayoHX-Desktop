"""Models for removing leftover working folders."""

from pydantic import BaseModel, Field


class CleanRequest(BaseModel):
    older_than_days: float = Field(default=0, ge=0)
    dry_run: bool = True


class CleanedFolder(BaseModel):
    name: str
    size_bytes: int
    age_days: float


class CleanResponse(BaseModel):
    dry_run: bool
    folders: list[CleanedFolder]
    freed_bytes: int
    skipped_in_use: int
