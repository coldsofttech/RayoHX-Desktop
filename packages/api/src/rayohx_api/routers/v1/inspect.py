"""Look at a playlist without downloading it."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from rayohx_api.config import Settings, get_settings
from rayohx_api.schemas.v1.inspect import InspectRequest, InspectResponse

router = APIRouter()


@router.post("/inspect", summary="Look at a playlist without downloading it")
async def inspect_playlist(
    body: InspectRequest, settings: Annotated[Settings, Depends(get_settings)]
) -> InspectResponse:
    import asyncio

    from rayohx.errors import RayoHXError
    from rayohx.playlist.inspection import inspect, inspect_text
    from rayohx.serialization import playlist_to_dict

    from rayohx_api.build import network_config, sources
    from rayohx_api.routers.v1.deps import problem

    try:
        address = sources(body)[0]
        if body.playlist_text is not None:
            playlist = inspect_text(body.playlist_text, address)
        else:
            network = network_config(body.network, local=settings.allow_local_paths)
            playlist = await asyncio.to_thread(inspect, address, network)
    except RayoHXError as exc:
        raise problem(status.HTTP_422_UNPROCESSABLE_CONTENT, exc) from exc
    return InspectResponse(playlist=playlist_to_dict(playlist))
