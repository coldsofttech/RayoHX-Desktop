"""Starts the compiled API (no auth, throwaway data) and inspects the first test stream.

Usage: ``python scripts/smoke/test_api.py``
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
BIN = HERE / ".venv" / ("Scripts" if sys.platform == "win32" else "bin")
SERVER = BIN / ("rayohx-api.exe" if sys.platform == "win32" else "rayohx-api")
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


def main() -> None:
    if not SERVER.exists():
        sys.exit("Run setup_venv.py first")
    url = (HERE / "test_links.txt").read_text(encoding="utf-8").splitlines()[0].strip()
    data = HERE / "data"
    data.mkdir(exist_ok=True)
    env = {
        **os.environ,
        "RAYOHX_API_AUTH_MODE": "none",
        "RAYOHX_API_PORT": str(PORT),
        "RAYOHX_API_DOWNLOAD_DIR": str(data),
        "RAYOHX_API_DB_PATH": str(data / "rayohx.db"),
    }
    with (data / "out.log").open("wb") as out, (data / "err.log").open("wb") as err:
        server = subprocess.Popen([str(SERVER)], env=env, stdout=out, stderr=err)
        try:
            wait_until_ready(server, data / "err.log")
            print("health: ok")
            print(f"inspecting: {url}")
            request = urllib.request.Request(  # noqa: S310
                f"{BASE}/api/v1/inspect",
                data=json.dumps({"url": url}).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310
                print(json.dumps(json.load(response), indent=2))
        finally:
            server.kill()


def wait_until_ready(server: subprocess.Popen[bytes], log: Path) -> None:
    for _ in range(30):
        if server.poll() is not None:
            sys.exit(f"server exited; see {log}")
        try:
            with urllib.request.urlopen(f"{BASE}/health", timeout=2):  # noqa: S310
                return
        except (urllib.error.URLError, OSError):
            time.sleep(1)
    sys.exit(f"server did not become ready; see {log}")


if __name__ == "__main__":
    main()
