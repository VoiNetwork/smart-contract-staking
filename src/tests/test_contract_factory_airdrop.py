from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
from unittest.mock import patch, MagicMock
import typing
from src.contract import AirdropFactory


class MockApp:
    def __init__(self, context: AlgopyTestContext):
        self.created_app = context.any.application()


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
def contract(context: AlgopyTestContext) -> AirdropFactory:  # noqa: ARG001
    return AirdropFactory()


def test_factory_airdrop(contract: AirdropFactory):
    assert contract is not None


def test_factory_airdrop_create(contract: AirdropFactory, context: AlgopyTestContext):
    app = context.ledger.get_app(contract)
    extra_payment = context.any.txn.payment(
        amount=777500,
        sender=context.default_sender,
        receiver=app.address,
    )
    deferred_call = context.txn.defer_app_call(
        contract.create,
        context.any.account(),  # owner
        context.any.account(),  # funder
        context.any.uint64(),  # deadline
        context.any.uint64(),  # initial
    )

    # deploys the contract
    with patch("algopy.arc4.arc4_create", return_value=MockApp(context)):
        # uses created_app in inner transactions
        with patch("algopy.arc4.abi_call", MockAbiCall()):
            with context.txn.create_group([extra_payment, deferred_call]):
                deferred_call.submit()

    # TODO test created app state
    #       airdrop created by factor should have modified state
