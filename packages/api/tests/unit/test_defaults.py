from rayohx_api.defaults import merge, without_secrets


def test_merge_lays_the_top_over_the_base_section_by_section() -> None:
    saved = {"selection": {"quality": "720p", "video_only": True}, "engine": {"resume": False}}
    assert merge(saved, {"selection": {"quality": "best"}}) == {
        "selection": {"quality": "best", "video_only": True},
        "engine": {"resume": False},
    }


def test_merge_does_not_change_its_inputs() -> None:
    base = {"selection": {"quality": "720p"}}
    merge(base, {"selection": {"quality": "best"}})
    assert base == {"selection": {"quality": "720p"}}


def test_merge_replaces_a_plain_value() -> None:
    assert merge({"filename": "a"}, {"filename": "b"}) == {"filename": "b"}


def test_without_secrets_drops_logins_and_passwords_at_any_depth() -> None:
    data = {
        "network": {"proxy": {"url": "u", "username": "me", "password": "x"}},
        "client_key_password": "y",
        "keep": 1,
    }
    assert without_secrets(data) == {"network": {"proxy": {"url": "u"}}, "keep": 1}
