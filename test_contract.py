from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
from algopy import arc4, UInt64

from contract import (
    Airdrop,
    AirdropFactory,
)


@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> AirdropFactory:  # noqa: ARG001
    return AirdropFactory()


def test_factory(contract: AirdropFactory):
    assert contract is not None
