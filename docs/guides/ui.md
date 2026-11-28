# Window guide

`rayohxd` is the RayoHX desktop window for Windows. It is a front end over the same engine as the
[command line](https://github.com/coldsofttech/RayoHX-CLI/blob/main/docs/guides/cli.md) and the [Python package](https://github.com/coldsofttech/RayoHX/blob/main/docs/guides/python.md):
the window only shows your choices and results, and all the work is done by the `rayohx` library.

![The RayoHX window with the Add a stream form](images/quick.png)

## Install

The easiest way is the Windows setup, `rayohx-desktop-<version>-windows-x64-setup.exe`, from the newest
[release](https://github.com/coldsofttech/RayoHX-Desktop/releases). It needs no Python, installs into
`ColdSoft Technologies\RayoHX Desktop` (for you, or for all users if you choose), adds a Start Menu entry and
optionally a desktop shortcut, and can be removed from Windows Settings > Apps.

If you prefer not to install anything, download the portable zip, `rayohx-desktop-<version>-windows-x64.zip`,
from the same release, extract it anywhere and run `rayohxd\rayohxd.exe`. Either way you need Windows 10 or 11 and
the Microsoft Edge WebView2 runtime, which both already include.

Each release lists SHA-256 checksums in `SHA256SUMS.txt`. Check your download with
`sha256sum --check SHA256SUMS.txt` before installing or extracting it.

To upgrade, run the newer setup over the old one, or extract the newer zip to a fresh folder. Your saved
defaults, download list and logs stay, because they are kept outside the install.

## Open the window

Start it from a terminal:

```text
rayohxd
rayohxd --no-window    # serve the interface for a browser instead of a window
rayohxd --version
```

## The screens

The bar at the top has three pages and a theme switch. The sun and moon button changes between the light
and dark themes, and your choice is remembered.

| Page | What it is for | Guide |
|---|---|---|
| **New** | Add one stream, several, or pasted playlist text; pick a quality or the exact stream | [Add a stream](ui/add-a-stream.md) |
| **Downloads** | Follow, pause, stop and retry downloads, and read what the engine reported | [Downloads](ui/downloads.md) |
| **Settings** | Download folder, default options, clean-up and version | [Settings](ui/settings.md) |

## Keeping secrets safe

Logins and passwords you type for a download are used for that download only. They are never saved with
the default options. Fields for passwords and other secrets are hidden while you type, and the page
shows addresses, errors and logs as plain text. The protections that exist today are in
[security](../security.md#under-the-desktop-window).

## Troubleshooting

- **The window does not open.** The window needs the Microsoft Edge WebView2 runtime. Run
  `cornea doctor` to check for it, or start `rayohxd --no-window` and open the address it prints in a
  browser to see whether the interface itself works.
- **The setup or the zip will not run.** They are built for 64-bit Windows 10 or 11 only. Download them
  from the release and check them against `SHA256SUMS.txt`, as in [Install](#install).
- **A download failed.** Open its log from the card on the [Downloads](ui/downloads.md) page to see what
  the engine reported, and retry it from there.
- **Window logs.** The window's own log is kept in `%LOCALAPPDATA%\Cornea\logs\cornea.log`.
