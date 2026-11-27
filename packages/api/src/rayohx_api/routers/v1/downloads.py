"""Start, follow and control downloads."""

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from rayohx.errors import RayoHXError

from rayohx_api.config import Settings, get_settings
from rayohx_api.defaults import merge
from rayohx_api.jobs import UnsafeFilenameError
from rayohx_api.routers.v1.deps import Jobs, find_job, prefs, problem, to_job
from rayohx_api.schemas.v1.downloads import DownloadCreate, EngineEvent, Job, JobList, RetryRequest

router = APIRouter()


@router.get("/downloads", summary="List downloads, newest first")
def list_downloads(jobs: Jobs) -> JobList:
    return JobList(items=[to_job(r) for r in jobs.all()])


@router.post(
    "/downloads",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start one download for each address",
)
def create_download(
    body: DownloadCreate, jobs: Jobs, settings: Annotated[Settings, Depends(get_settings)]
) -> JobList:
    try:
        merged = merge(prefs().defaults, body.model_dump(exclude_unset=True))
        records = jobs.create(
            DownloadCreate.model_validate(merged),
            local_paths=settings.allow_local_paths,
        )
    except (UnsafeFilenameError, RayoHXError) as exc:
        raise problem(status.HTTP_422_UNPROCESSABLE_CONTENT, exc) from exc
    return JobList(items=[to_job(r) for r in records])


@router.delete(
    "/downloads",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear the history of finished downloads",
)
def clear_downloads(jobs: Jobs) -> Response:
    jobs.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/downloads/{job_id}", summary="One download")
def get_download(job_id: str, jobs: Jobs) -> Job:
    return to_job(find_job(jobs, job_id))


@router.post("/downloads/{job_id}/pause", summary="Pause a download")
def pause_download(job_id: str, jobs: Jobs) -> Job:
    record = find_job(jobs, job_id)
    jobs.pause(record)
    return to_job(record)


@router.post("/downloads/{job_id}/resume", summary="Resume a paused download")
def resume_download(job_id: str, jobs: Jobs) -> Job:
    record = find_job(jobs, job_id)
    jobs.resume(record)
    return to_job(record)


@router.post("/downloads/{job_id}/retry", summary="Start a failed or cancelled download again")
def retry_download(
    job_id: str,
    jobs: Jobs,
    settings: Annotated[Settings, Depends(get_settings)],
    body: RetryRequest | None = None,
) -> Job:
    record = find_job(jobs, job_id)
    try:
        started = jobs.retry(
            record,
            local_paths=settings.allow_local_paths,
            overwrite=bool(body and body.overwrite),
        )
    except (UnsafeFilenameError, RayoHXError) as exc:
        raise problem(status.HTTP_422_UNPROCESSABLE_CONTENT, exc) from exc
    if not started:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a failed or cancelled download can be retried."
        )
    return to_job(record)


@router.post("/downloads/{job_id}/cancel", summary="Cancel a download")
def cancel_download(job_id: str, jobs: Jobs) -> Job:
    record = find_job(jobs, job_id)
    jobs.cancel(record)
    return to_job(record)


@router.delete(
    "/downloads/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Forget a finished download",
)
def remove_download(job_id: str, jobs: Jobs) -> Response:
    record = find_job(jobs, job_id)
    if not jobs.remove(record):
        raise HTTPException(status.HTTP_409_CONFLICT, "Cancel the download before removing it.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/downloads/{job_id}/log", summary="What the engine reported, most recent last")
def download_log(job_id: str, jobs: Jobs) -> list[EngineEvent]:
    return [EngineEvent(**item) for item in find_job(jobs, job_id).events]


@router.get("/downloads/{job_id}/events", summary="Follow a download as server-sent events")
async def download_events(job_id: str, request: Request, jobs: Jobs) -> StreamingResponse:
    record = find_job(jobs, job_id)

    async def stream() -> AsyncIterator[str]:
        last = ""
        while not await request.is_disconnected():
            payload = to_job(record).model_dump_json()
            if payload != last:
                last = payload
                yield f"event: job\ndata: {payload}\n\n"
            if record.state.is_terminal:
                return
            await asyncio.sleep(0.5)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
