from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
from contract import Deployable

@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Deployable:  # noqa: ARG001
    return Deployable()


def test_deployable(contract: Deployable):
    """
    Test the Deployable contract
    """
    assert contract is not None
    assert contract.parent_id == 0
    # TODO mock arc4_create, must be created by factory
    #      implementation requires caller application id
    #      greater than 0


