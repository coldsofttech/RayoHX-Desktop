# Testing

How the tests are organized, and the shared `rayohx-pytest` plugin they use.

## Where tests live

Each package keeps its own tests:

```text
packages/<name>/tests/
  unit/          fast tests, run by default
  integration/   slower end-to-end tests over real sockets or a real window
  helpers/       helpers used only by this package
  conftest.py    fixtures shared by the package's tests
```

Anything in an `integration` folder is marked `integration` automatically and is skipped by a normal `pytest` run; run it with `-m integration`. The pytest settings in the root `pyproject.toml` require 80% coverage of `rayohx_api` and `rayohx_desktop`, so a run of a few tests fails on coverage unless you pass `--no-cov`.

## Running

```bash
uv run pytest packages/api/tests/unit --no-cov                  # API unit tests
uv run pytest packages/api/tests/unit/test_store.py --no-cov    # one file
uv run pytest -m integration packages/api/tests --no-cov        # API integration and contract tests
uv run pytest packages/desktop/tests/unit --no-cov              # window unit tests (no real window)
uv run pytest -m integration packages/desktop/tests --no-cov    # needs the built front end
```

The window's integration tests need `packages/desktop/src/rayohx_desktop/ui/dist` (`npm run build`). The API's integration tests start the real server on a free port and need no network access.

The front end has its own tests (Vitest and Testing Library): `npm test --prefix packages/desktop/src/rayohx_desktop/ui`.

## In CI

The API and the window are for Windows only, so `ci.yml` runs every job on Windows (Python 3.15, Node 26): lint, the unit tests of both packages, the API and window integration tests (the window's with the built front end), and the front end lint, tests and build. It also checks dependency licenses, builds the compiled wheels, checks them and starts the built window with `--version`. A final `ci` job, which runs on Linux, is the single required check.

## The `rayohx-pytest` plugin

The test support shared by the RayoHX repositories lives in `rayohx-pytest`, in the [RayoHX](https://github.com/coldsofttech/RayoHX) repository (`packages/pytest`). It is not published to PyPI; the root `pyproject.toml` takes it from git as a development dependency (`[tool.uv.sources]`), so `uv sync` installs it and pytest loads it automatically.

| Fixture or module | What it gives you |
| --- | --- |
| `local_server` | A factory that starts a real HTTP server on `127.0.0.1` and stops it after the test |
| `tls_certificate` | A self-signed certificate and key, valid for `127.0.0.1` |
| `ts_payload` | MPEG-TS packets that pass the engine's sync-byte check |
| `rayohx_pytest.hls` | A small VOD stream on top of the server: `vod_routes`, `expected`, `segment_index`, and `HlsServer`, a server for that stream plus a master playlist |
| `rayohx_pytest.servers.free_port` | A free local TCP port |
| `rayohx_pytest.fixtures` | `fixture_path`, `fixture_text` and `fixture_bytes` for the shared files (playlists, real media) |

The API tests use the server, the HLS stream and the shared playlists. Call `local_server` with routes and use `server.url`, for example `local_server({"/index.m3u8": lambda _s: Reply(body=playlist)})`. The classes behind the fixtures can be imported for types and module-level code:

```python
from rayohx_pytest.plugin import ServerFactory
from rayohx_pytest.servers import Reply, Seen
from rayohx_pytest.site import Site, hls_site
```

`servers` also holds `LocalServer` (a threaded HTTP/1.1 server with routes by path, per-reply delays and a log of every request) and `Route`; `site` holds `Site`, an in-memory httpx mock that serves bytes by path, with `hls_site` and `single_file_site` to build HLS streams from the shared media.

### Shared test data

The plugin ships files several repositories read, so they are written once: `hls/` has playlists such as `ladder.m3u8` (a four-variant master playlist) and `single_segment.m3u8`, and `media/` has small real MPEG-TS and fragmented MP4 files and two HLS sets made by FFmpeg. Read them with `rayohx_pytest.fixtures`, never with a path built from `__file__`.

### Changing the plugin

The plugin is not changed here. Change it in the RayoHX repository, tag it (`pytest-vX.Y.Z`), then update `GIT_TAG` in `scripts/dev/local.py` and run `python scripts/dev/local.py` to rewrite `[tool.uv.sources]` and `uv.lock`.

## Helpers kept here

`packages/api/tests/helpers/live.py` holds code only the API's live tests use, such as starting the real server. The window's tests need no helpers beyond `packages/desktop/tests/conftest.py`. Put a helper in the plugin, not here, when another repository needs it too.

## The compiled builds

The [smoke test](../scripts/smoke/README.md) builds the compiled wheels and runs the API and the window from them. It is a manual check that needs a C compiler, Node.js and network access, separate from the pytest suites.

## Writing tests

- Test the API through the app: build it with `create_app()` and call it with Starlette's `TestClient`; the integration tests start the real server and check it against `/openapi.json`. The API's `tests/conftest.py` gives every test fresh settings and marks everything under `integration/` as an integration test.
- The window's unit tests replace Cornea's `Shell`, so no window opens and they need no real window.
- Use the plugin's fixtures instead of starting servers by hand. Never put real tokens or cookies in a test; use obvious fake values such as `hunter2-very-secret`.
- Do not turn a protection off to make a test pass; set `RAYOHX_API_AUTH_MODE=none` in the test's environment instead.
