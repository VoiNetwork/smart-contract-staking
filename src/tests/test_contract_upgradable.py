from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from src.contract import Upgradeable

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


def test_upgradable_approve_update(contract: Upgradeable, context: AlgopyTestContext):
    """
    Test the approve_update function
    Must be called by owner
    """
    with pytest.raises(Exception):
        contract.approve_update(algopy.arc4.Bool(0))
    contract.owner = context.default_sender
    assert contract.updatable == bool(1)
    contract.approve_update(algopy.arc4.Bool(0))
    assert contract.updatable == bool(0)


def test_upgradable_grant_updater(contract: Upgradeable, context: AlgopyTestContext):
    """
    Test the grant_updater function
    Must be called by creator
    """
    # default_sender is creator
    new_upgrader = context.any.arc4.address()
    contract.grant_upgrader(new_upgrader)
    assert contract.upgrader == new_upgrader
    # in order for a factory deployed contract to be able to call this function
    # it must be called by an authorized account through the factory


# TODO mock update
def test_upgradable_update(contract: Upgradeable, context: AlgopyTestContext):
    """
    Test the update function
    Must be called by updater
    """
    pass
    # call contract bare method updating contract with known methods
    #   call that method
    # must be updater
