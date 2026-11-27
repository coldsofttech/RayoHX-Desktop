from typing import Any

import pytest
from pydantic import ValidationError

from rayohx_api.schemas.v1 import Defaults, Limits, SettingsUpdate, SettingsView


def _view(**overrides: Any) -> SettingsView:
    data: dict[str, Any] = {
        "download_dir": "d",
        "max_active_downloads": 2,
        "allow_local_paths": False,
        "limits": {"min_concurrency": 1, "max_concurrency": 64},
        "version": "1",
        "defaults": {},
    }
    return SettingsView(**{**data, **overrides})


def test_view_defaults() -> None:
    view = _view()
    assert view.theme is None
    assert view.defaults == {}


def test_update_is_all_optional() -> None:
    assert SettingsUpdate().model_dump(exclude_unset=True) == {}
    update = SettingsUpdate(theme="dark", download_dir="/downloads")
    assert update.model_dump(exclude_none=True) == {"theme": "dark", "download_dir": "/downloads"}


def test_update_rejects_invalid() -> None:
    with pytest.raises(ValidationError):
        SettingsUpdate(theme="pink")  # type: ignore[arg-type]


def test_limits_are_required_on_the_view() -> None:
    with pytest.raises(ValidationError):
        SettingsView(
            download_dir="d",
            max_active_downloads=2,
            allow_local_paths=False,
            version="1",
            defaults={},
        )  # type: ignore[call-arg]
    assert Limits(min_concurrency=1, max_concurrency=64).max_concurrency == 64


def test_defaults_keep_only_what_was_set() -> None:
    chosen = Defaults(selection={"quality": "720p"})  # type: ignore[arg-type]
    assert chosen.model_dump(exclude_unset=True) == {"selection": {"quality": "720p"}}
    assert Defaults().model_dump(exclude_unset=True) == {}


def test_defaults_reject_invalid_options() -> None:
    with pytest.raises(ValidationError):
        Defaults(engine={"concurrency": 0})  # type: ignore[arg-type]
