# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-27

### Added

- Save default options for every download from Settings, and read a per-download log of what happened.
- An Open folder button on Downloads shows the download folder in Explorer.
- When a download fails because the file already exists, an Overwrite button replaces it and starts the download again.
- After inspecting a stream, pick it with Quick (a quality) or Advanced (stream, size, codec and tracks), then download with one button.
- Choose the folder downloads are saved in from Settings. It, the theme and your other defaults are remembered between restarts.
- A window with light and dark themes to add and inspect a stream, follow downloads live and change settings.
- The RayoHX desktop window for Windows, started with `rayohxd`, with the HTTP API built in.
- The parallel segments slider now spans the range the engine accepts, instead of a fixed 1 to 16.
- Files on this computer, such as cookie files and certificates, can be used for downloads in the window.
- Your download list is kept between restarts, and a download cut short by closing the app shows as failed.
- A clear history button removes finished downloads, and a retry button restarts one that failed.
- Each download shows the quality it was started with.
- Every download option is available in the window, and you can download several streams at once or paste playlist text.
- Releases ship as compiled Windows wheels with a type stub and no source files.
- Default options for new downloads can be saved and are used unless a download sets its own; logins and passwords are never saved.
- Each download keeps a log of what the engine reported, kept between restarts.
- A failed download reports why it failed, and retry can replace an existing file.
- The download folder and theme are saved between restarts, and the folder can be changed from the window.
- The download list is saved between restarts, finished downloads can be cleared, and downloads cut short by a restart show as failed.
- `/api/v1` routes to inspect a playlist, run, pause, resume, cancel and follow downloads (with server-sent events), read and change defaults, and clean leftover working folders.
- The `rayohx-api` web service, with health and readiness checks and API-key authentication (or none, for local development).
- Settings through `RAYOHX_API_` environment variables or a `.env` file, JSON logs and consistent error responses.
- Every engine option can be set when starting a download, grouped as network, selection, storage, output and engine settings.
- Several addresses can be started at once, and a playlist you already have as text can be inspected or downloaded.
- The settings endpoint reports the fewest and most parallel segments the engine accepts, so clients need not hard-code them.
- Settings that point at files on the server are refused unless `RAYOHX_API_ALLOW_LOCAL_PATHS` is on.
- Security headers on every response and a limit on request size.
- Requires Python 3.15 or newer.

### Changed

- The API and the desktop window now live in this repository, released together as compiled Windows wheels on GitHub. They are no longer published to PyPI and there is no installer here.
- Renamed the project from RayoHX-UI to RayoHX-Desktop. The package is now `rayohx-desktop`, so update any installs and imports that use `rayohx-ui` or `rayohx_ui`.
- Now requires `rayohx` 0.1.1 or newer.
