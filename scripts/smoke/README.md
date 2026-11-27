# Smoke test for the compiled builds

A manual check that the compiled `rayohx-api` and `rayohx-desktop` wheels (a single Nuitka `.pyd` each, plus type stubs) install and run in a fresh virtual environment. It is separate from the pytest and Vitest suites.

## What you need

- Python 3.11 or newer. Use `--python` to ask [uv](https://docs.astral.sh/uv/) for another version.
- A C compiler, because Nuitka compiles the packages.
- Node.js, to build the front end when `packages/desktop/src/rayohx_desktop/ui/dist` is missing.
- Network access, to install dependencies and to reach the test stream.
- Windows: the API and the window are for Windows only.

## Steps

Run these from the repository root.

```sh
python scripts/smoke/setup_venv.py     # builds both wheels and installs them into scripts/smoke/.venv
python scripts/smoke/test_api.py       # starts rayohx-api and inspects a stream
python scripts/smoke/test_desktop.py   # starts rayohxd without a window and inspects a stream (Windows)
```

### `setup_venv.py`

Creates a fresh `scripts/smoke/.venv`, installs the dependencies, builds the front end if needed, builds both compiled wheels into `scripts/smoke/wheels/` and installs them. Any earlier environment and wheels are removed first.

| Option | What it does |
|---|---|
| `--python VERSION` | Create the environment with another Python version through uv, for example `--python 3.12`. Without it, the Python that runs the script is used. |
| `--core-wheels DIR` | Install `rayohx` (core) from a folder of compiled wheels first. Without it, `rayohx` comes from PyPI. |

### `test_api.py`

Starts `rayohx-api` on port 8765 with authentication off and throwaway data in `scripts/smoke/data`, waits up to about 30 seconds for `/health`, then POSTs the **first line** of `test_links.txt` to `/api/v1/inspect` and prints the result. It fails if the server exits or does not become ready, and it stops the server when it finishes.

### `test_desktop.py`

Starts `rayohxd --no-window`, waits up to about 30 seconds for it to print its address, loads that address (which starts the session the API calls need), then POSTs the first line of `test_links.txt` to `/api/v1/inspect` and prints the result. It fails if the app exits or prints no address, and it stops the app when it finishes. Its output goes to `desktop.out.log` and `desktop.err.log` in this folder.

To try another stream, put its URL on the first line of `test_links.txt`; any further lines are ignored. The file is kept in the repository, so use a stream you are allowed to share.

## Files

| File | What it is |
|---|---|
| `setup_venv.py` | Builds and installs the compiled wheels |
| `test_api.py` | Runs the API and inspects a stream |
| `test_desktop.py` | Runs the window without a window and inspects a stream |
| `test_links.txt` | Test stream addresses; the first line is used |

The virtual environment, `wheels/`, `data/` and logs in this folder are git-ignored.
