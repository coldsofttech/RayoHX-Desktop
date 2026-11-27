# API

`rayohx_api` is a FastAPI app over `rayohx`. It runs on its own on Windows, and the same routes are mounted inside the UI window (see the [desktop window architecture](architecture.md#the-desktop-window)). Routes only validate input, call the library and shape the response; logic stays in `rayohx`. For how the pieces fit together, see [architecture](architecture.md#the-api); to work on the API, see [development](development.md).

## Running it

```bash
cp packages/api/.env.example .env              # set RAYOHX_API_API_KEYS, or RAYOHX_API_AUTH_MODE=none
uv run python -m rayohx_api                    # http://127.0.0.1:8000
```

That is the development form, which runs the plain sources. An installed release is compiled and has no `python -m rayohx_api`; start it with the `rayohx-api` command instead, which takes the same settings.

The app refuses to start without an API key unless authentication is switched off. This is on purpose, so the API is never open by accident. See [security](security.md).

## Settings

Read from `RAYOHX_API_*` environment variables or a `.env` file in the folder you start the API from. [`packages/api/.env.example`](../packages/api/.env.example) lists every setting with comments. List values are JSON.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RAYOHX_API_HOST` | `127.0.0.1` | Address to listen on |
| `RAYOHX_API_PORT` | `8000` | Port to listen on |
| `RAYOHX_API_LOG_LEVEL` | `info` | Log level |
| `RAYOHX_API_AUTH_MODE` | `api_key` | `api_key`, or `none` for local development |
| `RAYOHX_API_API_KEYS` | none | Accepted keys, sent in the `X-API-Key` header |
| `RAYOHX_API_DOCS_ENABLED` | `false` | Serve `/docs`, `/redoc` and `/openapi.json` |
| `RAYOHX_API_MAX_BODY_BYTES` | `1048576` | Largest request body |
| `RAYOHX_API_CORS_ORIGINS` | none | Origins allowed by CORS |
| `RAYOHX_API_DOWNLOAD_DIR` | `~/Downloads/RayoHX` | Folder downloads are saved in (clients choose file names only) |
| `RAYOHX_API_ALLOW_LOCAL_PATHS` | `false` | Let requests name files on the server (cookie files, certificates, FFmpeg, file keys); the desktop window turns it on |
| `RAYOHX_API_MAX_ACTIVE_DOWNLOADS` | `2` | Downloads that run at once, 1 to 16; the rest queue |
| `RAYOHX_API_DB_PATH` | per-user app data folder | SQLite file that keeps the download list, logs and saved defaults between restarts |

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /health`, `GET /ready` | Liveness and readiness probes, no authentication |
| `POST /api/v1/inspect` | Variants and tracks of a playlist (from an address, or from playlist text and a base address), without downloading |
| `GET`/`POST /api/v1/downloads` | List download jobs, or start one job for each address in the request (202, returns a list) |
| `GET`/`DELETE /api/v1/downloads/{id}` | One job, or forget a finished one |
| `POST /api/v1/downloads/{id}/pause`, `/resume`, `/cancel` | Control a job |
| `POST /api/v1/downloads/{id}/retry` | Start a failed or cancelled download again (optionally with `overwrite`) |
| `GET /api/v1/downloads/{id}/events` | Server-sent `job` events until the job ends |
| `GET /api/v1/downloads/{id}/log` | What the engine reported for a job (the CLI's `--events` stream, without per-segment noise); the last 200 events, kept between restarts |
| `GET`/`PATCH /api/v1/settings` | Server settings, the saved default options and the `limits` the engine accepts; `PATCH` changes the theme or the download folder |
| `PUT /api/v1/settings/defaults` | Replace the default options (saved between restarts; logins and passwords are never saved) |
| `POST /api/v1/clean` | Remove leftover working folders in the download folder (`dry_run` by default) |

## Starting downloads

`POST /api/v1/downloads` takes where the playlist comes from, and then groups of options. Every option is optional; the ones you leave out use the engine's defaults.

| Part | What it holds |
| --- | --- |
| `url`, `urls`, `playlist_text` and `base_url` | One address, up to 100 addresses (one job each), or playlist text you already have plus the address its relative links resolve against. Text and addresses cannot be mixed |
| `filename` | A file name for a single download. Not allowed with more than one address |
| `network` | Headers, cookies, user agent, referer, origin, proxy, TLS settings, timeouts, retries, redirects and a speed limit |
| `selection` | Quality, maximum resolution or bitrate, a stream number, exact resolution or bandwidth, name, codec, video range, frame rate, and the audio and subtitle tracks |
| `storage` | Storage strategy, a working folder, buffer and temporary size limits, free-space reserve and check, and whether to keep state after a failure |
| `output` | Format (`auto`, `ts`, `mp4` or `segments`), a sub-folder, overwrite, validation, the remux backend and the FFmpeg path |
| `engine` | Parallel segments, resuming, and reading key files |

`POST /api/v1/inspect` accepts the same source fields and `network`.

Folders (`output.directory` and `storage.workspace`) must be relative and stay inside the download folder. Settings that point at files on the server (`network.cookie_file`, `ca_bundle`, `client_cert`, `client_key`, `output.ffmpeg` and `engine.allow_file_keys`) are refused unless `RAYOHX_API_ALLOW_LOCAL_PATHS=true`, so a client cannot make the server read its own files. Proxy passwords and key passwords are never returned or logged.

Options left out of a download request use the saved defaults, then the engine's own. A default is checked when it is saved, so a bad combination is refused there and not on every download.

Jobs are saved between restarts, and any cut short by a restart show as failed; the engine resumes partial files. Signed-URL tokens are removed from every address returned. Errors use the problem-details format (`application/problem+json`).

## The contract

[`openapi.json`](openapi.json) is generated by `uv run python packages/api/scripts/export_openapi.py`. CI fails when it is out of date, `api-compat.yml` warns about breaking changes on pull requests, and a Schemathesis test fuzzes the running server for server errors. Put breaking changes in a new `/api/v2` router.
