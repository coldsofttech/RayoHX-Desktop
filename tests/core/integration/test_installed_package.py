import subprocess
import sys

import rayohx_package


def test_package_imports_in_fresh_interpreter() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import rayohx_package; print(rayohx_package.__version__)"],
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stdout.strip() == rayohx_package.__version__
