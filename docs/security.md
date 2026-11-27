# Security

How the API and the desktop window protect requests and data. To report a vulnerability, see [SECURITY.md](../SECURITY.md). The download engine's own protections (redaction, input checks, credentials per host, file names, untrusted media) are in the [core security notes](https://github.com/coldsofttech/RayoHX/blob/main/docs/security.md), and those of the command line are in the [CLI security notes](https://github.com/coldsofttech/RayoHX-CLI/blob/main/docs/security.md).

## The API on its own

When run alone (`python -m rayohx_api`), Cornea is absent, so the API protects itself:

- **API key:** protected routes need an `X-API-Key` header matching `RAYOHX_API_API_KEYS`. The app will not start without a key unless `RAYOHX_API_AUTH_MODE=none`, which is for local development only. Keys are compared in constant time and never logged.
- **Headers:** `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a restrictive CSP, `Cache-Control: no-store` on `/api/` and HSTS over HTTPS.
- **Body limit:** requests declaring more than `RAYOHX_API_MAX_BODY_BYTES` get `413`. Also set a limit at your reverse proxy, since chunked bodies have no declared size.
- **Server files:** requests may not name files on the server (cookie files, certificates, FFmpeg, key files) unless `RAYOHX_API_ALLOW_LOCAL_PATHS=true`, which suits only a client you fully trust. Output and working folders must stay inside the download folder, and symbolic links that leave it are refused.
- **Docs hidden:** `/docs`, `/redoc` and `/openapi.json` are off unless `RAYOHX_API_DOCS_ENABLED=true`.
- **Saved data:** the download list, engine logs and default options are kept in a small SQLite file (`RAYOHX_API_DB_PATH`). Proxy user names and passwords and key passwords are never saved, and saved defaults follow the same rules as a request, so they cannot name server files unless `RAYOHX_API_ALLOW_LOCAL_PATHS=true`. Keep the file private to the account that runs the API.
- **Errors:** a `500` never shows details; they go to the log with the request ID.
- **Not included:** HTTPS, rate limiting, JWT and multi-user authentication, a shared or networked database. Add them, or put the API behind a proxy, before exposing it publicly.

## Under the desktop window

When the desktop window mounts the API routes, Cornea's `SecurityMiddleware` guards every request, so the API switches its own key check and duplicate response headers off (`create_app(embedded=True)`) and adds no token of its own:

- the `Host` must be on the allow-list (the bound `127.0.0.1:<port>` only)
- state-changing requests (POST, PUT, PATCH, DELETE) must carry a matching `Origin`
- a one-time start-up token is exchanged for an `HttpOnly`, `SameSite=Strict` session cookie
- responses carry a strict content security policy and other protective headers

`rayohx_desktop` therefore mounts the routes with API-key checks switched off. The only client is the person at the window, so the window also sets `RAYOHX_API_ALLOW_LOCAL_PATHS=true` for its own process. Never expose these routes any other way.

### The front end

- Inline scripts and styles are forbidden by the content security policy, so all code and styles are in files.
- `--dev` relaxes the policy for Vite; use it only while developing.
- Python is reached only through `src/api/` and the registered bridge actions.
- **Secrets in forms.** Fields of type `secret` (such as passwords) are hidden while typed. The saved default options never keep logins or passwords; they are sent only with the download they were typed for.
- **Output is escaped.** Addresses, errors and the engine log are shown as text by React. The page never builds HTML from them.
- **Local paths.** Fields that point at files on this computer (cookie files, certificates, the download folder) appear only when the API allows local paths.
- **Fixed native actions.** `open_downloads` takes no path, so the page can only open the folder downloads are saved in.

## What you install

- **Compiled wheels.** The window and the API are released as compiled wheels with no `.py` sources, attached to a GitHub release. There is no installer, so nothing changes `PATH` or the registry.
- **Check what you download.** Each release carries `SHA256SUMS.txt`: run `sha256sum --check SHA256SUMS.txt` (or `Get-FileHash` on Windows) before installing. The wheels are not signed.
- **Install in an isolated environment.** Use a virtual environment or `pipx`, so the window's dependencies stay apart from your other tools.
- **Released carefully.** The files are attached only after everything is built and a reviewer approves the `desktop` environment, using the workflow's own token with no stored secret. See [packaging and releasing](packaging.md#releasing).

## Supply chain

- **Locked dependencies.** `uv.lock` pins every Python dependency and `package-lock.json` every npm one; CI installs with `--locked` and `npm ci`.
- **Weekly audit.** `audit.yml` runs pip-audit on the locked Python dependencies (runtime and development, every package) and `npm audit` on the front end every week, and whenever a lockfile changes.
- **Dependency review.** `dependency-review.yml` checks the dependencies a pull request adds or changes.
- **Static analysis.** `security.yml` runs Semgrep on both packages (Python, JavaScript and React rules) and on the workflows, on every pull request and every week, and sends the findings to code scanning.
- **Updates.** Dependabot proposes updates to the Python and npm dependencies and to the GitHub Actions, with a 7-day cooldown.
- **Secret scanning.** The pre-commit hooks run gitleaks before a commit.

## Not included

The window runs with your permissions and does not sandbox the media it downloads; only download from sources you trust.
