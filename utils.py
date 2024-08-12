from algopy import (
    Account,
    Global,
    Txn,
    UInt64,
    gtxn,
    op,
    subroutine
)

##############################################
# function: require_payment (internal)
# arguments: None
# purpose: check payment
# pre-conditions: None
# post-conditions: None
##############################################
@subroutine
def require_payment(who: Account) -> UInt64:
    ref_group_index = Txn.group_index
    assert ref_group_index > 0, "group index greater than zero"
    payment_group_index = ref_group_index - 1
    assert gtxn.PaymentTransaction(payment_group_index).sender == who, "payment sender accurate"
    assert gtxn.PaymentTransaction(payment_group_index).receiver == Global.current_application_address, "payment receiver accurate"
    return gtxn.PaymentTransaction(payment_group_index).amount

##############################################
# function: get_available_balance (internal)
# purpose: get available balance
# returns: app balance available for spending
##############################################
@subroutine
def get_available_balance() -> UInt64:
    balance = op.balance(Global.current_application_address)
    min_balance = op.Global.min_balance
    available_balance = balance - min_balance
    return available_balance
