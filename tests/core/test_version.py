import rayohx_package


def test_version_is_defined() -> None:
    assert isinstance(rayohx_package.__version__, str)
