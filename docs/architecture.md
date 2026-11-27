# Architecture

How the repository fits together, and how each package is put together. The download engine itself is the `rayohx` library, which lives in the [RayoHX](https://github.com/coldsofttech/RayoHX) repository and is installed from PyPI. For working on the code, see [development](development.md).

## The pieces

```text
packages/
  api/       rayohx-api: the FastAPI app over rayohx (rayohx_api)
  desktop/   rayohx-desktop: the native window and the React front end (rayohx_desktop)
scripts/dev/     local.py: switches the rayohx and rayohx-pytest sources between release and a local checkout
scripts/smoke/   a manual check that builds and runs the compiled wheels
```

The two packages are members of one uv workspace (the root `pyproject.toml`), so `uv sync` installs both, editable, with the dev tools. Each package keeps its own version in `__version__` in its `__init__.py`, which its `pyproject.toml` reads, and the two are released together.

## How they depend on each other

```text
rayohx_desktop  ->  rayohx_api  ->  rayohx (PyPI)
```

- The window mounts the API's routes inside its own server, so the page it shows calls ordinary `/api/v1/...` routes. The API never imports the window, and runs on its own with `rayohx-api`. Both are for Windows only.
- The library never imports either of them and never prints or exits; both only validate input, call the library and shape the response.
- The window layer only wires: it builds the Cornea Shell window, mounts the API and registers a few fixed native actions. Cornea's session gate protects the routes inside the window, so the API's own key check is switched off there and nowhere else.

## Release shape

The window and the API are released together as compiled Nuitka wheels (one binary each, with `.pyi` stubs and no `.py` sources) attached to a GitHub release. They are not published to PyPI and there is no installer. See [packaging and releasing](packaging.md#releasing).

## Shared test support

Both packages use the `rayohx-pytest` plugin from the RayoHX repository for local HTTP servers, HLS streams and fixtures. It is a development dependency taken from git. See [testing](testing.md).

## The API

`rayohx_api` is a thin FastAPI layer over the `rayohx` library. A route validates its input, calls the library and shapes the response. Logic stays in `rayohx`, which never imports the API. The only dependencies the API adds are FastAPI (with Starlette), uvicorn and pydantic-settings. For running it and its settings, see the [API guide](api.md); for the protections it applies, see the [security notes](security.md#the-api-on-its-own).

### Modules

```text
packages/api/src/rayohx_api/
  __main__.py      python -m rayohx_api: checks the settings, then starts uvicorn
  main.py          create_app(): builds the app, middleware, handlers and routers
  config.py        Settings (RAYOHX_API_* variables or .env), AuthMode, get_settings()
  auth.py          authenticate(): the X-API-Key check, and the replacement used when embedded
  errors.py        problem-details responses and the exception handlers
  logs.py          JSON logging and the request ID middleware
  security.py      security headers and the request size limit
  build.py         turns a request into engine settings and holds the rules for what a client may ask
  jobs.py          runs downloads in background threads and keeps their state and engine log, saving them to the store
  store.py         a small SQLite file that keeps the download list, engine logs and saved defaults between restarts
  defaults.py      merges saved default options under a request and strips secrets before they are saved
  schemas/
    health.py      models for /health and /ready
    v1/            /api/v1 models, one file per route group (inspect, downloads, settings, clean) and common.py for what they share
  routers/
    health.py      /health and /ready, at the root, no authentication
    v1/            the /api/v1 router: one file per route group, and deps.py for the shared state and helpers
```

### One app, two ways to run it

`create_app(embedded=False)` is the only place the app is built. There is no module-level app.

| | Standalone (`python -m rayohx_api`) | Embedded (`create_app(embedded=True)`) |
| --- | --- | --- |
| Hosted by | uvicorn | The desktop window, behind Cornea's security gate |
| Authentication | `X-API-Key`, or none if `AUTH_MODE=none` | Already done by Cornea; `authenticate` is replaced by `embedded_principal` |
| Start-up check | Refuses to start without a key unless auth is off | Skipped |
| Security headers | Added by the API | Left to Cornea |

### A request, step by step

Middleware wraps the routes in this order, outermost first:

1. **CORS**, only when `RAYOHX_API_CORS_ORIGINS` is set.
2. **Request ID**: reuses the caller's `X-Request-ID` or creates one, and returns it on the response.
3. **Security headers**, standalone only.
4. **Body limit**: rejects a declared body above `RAYOHX_API_MAX_BODY_BYTES` with `413`.
5. **Route**: dependencies run first (`authenticate` for protected routes), then the handler, which returns a response model.

Any error raised on the way is turned into an `application/problem+json` response by the handlers in `errors.py`: HTTP errors keep their status, validation errors become `422` with the field errors, and anything unexpected becomes a `500` with no details (the exception goes to the log with the request ID).

### Settings

`Settings` is a pydantic-settings class with the prefix `RAYOHX_API_`. `get_settings()` reads it once per process. `check_auth()` runs at start-up, not on the first request, so a missing key stops the service immediately. Nothing else reads environment variables directly.

### Authentication

Protected routes depend on `authenticate`, which returns a `Principal` (who called, and how) or raises `401` with `WWW-Authenticate: ApiKey`. Keys are compared in constant time. The probes at the root never require authentication.

### Logging

All logs, including uvicorn's, go to stderr as one JSON object per line, with the time, level, logger, message and request ID. The request ID travels in a context variable, so any log line written while handling a request carries it.

### Versioning and the contract

- Probes (`/health`, `/ready`) live at the root.
- Everything else is mounted under `/api/v1`. A breaking change goes in a new `/api/v2` router.
- [`openapi.json`](openapi.json) is generated from the app. CI fails when it is out of date and `api-compat.yml` reports breaking changes on pull requests.
- `/docs`, `/redoc` and `/openapi.json` are served only when `RAYOHX_API_DOCS_ENABLED=true`.

## The desktop window

The desktop window is hosted by [Cornea Shell](https://github.com/coldsofttech/CorneaShell) (`cornea-shell`), on Windows only. `rayohx_desktop` only wires things together. The data comes from `rayohx_api` and the work from `rayohx`, and neither of them may import `rayohx_desktop`. For working on it, see [development](development.md); for how it is built, see [packaging and releasing](packaging.md).

### Modules

```text
packages/desktop/src/rayohx_desktop/
  __main__.py   the `rayohxd` command: options, output, exit code
  app.py        builds the Cornea shell: serves dist, mounts the API, registers actions
  ui/           React + Vite (JavaScript): src/, index.html, package.json, tests
  ui/dist/      build output, not committed; carried inside the compiled wheel
```

`app.py` holds the app id, title and version as constants at the top, and must not hold business logic.

### Static files, dynamic app

Cornea serves the built files in `ui/dist`, but the page is a normal single-page app that talks to Python while it runs:

- **Data:** `fetch('/api/v1/...')` calls the `rayohx_api` routes and gets JSON.
- **Native actions:** `POST /api/bridge/<action>` runs a Python function registered in `app.py`: `app_info` and `open_downloads`. Cornea also provides file and folder pickers, opening links and platform info.
- **State:** the page holds only what is on screen. The download list, its logs and the saved default options (including the download folder and theme) are kept by `rayohx_api` and survive a restart.

Cornea hosts the page and the API on one address, behind a start-up token, a host and origin check and strict response headers. See [security](security.md#under-the-desktop-window).

### The front end

Plain JavaScript with JSX, built by Vite. Python is called only through `src/api/`. Cornea's policy forbids inline scripts and styles, so styles live in CSS files. `npm run build` writes `ui/dist`, which the compiled wheel carries as `rayohx_desktop/assets`, so using the wheel needs no Node.

```text
src/
  api/          the only place that calls Python: client (fetch), bridge, downloads, settings, inspect, clean
  components/
    new/        add a stream: inspect, Quick or Advanced selection, several addresses, playlist text
      options/  the option fields, drawn from data/options-sections.json
    downloads/  the live list, each card, and its engine log
    settings/   defaults, download folder, theme, clean-up, about
  data/         option sections, qualities, codecs, formats and other lists as JSON
  format.js     sizes, speeds and durations as short text
  options.js    reads the option sections and looks up values by field id
  theme.js      Fluent UI themes
```

Each folder holds small components with a test beside each one. The option list lives in `data/options-sections.json`; adding an option there adds its field to the form.

**Default options.** Settings saves the default options for new downloads. The form shows them as hints through the `Inherited` context in `components/new/options/inherited.js`, and a download sends only the options the user changed, so everything else follows the saved defaults. Fields marked `defaultsOnly` (such as quality) appear only in Settings and, for quality, in Quick selection.

**Download log.** A card shows a log button when the download reports `has_log`. The log is fetched when opened and lists what the engine reported.

### Window actions

| Action | Result |
| --- | --- |
| `app_info` | the app name and version |
| `open_downloads` | shows the download folder in Explorer; the page names no path |
