import pytest
from pydantic import BaseModel

from rayohx_api import schemas
from rayohx_api.schemas import v1 as v1_schemas


@pytest.mark.parametrize("package", [schemas, v1_schemas])
def test_exports_resolve(package: object) -> None:
    for name in package.__all__:  # type: ignore[attr-defined]
        assert hasattr(package, name)


def test_every_model_builds_a_json_schema() -> None:
    models = [
        m
        for package in (schemas, v1_schemas)
        for m in (getattr(package, n) for n in package.__all__)
        if isinstance(m, type) and issubclass(m, BaseModel)
    ]
    assert len(models) >= 13
    for model in models:
        assert model.model_json_schema()["type"] == "object"
