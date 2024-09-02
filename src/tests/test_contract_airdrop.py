from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
from unittest.mock import MagicMock
import typing
import algopy
from src.contract import Airdrop

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)


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
def contract(context: AlgopyTestContext) -> Airdrop:
    return Airdrop()


def test_airdrop(contract: Airdrop):
    assert contract is not None
    assert contract.period_seconds == 0
    assert contract.lockup_delay == 0
    assert contract.vesting_delay == 0
    assert contract.period_limit == 0
    assert contract.messenger_id == 0
    assert contract.contract_version == 0
    assert contract.deployment_version == 0
    assert contract.period == 0
    assert contract.total == 0
    assert contract.funding == 0
    assert contract.deadline == 0
    assert contract.funder == zero_address
    assert contract.owner == zero_address
    assert contract.delegate == zero_address
    assert contract.initial == 0
    assert contract.parent_id == 0
    assert contract.stakeable == 1
    assert contract.updatable == 1


def test_airdrop_template(contract: Airdrop, context: AlgopyTestContext):
    contract.period_seconds = algopy.UInt64(0)
    contract.lockup_delay = algopy.UInt64(0)
    contract.vesting_delay = algopy.UInt64(0)
    contract.period_limit = algopy.UInt64(0)
    contract.distribution_count = algopy.UInt64(0)
    contract.distribution_seconds = algopy.UInt64(0)
    contract.messenger_id = algopy.UInt64(0)
    period_limit = context.any.arc4.uint64()
    vesting_delay = context.any.arc4.uint64()
    lockup_delay = context.any.arc4.uint64()
    period_seconds = context.any.arc4.uint64()
    messenger_id = context.any.arc4.uint64()
    distribution_count = algopy.arc4.UInt64(0)
    distribution_seconds = algopy.arc4.UInt64(0)
    period = algopy.arc4.UInt64(0)
    deadline = algopy.arc4.UInt64(0)
    total = algopy.arc4.UInt64(0)
    funding = algopy.arc4.UInt64(0)
    delegate = algopy.arc4.Address(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
    )
    distribution_count = context.any.arc4.uint64()
    distribution_seconds = context.any.arc4.uint64()
    contract.template(
        period_limit,
        vesting_delay,
        lockup_delay,
        period_seconds,
        messenger_id,
        distribution_count,
        distribution_seconds,
        period,
        deadline,
        total,
        funding,
        delegate,
    )
    assert contract.period_seconds == period_seconds
    assert contract.lockup_delay == lockup_delay
    assert contract.vesting_delay == vesting_delay
    assert contract.period_limit == period_limit
    assert contract.distribution_count == distribution_count
    assert contract.distribution_seconds == distribution_seconds
    assert contract.messenger_id == messenger_id
    assert contract.period == period
    assert contract.deadline == deadline
    assert contract.total == total
    assert contract.funding == funding
    assert contract.delegate == delegate


# TODO write test
# when called offline key reg and close out to creator address
def test_fundable_abort_funding(contract: Airdrop, context: AlgopyTestContext):
    contract.funding = algopy.UInt64(0)
    with pytest.raises(Exception):
        contract.abort_funding()
    contract.funding = algopy.UInt64(1)
    with pytest.raises(Exception):
        contract.abort_funding()
    contract.funding = algopy.UInt64(0)
    contract.funder = context.default_sender
    contract.abort_funding()
