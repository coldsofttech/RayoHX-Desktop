"""Helpers for the default options a client saves so it does not have to repeat them."""

from __future__ import annotations

from typing import Any

#: Proxy logins and key passwords are never saved. The user name goes too, because a
#: proxy with a user name and no password is not valid.
SECRET_KEYS = frozenset({"username", "password", "client_key_password"})


def without_secrets(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: without_secrets(v) for k, v in value.items() if k not in SECRET_KEYS}
    return value


def merge(base: dict[str, Any], top: dict[str, Any]) -> dict[str, Any]:
    """``top`` laid over ``base``, section by section."""
    result = dict(base)
    for key, value in top.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = value
    return result
