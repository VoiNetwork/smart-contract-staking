from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from src.contract import Messenger

@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Messenger:  # noqa: ARG001
    contract = Messenger()
    yield contract


def test_messenger(contract: Messenger, context: AlgopyTestContext):
    """
    Test the Lockable contract
    """
    assert contract is not None


def test_lockable_partkey_broastcast(contract: Messenger, context: AlgopyTestContext):
    """
    Test the partkey_broastcast function
    Must be called by anyone
    """
    pass
    # emits event

