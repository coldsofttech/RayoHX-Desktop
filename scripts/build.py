"""Builds the portable Windows app: front end, compiled wheels, then a frozen one-folder app.

It builds the front end and the compiled (Nuitka) rayohx-api and rayohx-desktop wheels into
``dist/`` (needs Node.js and a C compiler), installs them into a fresh environment at
``.freeze/venv`` with PyInstaller, runs ``installer/pyinstaller/rayohxd.spec`` and writes
``dist/rayohx-desktop-<version>-windows-x64.zip``. The zip holds ``rayohxd/rayohxd.exe`` and
``rayohxd/lib/``. ``--no-build`` freezes the wheels already in the folder, such as the ones a
release builds with cibuildwheel. The window is for Windows only.

Usage: ``python scripts/build.py [--no-build] [--wheels DIR] [--python 3.15]``
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".freeze"
VENV = WORK / "venv"
SPEC = ROOT / "installer" / "pyinstaller" / "rayohxd.spec"
REQUIREMENTS = ROOT / "installer" / "pyinstaller" / "requirements.txt"
INIT = ROOT / "packages" / "desktop" / "src" / "rayohx_desktop" / "__init__.py"
FRONTEND = ROOT / "packages" / "desktop" / "src" / "rayohx_desktop" / "ui"
NAME = "rayohxd"


def run(*command: str | Path, env: dict[str, str] | None = None) -> None:
    """Run a command, stopping the script if it fails."""
    subprocess.run([str(part) for part in command], check=True, cwd=ROOT, env=env)


def build_wheels(folder: Path) -> None:
    """Build the front end, then the compiled wheels of the API and the window into ``folder``."""
    npm = shutil.which("npm")
    uv = shutil.which("uv")
    if npm is None or uv is None:
        raise SystemExit("npm (Node.js) and uv must be on PATH.")
    run(npm, "ci", "--prefix", FRONTEND)
    run(npm, "run", "build", "--prefix", FRONTEND)
    for package in ("rayohx_api", "rayohx_desktop"):
        for old in folder.glob(f"{package}-*.whl"):
            old.unlink()
    env = {**os.environ, "PYD_BUILD": "1"}
    for package in ("rayohx-api", "rayohx-desktop"):
        run(uv, "build", "--wheel", "--package", package, "--out-dir", folder, env=env)


def version() -> str:
    """The window's ``__version__``, which names the zip."""
    match = re.search(r'^__version__ = "([^"]+)"', INIT.read_text(encoding="utf-8"), re.MULTILINE)
    if match is None:
        raise SystemExit(f"No __version__ in {INIT}.")
    return match.group(1)


def wheel(folder: Path, package: str) -> Path:
    """The one compiled wheel of ``package`` in ``folder``."""
    found = sorted(folder.glob(f"{package}-*.whl"))
    if len(found) != 1:
        raise SystemExit(f"Expected one {package} wheel in {folder}, found {len(found)}.")
    return found[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the portable app into a zip.")
    parser.add_argument(
        "--no-build", action="store_true", help="freeze the wheels already in --wheels"
    )
    parser.add_argument("--wheels", type=Path, default=ROOT / "dist", help="folder with the wheels")
    parser.add_argument("--python", default="3.15", help="Python version of the frozen app")
    args = parser.parse_args()
    if sys.platform != "win32":
        raise SystemExit("The window is for Windows only.")
    uv = shutil.which("uv")
    if uv is None:
        raise SystemExit("uv must be on PATH.")
    if not args.no_build:
        build_wheels(args.wheels)
    wheels = [wheel(args.wheels, "rayohx_api"), wheel(args.wheels, "rayohx_desktop")]

    shutil.rmtree(WORK, ignore_errors=True)
    run(uv, "venv", "--python", args.python, VENV)
    python = VENV / "Scripts" / "python.exe"
    run(uv, "pip", "install", "--python", python, "-r", REQUIREMENTS, *wheels)

    out = WORK / "dist"
    run(python, "-m", "PyInstaller", SPEC, "--noconfirm", "--distpath", out,
        "--workpath", WORK / "work")  # fmt: skip
    folder = out / NAME
    run(folder / f"{NAME}.exe", "--version")  # the frozen interpreter starts and imports the app

    target = args.wheels / f"rayohx-desktop-{version()}-windows-x64.zip"
    target.unlink(missing_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                archive.write(path, Path(NAME) / path.relative_to(folder))
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
