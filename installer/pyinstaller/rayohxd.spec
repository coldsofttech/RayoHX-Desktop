# PyInstaller spec for the desktop window, in one folder.
#
#   rayohxd.exe   the window (no console)
#   lib/          the Python runtime and the dependencies
#
# One-folder build on purpose (no one-file build). It freezes the compiled wheels of rayohx-api and
# rayohx-desktop, with the rayohx library from PyPI, so run it with the interpreter of the
# environment they are installed in; scripts/build.py sets that up:
#   python scripts/build.py

import ast
import py_compile
import re
import sys
import tomllib
from importlib import metadata
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name
from PyInstaller.building.api import COLLECT, EXE, PYZ
from PyInstaller.building.build_main import Analysis
from PyInstaller.config import CONF
from PyInstaller.utils.hooks import (
    collect_all,
    collect_submodules,
    copy_metadata,
)
from PyInstaller.utils.win32.versioninfo import (
    FixedFileInfo,
    StringFileInfo,
    StringStruct,
    StringTable,
    VarFileInfo,
    VarStruct,
    VSVersionInfo,
)

ROOT = Path(SPECPATH).parents[1]
PACKAGE = "rayohx_desktop"

# Names, dependencies and what the build leaves out or compiles: [freeze] in installer/build.toml.
SETTINGS = tomllib.loads((ROOT / "installer" / "build.toml").read_text(encoding="utf-8"))["freeze"]
NAME = SETTINGS["name"]
TITLE = SETTINGS["title"]
PUBLISHER = SETTINGS["publisher"]
COMPILED = SETTINGS["compiled"]
COLLECT_WHOLE = SETTINGS["collect"]
EXCLUDES = SETTINGS["excludes"]
METADATA = SETTINGS["metadata"]
HIDDEN_IMPORTS = SETTINGS["hidden-imports"]
COMPILE = SETTINGS["compile"]


def sources():
    """The ``.py`` and ``.pyi`` files of the compiled distributions, as source text."""
    for name in COMPILED:
        for file in metadata.distribution(name).files or []:
            if file.suffix in {".py", ".pyi"}:
                yield file.locate().read_text(encoding="utf-8", errors="replace")


def stdlib_modules():
    """The standard library modules the stubs and sources import (a binary hides its imports)."""
    found = set()
    for text in sources():
        try:
            tree = ast.parse(text)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module, *(f"{node.module}.{a.name}" for a in node.names)]
            else:
                continue
            found.update(n for n in names if n.split(".")[0] in sys.stdlib_module_names)
    return sorted(found)


def top_levels(distribution):
    """The names a distribution is imported as."""
    listed = distribution.read_text("top_level.txt")
    if listed:
        return {line.strip().replace("/", ".") for line in listed.splitlines() if line.strip()}
    found = set()
    for file in distribution.files or []:
        part = file.parts[0]
        if part.startswith(("..", "__")) or part.endswith((".dist-info", ".data", ".pth")):
            continue
        name = part.split(".")[0] if part.endswith((".py", ".pyd")) else part
        if name.isidentifier():
            found.add(name)
    return found


def third_party_modules():
    """The libraries the compiled distributions need, and what those need in turn."""
    own = {canonicalize_name(name) for name in COMPILED}
    pending = [Requirement(text) for name in COMPILED for text in metadata.requires(name) or []]
    seen = set()
    modules = set()
    while pending:
        requirement = pending.pop()
        name = canonicalize_name(requirement.name)
        extras = frozenset(requirement.extras)
        if name in own or (name, extras) in seen:
            continue
        if requirement.marker and not requirement.marker.evaluate({"extra": ""}):
            continue
        seen.add((name, extras))
        try:
            distribution = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            continue
        modules |= top_levels(distribution)
        for text in distribution.requires or []:
            needed = Requirement(text)
            if needed.marker is None or any(
                needed.marker.evaluate({"extra": extra}) for extra in ("", *extras)
            ):
                pending.append(needed)
    return sorted(modules)


def version_info(version):
    """Windows file properties (Explorer > Properties > Details)."""
    numbers = [int(n) for n in re.findall(r"\d+", version)[:4]]
    numbers = tuple(numbers + [0] * (4 - len(numbers)))
    strings = {
        "CompanyName": PUBLISHER,
        "FileDescription": TITLE,
        "FileVersion": version,
        "ProductName": TITLE,
        "ProductVersion": version,
        "LegalCopyright": f"Apache-2.0. {PUBLISHER}",
    }
    return VSVersionInfo(
        ffi=FixedFileInfo(
            filevers=numbers, prodvers=numbers, mask=0x3F, flags=0x0, OS=0x40004,
            fileType=0x1, subtype=0x0, date=(0, 0),
        ),  # fmt: skip
        kids=[
            StringFileInfo(
                [StringTable("040904B0", [StringStruct(k, v) for k, v in strings.items()])]
            ),
            VarFileInfo([VarStruct("Translation", [1033, 1200])]),
        ],
    )


