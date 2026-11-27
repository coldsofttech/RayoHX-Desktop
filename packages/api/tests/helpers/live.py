"""The real API in a subprocess, for tests that download over real sockets."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from typing import TYPE_CHECKING, Any, Self

import httpx
from rayohx_pytest.servers import free_port

if TYPE_CHECKING:
    from pathlib import Path
    from types import TracebackType


class ApiProcess:
    """The real API, started the way users start it on its own."""

    def __init__(self, download_dir: Path, **settings: str) -> None:
        self.port = free_port()
        self.url = f"http://127.0.0.1:{self.port}"
        env = {
            **os.environ,
            "RAYOHX_API_PORT": str(self.port),
            "RAYOHX_API_HOST": "127.0.0.1",
            "RAYOHX_API_AUTH_MODE": "none",
            "RAYOHX_API_DOWNLOAD_DIR": str(download_dir),
        }
        env.update({f"RAYOHX_API_{name.upper()}": value for name, value in settings.items()})
        self._process = subprocess.Popen([sys.executable, "-m", "rayohx_api"], env=env)
        self.client = httpx.Client(base_url=self.url, timeout=10)
        self._wait_until_ready()

    def _wait_until_ready(self) -> None:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if self._process.poll() is not None:
                raise RuntimeError("the API exited during startup")
            try:
                if self.client.get("/health", timeout=1).status_code == 200:
                    return
            except httpx.TransportError:
                time.sleep(0.2)
        raise RuntimeError("the API did not become ready")

    def start_download(self, url: str, *, format: str | None = None, **body: Any) -> dict[str, Any]:
        """Start one download. ``format`` is a shortcut for ``output={"format": ...}``."""
        if format:
            body["output"] = {**body.get("output", {}), "format": format}
        response = self.client.post("/api/v1/downloads", json={"url": url, **body})
        assert response.status_code == 202, response.text
        return dict(response.json()["items"][0])

    def job(self, job_id: str) -> dict[str, Any]:
        return dict(self.client.get(f"/api/v1/downloads/{job_id}").json())

    def wait_for(
        self, job_id: str, *states: str, timeout: float = 30, until: Any = None
    ) -> dict[str, Any]:
        """Poll until the job is in one of ``states`` (and ``until(job)`` holds, if given)."""
        deadline = time.monotonic() + timeout
        job = self.job(job_id)
        while time.monotonic() < deadline:
            job = self.job(job_id)
            if job["state"] in states and (until is None or until(job)):
                return job
            time.sleep(0.05)
        raise AssertionError(f"job stuck in {job['state']!r}, wanted {states}")

    def stop(self, *, kill: bool = False) -> None:
        self.client.close()
        if kill:
            self._process.kill()
        else:
            self._process.terminate()
        self._process.wait(timeout=10)

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._process.poll() is None:
            self.stop(kill=True)
