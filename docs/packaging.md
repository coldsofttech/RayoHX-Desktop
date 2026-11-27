# Packaging and releasing

How the window (`rayohx-desktop`) and the API it carries are built and released. They are not published to PyPI and there is no installer: a release attaches compiled Windows wheels to a GitHub release. The [RayoHX](https://github.com/coldsofttech/RayoHX) library they depend on is released to PyPI from its own repository, and the command line from [RayoHX-CLI](https://github.com/coldsofttech/RayoHX-CLI).

## What is built

| What | Where it comes from | Built with |
| --- | --- | --- |
| `rayohx_desktop-<version>-<tag>.whl` | the window, with the built front end inside | `PYD_BUILD=1 uv build --wheel --package rayohx-desktop` |
| `rayohx_api-<version>-<tag>.whl` | the API the window mounts | `PYD_BUILD=1 uv build --wheel --package rayohx-api` |

Both wheels are compiled with Nuitka into one binary each (`rayohx_desktop.<tag>.pyd` on Windows), with `.pyi` stubs beside it and no `.py` sources. The window wheel carries the built front end (`ui/dist`) as `rayohx_desktop/assets`. The `rayohx` library comes from PyPI. No sdist is published, and the release holds Windows wheels only, for Python 3.15 (`[tool.cibuildwheel] build = "cp315-*"` in each package).

## The pieces

- The Python package `rayohx_desktop`, with the `rayohxd` command (`[project.gui-scripts]`), and `rayohx_api`, with the `rayohx-api` command.
- The version of each package is `__version__` in its `__init__.py`; setuptools reads it from there. `setup.py` compiles the package with Nuitka (it needs a C compiler, MSVC) when `PYD_BUILD=1`, and builds plain Python otherwise, so local development is unaffected.
- The built front end (`rayohx_desktop/ui/dist`), copied into the wheel by `setup.py`. Build it first with `npm ci && npm run build` in `packages/desktop/src/rayohx_desktop/ui`; a wheel built without it has no front end, and CI checks that the release wheel has one.
- `python -m rayohx_desktop` and `python -m rayohx_api` work from a source checkout but not from the compiled wheels; use the `rayohxd` and `rayohx-api` commands.

## Building locally

```bash
npm ci --prefix packages/desktop/src/rayohx_desktop/ui
npm run build --prefix packages/desktop/src/rayohx_desktop/ui
PYD_BUILD=1 uv build --wheel --package rayohx-api
PYD_BUILD=1 uv build --wheel --package rayohx-desktop   # dist/rayohx_desktop-<version>-<tag>.whl
uvx twine check --strict dist/*
```

## Checking a build

- The [smoke test](../scripts/smoke/README.md) builds both wheels in a fresh environment and runs them. It is a manual check on your own machine.
- The `build` job in `ci.yml` builds both compiled wheels on every change, checks their metadata, that each holds a binary and its stub but no sources, and that the window wheel carries the front end, so a release never meets a problem for the first time.

## Installing a release

```sh
pip install rayohx_api-*.whl rayohx_desktop-*.whl
rayohxd
```

The window uses the Microsoft Edge WebView2 runtime, already part of Windows 10 and 11. `cornea doctor` checks for it.

## Releasing

Publishing a GitHub release runs `release.yml`. This repository releases one thing, the compiled wheels of `rayohx-desktop` and `rayohx-api`, so the only tag is `v<version>`.

| Tag | Releases | Environment |
| --- | --- | --- |
| `v<version>` | the compiled Windows wheels of `rayohx-desktop` and `rayohx-api`, with `SHA256SUMS.txt`, attached to the GitHub release | `desktop` |

The version is `__version__` in `packages/desktop/src/rayohx_desktop/__init__.py`, and the tag must equal it, for example `v0.2.0` for `__version__ = "0.2.0"`. Keep `rayohx-api` on the same version when you release them together.

### Making a release

1. Release the library first if the packages need a newer one: both depend on the `rayohx` package on PyPI, so that version must already be there.
2. Bump `__version__` in both packages, and move the `[Unreleased]` entries of `CHANGELOG.md` under a `## [x.y.z]` heading. Merge that pull request.
3. Publish a GitHub release tagged `v<version>`. Mark it as a pre-release if it should not be offered as the newest.
4. `release.yml` does the rest:

| Job | Result |
| --- | --- |
| `check` | the tag must start with `v` and be `v` plus the window's version, or the release stops here |
| `frontend` | builds the React front end (`npm run build`) and keeps `ui/dist` for the wheels |
| `build` | compiled wheels of the API and of the window on Windows (a Nuitka `.pyd` each, with stubs and no `.py` sources), for Python 3.15, built with cibuildwheel; the window wheels carry the front end |
| `attach` | waits for a reviewer of the `desktop` environment (Settings > Environments), then attaches the wheels and `SHA256SUMS.txt` to the release |

Every wheel is built, and tested by cibuildwheel, before the approval, so the reviewer approves a release that already works. Attaching uses the workflow's own `GITHUB_TOKEN` with `contents: write`, so no secret is stored. Release notes are written on the GitHub release by hand (or with its "Generate release notes" button); `.github/release.yml` groups the generated ones into features, bug fixes and other changes.

To check a release: download the wheels, run `sha256sum --check SHA256SUMS.txt`, then install them in a clean environment as above and start `rayohxd`.

### Before the first release

- Create the `desktop` environment (Settings > Environments) and add the people who must approve a release as required reviewers.
- Release the `rayohx` library to PyPI, so the wheels can install.
- Check that `__version__` in both packages and the heading in `CHANGELOG.md` match the tag you are about to publish.

### If a release fails

- **The tag check fails:** the tag does not equal the window's `__version__`. Fix the version, merge, and publish a new release with the right tag.
- **A wheel build fails:** reproduce with the [smoke test](../scripts/smoke/README.md) on Windows, fix it in a pull request, and publish a new release. Nuitka supports Python 3.15 only experimentally, so watch that wheel in the matrix.
- **The front end is missing from the window wheel:** the `frontend` job did not upload `ui-dist`, or the download step failed. The `build` job in `ci.yml` checks this on every change, so fix it there first.
- **Files are already attached:** a re-run replaces them (`--clobber`), so you can re-run the `attach` job after a fix on the same tag.