def compile_sources(entries):
    """Ship the ``.py`` data files of the ``compile`` folders as compiled ``.pyc`` files.

    The folders are paths under ``lib/``. A ``.pyc`` next to where its source was is imported
    without the source. It is compiled with the Python that runs the build, which is the one that
    is frozen, and does not check the source's timestamp. The source's path is replaced by the
    file's place in ``lib/``, so tracebacks do not show the build machine's folders.
    """
    folders = tuple(f"{folder.strip('/')}/" for folder in COMPILE)
    out = Path(CONF["workpath"]) / "pyc"
    converted = []
    for entry in entries:
        dest = entry[0].replace("\\", "/")
        if not (dest.endswith(".py") and dest.startswith(folders)):
            converted.append(entry)
            continue
        target = out / f"{dest}c"
        target.parent.mkdir(parents=True, exist_ok=True)
        py_compile.compile(
            entry[1],
            cfile=str(target),
            dfile=dest,
            doraise=True,
            invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH,
        )
        converted.append((f"{dest}c", str(target), entry[2]))
    return converted


def without_dist_info(entries):
    """The entries without the ``*.dist-info`` folders, which are not read at run time."""
    return [entry for entry in entries if ".dist-info/" not in entry[0].replace("\\", "/")]


def third_party_licences(entries):
    """One file with the licence texts of the ``*.dist-info`` folders, to ship in ``lib/``."""
    found = {}
    for entry in entries:
        dest = entry[0].replace("\\", "/")
        folder, _, name = dest.partition(".dist-info/")
        if not name or not folder or "/" in folder:
            continue
        found.setdefault(folder, {})[dest] = Path(entry[1])
    rule = "=" * 78
    parts = ["Third-party software in this folder, with its licences.\n"]
    for folder, items in sorted(found.items()):
        parts.append(f"\n{rule}\n{folder}\n{rule}\n")
        wanted = [
            path for dest, path in sorted(items.items())
            if path.name.upper().startswith(("LICEN", "COPYING", "NOTICE", "AUTHORS"))
        ]  # fmt: skip
        for path in wanted or [path for path in items.values() if path.name == "METADATA"]:
            text = path.read_text(encoding="utf-8", errors="replace")
            parts.append(f"\n--- {path.name} ---\n{text}")
    target = Path(CONF["workpath"]) / "THIRD_PARTY_LICENSES.txt"
    target.write_text("".join(parts), encoding="utf-8")
    return (target.name, str(target), "DATA")


datas, binaries, hiddenimports = [], [], []
for module in COLLECT_WHOLE:
    module_datas, module_binaries, module_hidden = collect_all(module)
    datas += module_datas
    binaries += module_binaries
    hiddenimports += module_hidden
for distribution in METADATA:
    datas += copy_metadata(distribution)

# The built front end sits in assets/ beside the window's binary.
# The package is one compiled file, so PyInstaller cannot list it; the wheel's file list can.
assets = [
    (str(file.locate()), str(Path(*file.parts[:-1])))
    for file in metadata.distribution("rayohx-desktop").files or []
    if file.parts[:2] == (PACKAGE, "assets")
]
if not assets:
    raise SystemExit("rayohx-desktop ships no front end in assets/; build it before the wheel.")
datas += assets

hiddenimports += ["rayohx", "rayohx_api", PACKAGE, *stdlib_modules(), *HIDDEN_IMPORTS]
for module in third_party_modules():
    if module not in EXCLUDES:
        hiddenimports += collect_submodules(module)

entry = Path(CONF["workpath"]) / "entry_rayohxd.py"
entry.parent.mkdir(parents=True, exist_ok=True)
entry.write_text(
    "import multiprocessing\n"
    f"from {PACKAGE}.__main__ import main\n\n"
    'if __name__ == "__main__":\n'
    "    multiprocessing.freeze_support()\n"
    "    raise SystemExit(main())\n",
    encoding="utf-8",
)

analysis = Analysis(
    [str(entry)],
    binaries=binaries,
    datas=datas,
    hiddenimports=[m for m in hiddenimports if m.split(".")[0] not in EXCLUDES],
    excludes=EXCLUDES,
    noarchive=False,
)
analysis.datas = compile_sources(analysis.datas)
licences = third_party_licences(analysis.datas)
analysis.datas = without_dist_info(analysis.datas)
analysis.binaries = without_dist_info(analysis.binaries)
exe = EXE(
    PYZ(analysis.pure),
    analysis.scripts,
    [],
    exclude_binaries=True,
    name=NAME,
    console=False,
    icon=str(ROOT / "brand" / "dark" / "app.ico"),
    version=version_info(metadata.version("rayohx-desktop")),
    upx=False,
    # Everything but the executable goes in lib/ (COLLECT follows the EXE).
    contents_directory="lib",
)
COLLECT(exe, analysis.binaries, [*analysis.datas, licences], name=NAME, upx=False)
