"""Builds the compiled (Nuitka) rayohx-api and rayohx-desktop wheels and installs them into
scripts/smoke/.venv.

It needs a C compiler and Node.js (the front end is built when ui/dist is missing). rayohx (core)
comes from PyPI unless ``--core-wheels`` names a folder with a compiled core wheel, which is used
first. The API and the window are for Windows only.

Usage: ``python scripts/smoke/setup_venv.py [--python 3.11] [--core-wheels DIR]``
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VENV = HERE / ".venv"
WHEELS = HERE / "wheels"
FRONTEND = ROOT / "packages" / "desktop" / "src" / "rayohx_desktop" / "ui"


def venv_python() -> Path:
    """The interpreter inside the smoke environment."""
    return VENV / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")


def run(*command: str | Path, cwd: Path = ROOT, env: dict[str, str] | None = None) -> None:
    """Run a command, stopping the script if it fails."""
    subprocess.run([str(part) for part in command], check=True, cwd=cwd, env=env)


def create_venv(version: str | None) -> None:
    """Make a fresh environment, with the current Python or the requested version through uv."""
    if VENV.exists():
        shutil.rmtree(VENV)
    if version:
        run("uv", "venv", "--python", version, VENV)
        run("uv", "pip", "install", "--python", venv_python(), "pip")
    else:
        run(sys.executable, "-m", "venv", VENV)


def build_frontend() -> None:
    """The desktop wheel carries the built front end (ui/dist); build it if it is missing."""
    if (FRONTEND / "dist").is_dir():
        return
    npm = shutil.which("npm")
    if npm is None:
        sys.exit("Node.js is needed to build the front end (npm was not found)")
    run(npm, "ci", cwd=FRONTEND)
    run(npm, "run", "build", cwd=FRONTEND)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--python", help="Python version for the environment, for example 3.11")
    parser.add_argument("--core-wheels", type=Path, help="folder with a compiled rayohx wheel")
    args = parser.parse_args()
    if args.core_wheels and not args.core_wheels.is_dir():
        sys.exit(f"The compiled core wheel folder is missing: {args.core_wheels}")

    build_frontend()
    create_venv(args.python)
    python = venv_python()
    run(python, "-m", "pip", "install", "--upgrade", "pip", "build", "nuitka", "setuptools")
    run(python, "-m", "pip", "install", "wheel", "mypy>=1.13")

    # Install core first, then the dependencies of the API and the window.
    find_links = ["--find-links", str(args.core_wheels)] if args.core_wheels else []
    run(python, "-m", "pip", "install", *find_links, "rayohx")
    run(python, "-m", "pip", "install", "fastapi>=0.162.4", "pydantic-settings>=2.16.3")
    run(python, "-m", "pip", "install", "uvicorn>=0.32")
    if sys.platform == "win32":
        run(python, "-m", "pip", "install", "cornea-shell>=0.1.1")

    if WHEELS.exists():
        shutil.rmtree(WHEELS)
    env = {**os.environ, "PYD_BUILD": "1"}
    for package in ("api", "desktop"):
        run(
            python, "-m", "build", "--wheel", "--no-isolation", "--outdir", WHEELS,
            cwd=ROOT / "packages" / package, env=env,
        )  # fmt: skip

    for pattern in ("rayohx_api-*.whl", "rayohx_desktop-*.whl"):
        wheel = next(WHEELS.glob(pattern))
        run(python, "-m", "pip", "install", "--force-reinstall", "--no-deps", wheel)
    run(
        python,
        "-c",
        "import rayohx_api, rayohx_desktop; print('installed:', rayohx_desktop.__file__)",
    )


if __name__ == "__main__":
    main()
