"""Switches the ``rayohx`` and ``rayohx-pytest`` sources in pyproject.toml: local or release.

By default it writes the committable sources: ``rayohx`` from PyPI (no source entry) and
``rayohx-pytest`` from git. With ``--local`` it writes editable path sources for both, for
developing them alongside this repository. The paths come from ``RAYOHX_PATH`` (default
``../RayoHX/packages/core``) and ``RAYOHX_PYTEST_PATH`` (default
``../RayoHX/packages/pytest``). uv.lock is refreshed whenever pyproject.toml changes.

Usage: ``python scripts/dev/local.py [--local]``. Run it with plain ``python``, not
``uv run``, which syncs against the current source before the script can switch it.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYPROJECT = ROOT / "pyproject.toml"

GIT_URL = "https://github.com/coldsofttech/RayoHX"
GIT_SUBDIRECTORY = "packages/pytest"
GIT_TAG = "pytest-v0.1.0"
DEFAULT_PYTEST_PATH = "../RayoHX/packages/pytest"
PYTEST_PATH_ENV = "RAYOHX_PYTEST_PATH"
DEFAULT_CORE_PATH = "../RayoHX/packages/core"
CORE_PATH_ENV = "RAYOHX_PATH"

PYTEST_LINE = r"^rayohx-pytest = \{.*\}[ \t]*$"
CORE_LINE = r"^rayohx = \{.*\}[ \t]*\n?"


def path_source(name: str, env: str, default: str) -> str:
    """The ``[tool.uv.sources]`` line that points ``name`` at a local editable checkout."""
    path = os.environ.get(env, default).replace("\\", "/")
    return f'{name} = {{ path = "{path}", editable = true }}'


def git_source() -> str:
    """The ``[tool.uv.sources]`` line that points ``rayohx-pytest`` at the git repository."""
    return (
        f'rayohx-pytest = {{ git = "{GIT_URL}", subdirectory = "{GIT_SUBDIRECTORY}", '
        f'tag = "{GIT_TAG}" }}'
    )


def rewrite(text: str, local: bool) -> tuple[str, int]:
    """Return the pyproject text with the sources switched, and how many pytest lines it found."""
    import re

    pytest_line = (
        path_source("rayohx-pytest", PYTEST_PATH_ENV, DEFAULT_PYTEST_PATH)
        if local
        else git_source()
    )
    text, count = re.subn(PYTEST_LINE, lambda _: pytest_line, text, flags=re.MULTILINE)
    if count != 1:
        return text, count
    if local:
        core_line = path_source("rayohx", CORE_PATH_ENV, DEFAULT_CORE_PATH)
        text, found = re.subn(CORE_LINE, lambda _: core_line + "\n", text, flags=re.MULTILINE)
        if not found:
            text = text.replace(pytest_line, f"{core_line}\n{pytest_line}", 1)
    else:
        text = re.sub(CORE_LINE, "", text, flags=re.MULTILINE)
    return text, count


def main() -> int:
    """Rewrite the source lines, refresh the lock file, and return the exit code."""
    import shutil
    import subprocess

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument(
        "--local", action="store_true", help="use the local editable checkouts instead of release"
    )
    args = parser.parse_args()

    text = PYPROJECT.read_text(encoding="utf-8")
    updated, count = rewrite(text, args.local)
    if count != 1:
        print(f"Expected one rayohx-pytest source in {PYPROJECT.name}, found {count}.")
        return 1
    if updated == text:
        print(f"Sources already set for {'local' if args.local else 'release'} use.")
        return 0

    uv = shutil.which("uv")
    if uv is None:
        print("uv not found on PATH.")
        return 1

    PYPROJECT.write_text(updated, encoding="utf-8", newline="")
    try:
        subprocess.run([uv, "lock"], check=True, cwd=ROOT)
    except subprocess.CalledProcessError:
        PYPROJECT.write_text(text, encoding="utf-8", newline="")
        print(f"uv lock failed; restored {PYPROJECT.name}.")
        return 1
    if args.local:
        print("Now on the local sources; run `uv sync` to install them. Do not commit this.")
    else:
        print("Now on the release sources; re-stage pyproject.toml and uv.lock.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
