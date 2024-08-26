from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from contract import Upgradeable

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)


@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Upgradeable:  # noqa: ARG001
    return Upgradeable()


def test_upgradable(contract: Upgradeable, context: AlgopyTestContext):
    """
    Test the Upgradable contract
    """
    assert contract is not None
    assert contract.owner == zero_address
    assert contract.contract_version == 0
    assert contract.deployment_version == 0
    assert contract.updatable == 1


def test_upgradable_set_version(contract: Upgradeable, context: AlgopyTestContext):
    """
    Test the set_version function
    Must be called by creator
    """
    # TODO test abi_call by creator 
    contract.set_version(algopy.arc4.UInt64(1), algopy.arc4.UInt64(1))
    assert contract.contract_version == 1
    assert contract.deployment_version == 1


# TODO mock update
