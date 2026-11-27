"""Starts the compiled window without a window, loads its front page and inspects the first test
stream through its own /api/v1 routes, then stops it.

Usage: ``python scripts/smoke/test_desktop.py``
"""

from __future__ import annotations

import http.cookiejar
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
BIN = HERE / ".venv" / ("Scripts" if sys.platform == "win32" else "bin")
EXE = BIN / ("rayohxd.exe" if sys.platform == "win32" else "rayohxd")


def main() -> None:
    if not EXE.exists():
        sys.exit("Run setup_venv.py first")
    url = (HERE / "test_links.txt").read_text(encoding="utf-8").splitlines()[0].strip()
    out, err = HERE / "desktop.out.log", HERE / "desktop.err.log"
    with out.open("wb") as out_file, err.open("wb") as err_file:
        window = subprocess.Popen([str(EXE), "--no-window"], stdout=out_file, stderr=err_file)
        try:
            ready = wait_for_address(window, out, err)
            print(f"ready: {ready}")
            address = re.search(r"https?://[^\"\s]+", ready)
            if address is None:
                sys.exit("no address in the ready line")
            parts = urllib.parse.urlsplit(address.group(0))
            origin = f"{parts.scheme}://{parts.netloc}"

            # The address carries a one-time token; loading it starts the session the API needs.
            opener = urllib.request.build_opener(
                urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
            )
            with opener.open(address.group(0), timeout=30) as page:
                print(f"front page: {page.status} {page.headers.get('Content-Type')}")

            print(f"inspecting: {url}")
            request = urllib.request.Request(  # noqa: S310
                f"{origin}/api/v1/inspect",
                data=json.dumps({"url": url}).encode(),
                headers={"Content-Type": "application/json", "Origin": origin},
            )
            with opener.open(request, timeout=60) as response:
                print(json.dumps(json.load(response), indent=2))
        finally:
            window.kill()


def wait_for_address(window: subprocess.Popen[bytes], out: Path, err: Path) -> str:
    for _ in range(30):
        if window.poll() is not None:
            sys.exit(f"the window exited; see {err}")
        lines = out.read_text(encoding="utf-8", errors="replace").splitlines()
        if lines:
            return lines[0]
        time.sleep(1)
    sys.exit(f"the window printed no address; see {err}")


if __name__ == "__main__":
    main()
