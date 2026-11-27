"""Version 1 of the API, served under ``/api/v1``."""

from fastapi import APIRouter, Depends

from rayohx_api.auth import authenticate
from rayohx_api.routers.v1 import clean, downloads, inspect, settings
from rayohx_api.routers.v1.deps import reset_state

router = APIRouter(tags=["v1"], dependencies=[Depends(authenticate)])
for module in (inspect, downloads, settings, clean):
    router.include_router(module.router)

__all__ = ["reset_state", "router"]
