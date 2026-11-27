# Contributing

Thanks for taking the time to contribute! By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and requesting features

Open an issue using one of the provided forms. Search existing issues first. For security problems, do **not** open an issue; follow [SECURITY.md](SECURITY.md).

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Make your change, keeping it focused on one thing.
3. Set up with [uv](https://docs.astral.sh/uv/): `uv sync`, then `uv run pre-commit install --hook-type pre-commit --hook-type post-commit`.
4. Run the checks for what you changed (below) before you push.
5. Add an entry under `[Unreleased]` in `CHANGELOG.md` (one or two lines, written from a reader's point of view).
6. Open a pull request and fill in the template.

## Checks by area

Run these from the repository root. Scope them to the package you changed rather than running everything.

| You changed | Run |
| --- | --- |
| Any Python | `uv run ruff check packages/<package>`, `uv run ruff format --check packages/<package>`, `uv run mypy packages/<package>/src` and `uv run pytest packages/<package>/tests --no-cov` |
| The API (`packages/api`) | The Python checks above, then `uv run python packages/api/scripts/export_openapi.py` and commit `docs/openapi.json` |
| The window (`packages/desktop`) | The Python checks above for `desktop` |
| The front end (`packages/desktop/src/rayohx_desktop/ui`) | `npm ci`, `npm run lint`, `npm test` and `npm run build` in that folder |
| A workflow | `actionlint` passes (it runs in pre-commit) |

You need Windows (the API and the window are for Windows only) and Node for front end work. The window's Python tests use a stand-in for the window, so no window opens. The tests use the shared `rayohx-pytest` plugin from the [RayoHX](https://github.com/coldsofttech/RayoHX) repository, which `uv sync` installs from git. See [development](docs/development.md) and [testing](docs/testing.md).

## Pull request rules

- `main` is protected: changes land through pull requests that are squash-merged.
- Required checks must pass and the branch must be up to date.
- A code owner must review, and all conversations must be resolved.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example `fix: handle empty input`.
