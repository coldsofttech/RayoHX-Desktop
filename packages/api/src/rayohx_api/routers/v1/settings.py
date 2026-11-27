"""Read and change the defaults new downloads start with."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from rayohx import __version__
from rayohx.config.download import MAX_CONCURRENCY
from rayohx.errors import RayoHXError

from rayohx_api.build import download_config
from rayohx_api.config import Settings, get_settings
from rayohx_api.defaults import without_secrets
from rayohx_api.routers.v1.deps import manager, prefs, problem
from rayohx_api.schemas.v1.common import MIN_CONCURRENCY
from rayohx_api.schemas.v1.downloads import DownloadCreate
from rayohx_api.schemas.v1.settings import Defaults, Limits, SettingsUpdate, SettingsView

router = APIRouter()


def _view(settings: Settings) -> SettingsView:
    p = prefs()
    return SettingsView(
        download_dir=str(p.download_dir),
        max_active_downloads=settings.max_active_downloads,
        allow_local_paths=settings.allow_local_paths,
        theme=p.theme,  # type: ignore[arg-type]
        limits=Limits(min_concurrency=MIN_CONCURRENCY, max_concurrency=MAX_CONCURRENCY),
        version=__version__,
        defaults=p.defaults,
    )


@router.get("/settings", summary="Server settings and saved default options")
def read_settings(settings: Annotated[Settings, Depends(get_settings)]) -> SettingsView:
    return _view(settings)


@router.patch("/settings", summary="Change the theme or the download folder")
def update_settings(
    body: SettingsUpdate, settings: Annotated[Settings, Depends(get_settings)]
) -> SettingsView:
    changes = body.model_dump(exclude_none=True)
    if "download_dir" in changes:
        if not settings.allow_local_paths:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "The folder cannot be changed here.")
        folder = Path(changes["download_dir"])
        if not folder.is_absolute():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Give a full folder path.")
        try:
            folder.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "That folder cannot be used."
            ) from exc
        changes["download_dir"] = folder
        manager().directory = folder
    prefs().update(changes)
    return _view(settings)


@router.put("/settings/defaults", summary="Replace the saved default options")
def save_defaults(
    body: Defaults, settings: Annotated[Settings, Depends(get_settings)]
) -> SettingsView:
    """Only options that are set are saved. Proxy logins and passwords are never saved."""
    data = without_secrets(body.model_dump(exclude_unset=True))
    try:
        # Check the combination now, so a bad default is refused here and not on every download.
        trial = DownloadCreate.model_validate({"url": "https://example.com/a.m3u8", **data})
        download_config(trial, base=prefs().download_dir, local=settings.allow_local_paths)
        prefs().save_defaults(data)
    except RayoHXError as exc:
        raise problem(status.HTTP_422_UNPROCESSABLE_CONTENT, exc) from exc
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save.") from exc
    return _view(settings)
