import pytest
from fastapi import HTTPException

from rayohx_api.auth import Principal, authenticate, embedded_principal
from rayohx_api.config import AuthMode, Settings


def _settings(mode: AuthMode, *keys: str) -> Settings:
    return Settings(auth_mode=mode, api_keys=list(keys))  # type: ignore[arg-type]


def test_none_mode_allows_anonymous_without_key() -> None:
    principal = authenticate(_settings(AuthMode.NONE), None)
    assert principal == Principal(subject="anonymous", method=AuthMode.NONE)


def test_valid_key_is_accepted() -> None:
    principal = authenticate(_settings(AuthMode.API_KEY, "one", "two"), "two")
    assert principal == Principal(subject="api-key", method=AuthMode.API_KEY)


@pytest.mark.parametrize("key", [None, "", "wrong", "on"])
def test_missing_or_wrong_key_is_rejected(key: str | None) -> None:
    with pytest.raises(HTTPException) as caught:
        authenticate(_settings(AuthMode.API_KEY, "one"), key)
    assert caught.value.status_code == 401
    assert caught.value.headers == {"WWW-Authenticate": "ApiKey"}


def test_no_configured_keys_rejects_everything() -> None:
    with pytest.raises(HTTPException):
        authenticate(_settings(AuthMode.API_KEY), "anything")


def test_embedded_principal_is_cornea_session() -> None:
    assert embedded_principal() == Principal(subject="cornea-session", method="cornea")
