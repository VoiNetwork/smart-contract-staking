from collections.abc import Generator
import pytest
from algopy_testing import AlgopyTestContext, algopy_testing_context
import algopy
from contract import Stakeable, Bytes32, Bytes64

zero_address = algopy.arc4.Address(
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
)

@pytest.fixture()
def context() -> Generator[AlgopyTestContext, None, None]:
    with algopy_testing_context() as ctx:
        yield ctx


@pytest.fixture()
def contract(context: AlgopyTestContext) -> Stakeable:  # noqa: ARG001
    return Stakeable()


def test_stakeable(contract: Stakeable, context: AlgopyTestContext):
    """
    Test the Stakeable contract
    """
    assert contract is not None
    assert contract.owner == zero_address
    assert contract.delegate == zero_address
    assert contract.stakeable == 1


def test_stakeable_set_delegate(contract: Stakeable, context: AlgopyTestContext):
    """
    Test the set_delegate function
    Must be called by the owner and update delegate value
    """
    contract.owner = context.default_sender
    assert contract.owner == context.default_sender
    new_delegate = context.any.arc4.address()
    contract.set_delegate(new_delegate)
    assert contract.delegate == new_delegate


def participate_helper(contract: Stakeable, context: AlgopyTestContext):
    """
    Helper function for the participate function
    """
    app = context.ledger.get_app(contract)
    extra_payment = context.any.txn.payment(
        amount=algopy.Global.min_txn_fee,
        sender=context.default_sender,
        receiver=app.address,
    )
    deferred_call = context.txn.defer_app_call(
        contract.participate,
        Bytes32(),  # vote_k
        Bytes32(),  # sel_k
        context.any.arc4.uint64(),  # vote_fst
        context.any.arc4.uint64(),  # vote_lst
        context.any.arc4.uint64(),  # vote_kd
        Bytes64(),  # sp_key
    )
    with context.txn.create_group([extra_payment, deferred_call]):
        deferred_call.submit()
    # TODO test participation


def test_stakeable_participate(contract: Stakeable, context: AlgopyTestContext):
    """
    Test the participate functiot
    Must be called by the owner or delegate
    """
    contract.owner = context.default_sender
    assert contract.owner == context.default_sender

    participate_helper(contract, context)

    contract.owner = zero_address
    contract.delegate = context.default_sender
    assert contract.delegate == context.default_sender

    participate_helper(contract, context)
