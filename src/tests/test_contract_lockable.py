from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from src.contract import Lockable

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)

application_address = "OKSDOCOXVGMBXQ5TP5YA4VWTZWZJLJP3OMIILPHMHGHURUFE2Q3JP62QNU"


@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Lockable:  # noqa: ARG001
    contract = Lockable()
    contract.period_seconds = algopy.UInt64(60)
    contract.lockup_delay = algopy.UInt64(12)
    contract.vesting_delay = algopy.UInt64(12)
    contract.period_limit = algopy.UInt64(5)
    contract.distribution_count = algopy.UInt64(12)
    contract.distribution_seconds = algopy.UInt64(60)
    yield contract


def test_lockable(contract: Lockable, context: AlgopyTestContext):
    """
    Test the Lockable contract
    """
    assert contract is not None


def test_lockable_setup(contract: Lockable, context: AlgopyTestContext):
    """
    Test the setup function
    Must be called by creator
    """
    new_deployer = context.any.arc4.address()
    new_owner = context.any.arc4.address()
    new_funder = context.any.arc4.address()
    new_initial = context.any.arc4.uint64()

    contract.owner = context.any.account()
    with pytest.raises(AssertionError):
        contract.setup(new_deployer, new_owner, new_funder, new_initial)
    contract.owner = zero_address
    contract.funder = context.any.account()
    with pytest.raises(AssertionError):
        contract.setup(new_deployer, new_owner, new_funder, new_initial)
    contract.funder = zero_address

    contract.setup(new_deployer, new_owner, new_funder, new_initial)
    assert contract.deployer == new_deployer
    assert contract.owner == new_owner
    assert contract.funder == new_funder
    assert contract.initial == new_initial


def test_lockable_configure(contract: Lockable, context: AlgopyTestContext):
    """
    Test the configure function
    Must be called by owner
    """
    new_period = context.any.arc4.uint64(min_value=0, max_value=5)

    with pytest.raises(AssertionError):
        contract.configure(new_period)

    contract.owner = context.default_sender
    # ensure future deadline
    contract.deadline = context.any.uint64(18446744073709551615)

    assert contract.owner == context.default_sender

    contract.configure(new_period)
    assert contract.period == new_period


def test_lockable_withdraw(contract: Lockable, context: AlgopyTestContext):
    """
    Test the withdraw function
    Must be called by owner
    """
    account = algopy.Account(application_address)
    # Factory creation ensures min_balance is satisfied
    context.ledger.update_account(
        application_address, balance=algopy.Global.min_balance
    )
    contract.owner = context.default_sender
    assert contract.owner == context.default_sender
    # case 1: funding <= 0, total = 0, balance = 1mb, amount = 0
    assert contract.funding == 0
    return_value = contract.withdraw(algopy.arc4.UInt64(0))
    assert return_value == 0
    # case 2: funding <= 0, total = 1mb, balance = 2mb, amount = 0
    context.ledger.update_account(
        application_address, balance=algopy.Global.min_balance * 2
    )
    contract.total = algopy.Global.min_balance
    return_value = contract.withdraw(algopy.arc4.UInt64(0))
    assert return_value == algopy.Global.min_balance
    # case 3: funding <= 0, total = 1mb, balacne = 3mb, amount > 0
    context.ledger.update_account(
        application_address, balance=algopy.Global.min_balance * 3
    )
    assert account.balance == algopy.Global.min_balance * 3
    return_value = contract.withdraw(algopy.arc4.UInt64(algopy.Global.min_balance))
    payment_txn = context.txn.last_group.last_itxn.payment
    assert return_value == algopy.Global.min_balance
    assert payment_txn.amount == algopy.Global.min_balance
    # case 4: funding > 0, total = balance - 1mb, amount = 0
    context.ledger.set_block(index=1, seed=1, timestamp=1)
    contract.funding = 1
    contract.total = algopy.Global.min_balance * 9
    context.ledger.update_account(
        application_address, balance=algopy.Global.min_balance * 10
    )
    return_value = contract.withdraw(algopy.arc4.UInt64(0))
    assert return_value == algopy.Global.min_balance * 9
    # TODO test with different blocks
    # TODO add coverage
    # if self.funding > 0:
    # min_balance = self.calculate_min_balance()
    # arc4.emit(Withdrawn(arc4.UInt64(min_balance), amount))
    # available_balance = get_available_balance()
    # assert available_balance - amount.native >= min_balance, "balance available"
    # if amount > 0:
    #     itxn.Payment(amount=amount.native, receiver=Txn.sender, fee=0).submit()
    # return min_balance


def test_lockable_close(contract: Lockable, context: AlgopyTestContext):
    ## must be called by owner
    contract.distribution_seconds = 60
    contract.distribution_count = 18
    contract.owner = context.default_sender
    contract.funding = algopy.UInt64(1)
    contract.total = algopy.UInt64(99990)
    contract.vesting_delay = algopy.UInt64(1)
    contract.distribution_count = algopy.UInt64(1)
    context.ledger.update_account(
        application_address, balance=99999 + algopy.Global.min_balance
    )
    account = algopy.Account(application_address)
    account_balance = 99999 + algopy.Global.min_balance
    assert account.balance == account_balance
    assert contract.owner.balance == 0
    # with context.txn.create_group(
    #     active_txn_overrides={
    #         "on_completion": algopy.OnCompleteAction.DeleteApplication
    #     },
    # ):
    contract.close()
    # TODO test nonparticipation itx
    payment_txn = context.txn.last_group.last_itxn.payment
    # TODO receiver is creator address
    # TODO amount is global min balance
    assert payment_txn.close_remainder_to == contract.owner
    # TODO close remaineder amount is balance before minus global min balance
    # TODO test outcome of close_remainder_to contract owner


def test_lockable_calculate_min_balance(contract: Lockable, context: AlgopyTestContext):
    """
    Test the calculate_min_balance function
    """
    pass
