from pathlib import Path

import pytest
from pydantic import ValidationError

from rayohx_api.config import AuthMode, Settings, get_settings


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RAYOHX_API_AUTH_MODE")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.host == "127.0.0.1"
    assert settings.port == 8000
    assert settings.docs_enabled is False
    assert settings.auth_mode is AuthMode.API_KEY
    assert settings.api_keys == []
    assert settings.max_active_downloads == 2
    assert settings.allow_local_paths is False


def test_reads_prefixed_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("RAYOHX_API_PORT", "9001")
    monkeypatch.setenv("RAYOHX_API_DOWNLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("RAYOHX_API_CORS_ORIGINS", '["http://a.test"]')
    monkeypatch.setenv("RAYOHX_API_API_KEYS", '["secret"]')
    settings = Settings()
    assert settings.port == 9001
    assert settings.download_dir == tmp_path
    assert settings.cors_origins == ["http://a.test"]
    assert settings.api_keys[0].get_secret_value() == "secret"
    assert "secret" not in repr(settings)


@pytest.mark.parametrize(
    ("field", "value"),
    [("max_body_bytes", 0), ("max_active_downloads", 0), ("max_active_downloads", 17)],
)
def test_out_of_range_values_are_rejected(field: str, value: int) -> None:
    with pytest.raises(ValidationError):
        Settings(**{field: value})  # type: ignore[arg-type]


def test_check_auth_requires_key_in_api_key_mode() -> None:
    with pytest.raises(ValueError, match="RAYOHX_API_API_KEYS"):
        Settings(auth_mode=AuthMode.API_KEY).check_auth()


def test_check_auth_passes_with_key_or_none_mode() -> None:
    keyed = Settings(auth_mode=AuthMode.API_KEY, api_keys=["k"])  # type: ignore[list-item]
    assert keyed.check_auth() is keyed
    open_ = Settings(auth_mode=AuthMode.NONE)
    assert open_.check_auth() is open_


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()
