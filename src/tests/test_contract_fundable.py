from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from unittest.mock import patch, MagicMock
import typing
from src.contract import Fundable

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)

application_address = "OKSDOCOXVGMBXQ5TP5YA4VWTZWZJLJP3OMIILPHMHGHURUFE2Q3JP62QNU"


class MockAbiCall:
    def __call__(
        self, *args: typing.Any, **_kwargs: typing.Any
    ) -> tuple[typing.Any, typing.Any]:
        return (MagicMock(),)

    def __getitem__(self, _item: object) -> typing.Self:
        return self


@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Fundable:
    return Fundable()


def test_fundable(contract: Fundable, context: AlgopyTestContext):
    """
    Test the Fundable contract
    """
    assert contract is not None
    assert contract.funder == zero_address
    assert contract.funding == 0
    assert contract.total == 0


def test_fundable_fill(contract: Fundable, context: AlgopyTestContext):
    """
    Test the fill function
    Must be called by funder
    """
    contract.funder = context.default_sender
    assert contract.total == 0
    app = context.ledger.get_app(contract)
    extra_payment = context.any.txn.payment(
        amount=99999,
        sender=context.default_sender,
        receiver=app.address,
    )
    deferred_call = context.txn.defer_app_call(
        contract.fill,
    )
    with patch("algopy.arc4.abi_call", MockAbiCall()):
        with context.txn.create_group([extra_payment, deferred_call]):
            deferred_call.submit()
    assert contract.total == 99999


def test_fundable_grant_funder(contract: Fundable, context: AlgopyTestContext):
    new_funder = context.any.arc4.address()
    with pytest.raises(AssertionError):
        contract.grant_funder(new_funder)
    contract.funder = context.default_sender
    contract.grant_funder(new_funder)
    assert contract.funder == new_funder.native


def test_fundable_set_funding(contract: Fundable, context: AlgopyTestContext):
    assert contract.funding != algopy.UInt64(1)
    with pytest.raises(AssertionError):
        contract.set_funding(algopy.arc4.UInt64(1))
    contract.funder = context.default_sender
    contract.set_funding(algopy.arc4.UInt64(1))
    assert contract.funding == 1


def test_fundable_abort_funding(contract: Fundable, context: AlgopyTestContext):
    with pytest.raises(AssertionError):
        contract.abort_funding()
    contract.funder = context.default_sender
    contract.abort_funding()


def test_fundable_reduce_total(contract: Fundable, context: AlgopyTestContext):
    adjustment = algopy.arc4.UInt64(10)
    with pytest.raises(AssertionError):
        contract.reduce_total(adjustment)
    contract.funder = context.default_sender
    contract.total = algopy.UInt64(100)
    contract.reduce_total(adjustment)
    assert contract.total == 100 - 10
    with pytest.raises(AssertionError):
        contract.reduce_total(algopy.arc4.UInt64(100))
