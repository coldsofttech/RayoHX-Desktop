# Packaging and releasing

How the window (`rayohx-desktop`) and the API it carries are built and released. They are not published to PyPI: a release attaches a Windows setup and a portable zip of the frozen app to a GitHub release. The [RayoHX](https://github.com/coldsofttech/RayoHX) library they depend on is released to PyPI from its own repository, and the command line from [RayoHX-CLI](https://github.com/coldsofttech/RayoHX-CLI).

## What is built

| What | Where it comes from | Built with |
| --- | --- | --- |
| `rayohx-desktop-<version>-windows-x64-setup.exe` | the frozen app, wrapped in an NSIS setup | `python scripts/build.py --setup` |
| `rayohx-desktop-<version>-windows-x64.zip` | the frozen app (`rayohxd/rayohxd.exe` and `lib/`), portable | `python scripts/build.py` |

The app is frozen with PyInstaller from two compiled wheels, `rayohx_desktop` and `rayohx_api`, which are build inputs and not something users install. Each is compiled with Nuitka into one binary (`rayohx_desktop.<tag>.pyd` on Windows), with `.pyi` stubs beside it and no `.py` sources, and the window wheel carries the built front end (`ui/dist`) as `rayohx_desktop/assets`. The `rayohx` library comes from PyPI at build time. No sdist is published, and the build is for Windows and Python 3.15 only (`[tool.cibuildwheel] build = "cp315-*"` in each package).

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

## The Windows setup

`python scripts/build.py --setup` freezes the app, then wraps the frozen folder in an NSIS setup, `dist/rayohx-desktop-<version>-windows-x64-setup.exe`. It needs NSIS (`makensis`); the version CI uses is pinned in `installer/tools.toml`.

- `installer/windows/setup.nsi` holds what is specific to the desktop app; the behavior (pages, per-user or all-users install, silent use, uninstaller) is in `installer/windows/common.nsh`.
- The `[setup]` table of `installer/build.toml` holds the product GUID, the install folder (`ColdSoft Technologies\RayoHX Desktop`, under Program Files for all users or `%LOCALAPPDATA%\Programs` for one user), the Start Menu folder and the brand files. Never change the GUID after a release: Windows uses it to find the installed app.
- `build.py` writes the list of installed files for the uninstaller, so it removes only what setup installed. Settings and downloads in `%LOCALAPPDATA%\ColdSoft Technologies\RayoHX` stay unless the user agrees (or `/PURGE` is passed silently).
- Silent use: `setup.exe /S [/allusers | /currentuser] [/DESKTOP] [/D=C:\folder]` and `uninstall.exe /S [/PURGE]`.
- The `freeze` job of `release.yml` and the `build` job of `ci.yml` build the setup, then install it silently, run `rayohxd --version`, uninstall it and check nothing is left (`.github/actions/test-setup`). NSIS is installed by `.github/actions/install-nsis`.

## Checking a build

- The [smoke test](../scripts/smoke/README.md) builds both wheels in a fresh environment and runs them. It is a manual check on your own machine.
- The `build` job in `ci.yml` builds both compiled wheels on every change, checks their metadata, that each holds a binary and its stub but no sources, and that the window wheel carries the front end, so a release never meets a problem for the first time.

## Installing a release

Run `rayohx-desktop-<version>-windows-x64-setup.exe`, or extract `rayohx-desktop-<version>-windows-x64.zip` and run `rayohxd\rayohxd.exe`. Users never install the wheels.

The window uses the Microsoft Edge WebView2 runtime, already part of Windows 10 and 11. `cornea doctor` checks for it.

## Releasing

Publishing a GitHub release runs `release.yml`. This repository releases one thing, the RayoHX Desktop app (which carries the API), so the only tag is `v<version>`.

| Tag | Releases | Environment |
| --- | --- | --- |
| `v<version>` | the Windows setup and the portable zip, with `SHA256SUMS.txt`, attached to the GitHub release | `desktop` |

The version is `__version__` in `packages/desktop/src/rayohx_desktop/__init__.py`, and the tag must equal it, for example `v0.2.0` for `__version__ = "0.2.0"`. Keep `rayohx-api` on the same version when you release them together.

### Making a release

1. Release the library first if the packages need a newer one: both depend on the `rayohx` package on PyPI, so that version must already be there.
2. Bump `__version__` in both packages, and move the `[Unreleased]` entries of `CHANGELOG.md` under a `## [x.y.z]` heading. Merge that pull request.
3. Publish a GitHub release tagged `v<version>`. Mark it as a pre-release if it should not be offered as the newest.
4. `release.yml` does the rest:

| Job | Result |
| --- | --- |
| `check` | the tag must start with `v` and be `v` plus the window's version, or the release stops here |
| `frontend` | builds the React front end (`npm run build`) and keeps `ui/dist` for the build |
| `build` | compiled wheels of the API and of the window on Windows (a Nuitka `.pyd` each, with stubs and no `.py` sources), for Python 3.15, built with cibuildwheel; the window wheel carries the front end |
| `freeze` | freezes them with PyInstaller into the portable zip, builds the setup, and installs and uninstalls it silently as a check |
| `attach` | waits for a reviewer of the `desktop` environment (Settings > Environments), then attaches the setup, the zip and `SHA256SUMS.txt` to the release |

Every wheel is built, and tested by cibuildwheel, and the setup is installed and removed once, before the approval, so the reviewer approves a release that already works. Attaching uses the workflow's own `GITHUB_TOKEN` with `contents: write`, so no secret is stored. Release notes are written on the GitHub release by hand (or with its "Generate release notes" button); `.github/release.yml` groups the generated ones into features, bug fixes and other changes.

To check a release: download the setup and the zip, run `sha256sum --check SHA256SUMS.txt`, then install or extract one on a clean machine as above and start the app.

### Before the first release

- Create the `desktop` environment (Settings > Environments) and add the people who must approve a release as required reviewers.
- Release the `rayohx` library to PyPI, so the build can install it.
- Check that `__version__` in both packages and the heading in `CHANGELOG.md` match the tag you are about to publish.

### If a release fails

- **The tag check fails:** the tag does not equal the window's `__version__`. Fix the version, merge, and publish a new release with the right tag.
- **A wheel build fails:** reproduce with the [smoke test](../scripts/smoke/README.md) on Windows, fix it in a pull request, and publish a new release. Nuitka supports Python 3.15 only experimentally, so watch that wheel in the matrix.
- **The front end is missing from the window wheel:** the `frontend` job did not upload `ui-dist`, or the download step failed. The `build` job in `ci.yml` checks this on every change, so fix it there first.
- **Files are already attached:** a re-run replaces them (`--clobber`), so you can re-run the `attach` job after a fix on the same tag.
