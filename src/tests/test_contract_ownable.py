from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from src.contract import Ownable

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)


@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Ownable:  # noqa: ARG001
    return Ownable()


def test_ownable(contract: Ownable, context: AlgopyTestContext):
    """
    Test the Ownable contract
    """
    assert contract is not None
    assert contract.owner == zero_address


# TODO emits ownership transfer event
def test_ownable_transfer(contract: Ownable, context: AlgopyTestContext):
    """
    Test the transfer function
    Must be called by owner
    """
    contract.owner = context.default_sender
    assert contract.owner == context.default_sender
    new_owner = context.any.arc4.address()
    contract.transfer(new_owner)
    assert contract.owner == new_owner
