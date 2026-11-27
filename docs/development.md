# Development

How to work on this repository: set-up, running, the checks, and how to add to the API, the front end and the compiled builds. For how it is built, see [architecture](architecture.md); for the tests, see [testing](testing.md). The pull request process is in the [contributing guide](../CONTRIBUTING.md).

## Layout

```text
packages/api/       rayohx-api (src/rayohx_api, tests, docs)
packages/desktop/   rayohx-desktop (src/rayohx_desktop, with the React front end in ui/)
scripts/dev/        local.py, which points rayohx at a local checkout of the library
scripts/smoke/      a manual check of the compiled wheels
docs/               these notes
```

## Set up

You need [uv](https://docs.astral.sh/uv/) and, for the front end, Node.js (the version in `packages/desktop/src/rayohx_desktop/ui/.nvmrc`). The API and the window are for Windows only, and so are CI and the releases.

```bash
uv sync --locked                                              # both packages and the dev tools
npm ci --prefix packages/desktop/src/rayohx_desktop/ui        # the front end
uv run pre-commit install --hook-type pre-commit --hook-type post-commit
```

`uv sync` takes `rayohx` from PyPI and the shared test plugin `rayohx-pytest` from git (tag `pytest-v0.1.0`).

## Working with the library

To try the packages against a local checkout of the library, install it into the environment on top of the published one:

```bash
uv pip install -e ../RayoHX/packages/core
```

Run `uv sync --locked` again to go back to the published library. To change `pyproject.toml` and `uv.lock` to editable local sources for `rayohx` and `rayohx-pytest` instead (paths from `RAYOHX_PATH` and `RAYOHX_PYTEST_PATH`), run `python scripts/dev/local.py --local`, and `python scripts/dev/local.py` to switch back to the committable sources. Use plain `python` for it, not `uv run`. Never commit the local form.

## Run

```bash
cp packages/api/.env.example .env                             # first: set RAYOHX_API_API_KEYS, or RAYOHX_API_AUTH_MODE=none
uv run python -m rayohx_api                                   # the API on http://127.0.0.1:8000

npm run build --prefix packages/desktop/src/rayohx_desktop/ui # writes ui/dist, which the window serves
uv run python -m rayohx_desktop                               # the window
uv run python -m rayohx_desktop --no-window                   # prints an address for a browser
uv run python -m rayohx_desktop --dev                         # the window with Vite hot reload (needs Node)
npm run dev --prefix packages/desktop/src/rayohx_desktop/ui   # the front end alone, with hot reload
```

The API reads `RAYOHX_API_*` settings from the environment or a `.env` file. Set `RAYOHX_API_DOCS_ENABLED=true` to get `/docs` and `/redoc` while you work. `--dev` starts `npm run dev` through Cornea and relaxes the content security policy for Vite, so use it only while developing.

## Checks

Run only what your change touches:

```bash
uv run ruff check packages/api                      # or packages/desktop
uv run ruff format --check packages/api
uv run mypy packages/api/src
uv run pytest packages/api/tests/unit --no-cov      # see testing.md for the rest
npm run lint --prefix packages/desktop/src/rayohx_desktop/ui
npm test --prefix packages/desktop/src/rayohx_desktop/ui
```

The `--no-cov` flag is needed because the coverage threshold in the root `pyproject.toml` applies to both packages, not one. What the tests cover and how to run them are in [testing](testing.md). CI (`ci.yml`) runs the same checks as separate jobs: `lint` (ruff, mypy, the OpenAPI check, pre-commit and the dependency licenses), `lint-npm`, `test` (one per package), `test-npm`, `build-npm`, `int-test` (api and desktop) and `build` (the compiled wheels and a `--version` smoke test), with `ci` as the single check the branch ruleset needs. Other workflows run outside that check: `security.yml` (Semgrep), `audit.yml` (`pip-audit` on the locked dependencies), `dependency-review.yml` and `api-compat.yml` (breaking API changes on a pull request).

## Adding an API endpoint

1. Add the request and response models to the matching file in `schemas/v1/` (or a new one, re-exported from `schemas/v1/__init__.py`), with `Field` descriptions, examples and a maximum length on every string.
2. Add the handler to the matching file in `routers/v1/` (or a new one, included in `routers/v1/__init__.py`). Keep it thin: validate, call `rayohx`, return the model. Annotate the return type, use plain `def` for anything that can block, and declare every non-200 response in `responses=`.
3. Map library errors to HTTP errors in the router. Never return the text of an unexpected exception.
4. Protect it with `Depends(authenticate)` unless it is a probe.
5. Add tests for the behaviour and for each status code the route declares.
6. Regenerate the contract (below) and commit [`openapi.json`](openapi.json). CI fails if it is out of date.
7. Update the [API guide](api.md) (endpoints table), the [security notes](security.md) if you added a protection, and the `[Unreleased]` section of `CHANGELOG.md`.

A breaking change goes in a new `/api/v2` router, not in `/api/v1`.

## Adding an API setting

Add it to `Settings` in `config.py`, read it through `get_settings()` (never `os.environ`), and add a row to the settings table in the [API guide](api.md).

## The OpenAPI contract

After changing routes or schemas, regenerate the contract and commit it; CI fails if it is out of date, and `api-compat.yml` flags breaking changes on a pull request:

```bash
uv run python packages/api/scripts/export_openapi.py
```

## Writing the front end

- Plain JavaScript with JSX. Call Python only through `src/api/`.
- Put styles in CSS files; the content security policy forbids inline scripts and styles.
- The interface uses Fluent UI (`@fluentui/react-components`). Colours live in one place, `src/theme.js`, built from the RayoHX logo colours (amber to red-orange, maroon, near-black neutrals), with red for danger and amber for warnings. Fluent adds its styles through the browser's style API, which Cornea's default `style-src 'self'` blocks. The window therefore uses that policy with `'unsafe-inline'` added to `style-src` only (scripts stay strict).
- The Node version is in `.nvmrc`.

```bash
npm run dev       # Vite dev server
npm run build     # writes dist/
npm run lint      # ESLint
npm test          # Vitest, Testing Library and an accessibility check
npm run format    # Prettier
```

Run them in `packages/desktop/src/rayohx_desktop/ui`, or add `--prefix` as above.

- One small component per file, with a test beside it (`Name.jsx`, `Name.test.jsx`). The folders are described in [architecture](architecture.md#the-front-end).
- Lists and option definitions live as JSON in `src/data/`, not in components.
- Name plain JavaScript modules in lower case (`inherited.js`) and components in PascalCase (`Card.jsx`).
- The project type-checks JavaScript through `jsconfig.json`, so give props and callbacks JSDoc types.
- Front end tests use Vitest and Testing Library with `fetch` mocked, query by role and label, and run an accessibility check on each component. A test that reads what the page sent should go through a small helper that types the mock's calls, as in `Card.test.jsx`.

## Compiled builds (.pyd)

A release ships compiled modules, not plain `.py` sources. Each package's `setup.py` compiles the whole package with Nuitka into a single binary when `PYD_BUILD=1`; the `release` workflow sets it and builds one Windows wheel per Python version with cibuildwheel. Each wheel is tested with the unit tests before it is attached to the release. The window wheel also carries the built front end (`ui/dist`) as `rayohx_desktop/assets`.

- The binary is `rayohx_api.<tag>.pyd` (and `rayohx_desktop.<tag>.pyd`) on Windows, with every submodule inside it. No sdist is published, and the release holds Windows wheels only.
- Nuitka needs a C compiler (MSVC). `--mingw64` is not available on Python 3.13 or newer.
- `python -m rayohx_api` and `python -m rayohx_desktop` do not work on the compiled builds because `__main__` is embedded in the binary. The `rayohx-api` and `rayohxd` commands do.
- Compiling is obfuscation, not encryption: it raises the effort needed to read the code but does not make it secret.
- Without `PYD_BUILD`, `uv sync`, tests and coverage run against the plain sources. To try it locally, run `PYD_BUILD=1 uv build --wheel --package rayohx-api` (and `--package rayohx-desktop`, after `npm run build`). CI does this on every change and checks that each wheel holds the binary and its `.pyi` stub but no sources.
- `stubgen` writes one `.pyi` per module into a folder beside the binary (no `__init__.py`, so Python still loads the binary), so users still get type checking. The stubs show signatures and docstrings, not implementations.
- Nuitka supports Python 3.15 only experimentally (as of 4.3.5), so watch that wheel in the release matrix.
- Both packages are released together with the tag `v<version>` and attached to the GitHub release. They are not published to PyPI. See [packaging and releasing](packaging.md#releasing).

### Smoke test the compiled builds

`scripts/smoke/` builds both compiled wheels, with the built front end inside the window wheel, and tries them in a fresh virtual environment. It is a manual check that needs network access, a C compiler and Node.js. See the [smoke test README](../scripts/smoke/README.md): `test_api.py` starts `rayohx-api` on port 8765 with authentication off, and `test_desktop.py` starts `rayohxd --no-window`; each inspects a stream through `/api/v1/inspect`.

## Versions

Each package keeps its version only in `__version__` in its `__init__.py`; `pyproject.toml` reads it. Don't change it or push the release tag in a normal change, because the maintainer does that when cutting a release (see [packaging and releasing](packaging.md#releasing)).

## Rules to keep

- The library does the work. If a route or the window needs logic, it probably belongs in `rayohx`.
- Log with the `logging` module, never `print`, and never log keys or request bodies.
- Do not add global state; the API's settings are the one cached object.
- Never turn a protection off to make a test pass. Use `RAYOHX_API_AUTH_MODE=none` in a test's environment instead.
- Explain any `# noqa` or `# nosemgrep` with a reason in the comment.
