from algopy import (
    ARC4Contract, 
    Account,
    Bytes,
    Global,
    GlobalState,
    OnCompleteAction,
    TemplateVar,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    op,
    subroutine,
)

class SmartContractStaking(ARC4Contract):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        self.owner = Account()      # zero address
        self.period = UInt64()      # 0
        self.funding = UInt64()     # 0
        self.total = UInt64()       # 0
    ##############################################
    # function: setup
    # arguments:
    # - owner, who is the beneficiary
    # purpose: set owner once
    # post-conditions: owner set
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        self.owner = owner.native
    ##############################################
    # function: configure
    # arguments:
    # - period, lockup period
    # purpose: set lockup period before funded
    # pre-conditions
    # - owner initialized
    # post-conditions: period set
    ##############################################
    @arc4.abimethod
    def configure(self, period: arc4.UInt64) -> None:
        ##########################################
        assert self.funding == 0, "funding not initialized"
        assert self.total == 0, "total not initialized" 
        ##########################################
        assert Txn.sender == self.owner, "must be owner"
        ##########################################
        assert period <= TemplateVar[UInt64]("PERIOD_LIMIT") 
        ##########################################
        self.period = period.native
    ##############################################
    # function: fill
    # arguments:
    # - funding, when funded
    # purpose: fund it
    # pre-conditions
    # - period must be set
    # - funding and total must be uninitialized
    # - must be combined with pyament transaction
    #   for total amount
    # - must be only callable by funder 
    # post-conditions: 
    # - total and funding are set to arguments
    ##############################################
    @arc4.abimethod
    def fill(self, funding: arc4.UInt64) -> None:
        ##########################################
        assert self.owner != Global.zero_address, "owner initialized"
        assert self.funding == 0, "funding not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        payment_amount = self.require_payment(Global.creator_address)
        assert payment_amount > UInt64(0), "payment amount accurate"
        ##########################################
        assert funding > 0, "funding must  be greater than zero"
        ##########################################
        self.total = payment_amount
        self.funding = funding.native
    ##############################################
    # function: participate
    # arguments:
    # - key registration params
    # purpose: allow contract to particpate
    # pre-conditions
    # - must be callable by owner only
    # - must be combined with transaction transfering
    #   one fee into the contract account
    # post-conditions: 
    # - contract generates itnx for keyreg
    # notes:
    # - fee payment is to prevent potential draining
    #   into fees, even though it is not likely that
    #   a user may attempt to drain their funds
    # - MAB is not relevant due to the fee payment
    #   added
    ##############################################
    @arc4.abimethod
    def participate(self, vote_k: Bytes, sel_k: Bytes, vote_fst: arc4.UInt64, vote_lst: arc4.UInt64, vote_kd: arc4.UInt64, sp_key: Bytes) -> None: 
        ###########################################
        assert self.funding > 0, "funding initialized"
        ###########################################
        assert Txn.sender == self.owner, "must be owner" 
        ###########################################
        assert self.require_payment(self.owner) == UInt64(1000), "payment amout accurate"
        ###########################################
        itxn.KeyRegistration(
            vote_key=vote_k,
            selection_key=sel_k,
            vote_first=vote_fst.native,
            vote_last=vote_lst.native,
            vote_key_dilution=vote_kd.native,
            state_proof_key=sp_key,
            fee=1000
        ).submit()
    ##############################################
    # function: withdraw
    # arguments:
    # - amount
    # returns: mab
    # purpose: extract funds from contract
    # pre-conditions
    # - only callable by owner
    # - let balance be the current balance of the
    #   contract
    # - balance - amount >= mag
    #   (fee paid in appl txn)
    # post-conditions: 
    # - transfer amount from the contract account
    #   to owner
    # notes: costs 2 fees
    ##############################################
    @arc4.abimethod
    def withdraw(self, amount: arc4.UInt64) -> UInt64:
        ##########################################
        assert self.funding > 0, "funding initialized"
        ##########################################
        assert Txn.sender == self.owner, "must be owner" 
        ##########################################
        mab = self.calculate_mab()
        available_balance = self.get_available_balance()
        # JM: You need to add the fee amount to the negative side OR set the fee of the itxn to 0 and enforce that the fee on the appl txn is 2
        assert available_balance - amount.native >= mab, "mab available"
        if amount > 0:
            itxn.Payment(
                amount=amount.native,
                receiver=Txn.sender,
                fee=0
            ).submit()
        return mab
    ##############################################
    # function: transfer
    # arguments:
    # - new_owner, new owner
    # purpose: change owner
    # pre-conditions
    # - only callable by the owner
    # post-conditions: 
    # - new owner asigned
    ##############################################
    @arc4.abimethod
    def transfer(self, new_owner: arc4.Address) -> None:
        ###########################################
        assert self.funding > 0, "funding initialized"
        ##########################################
        assert Txn.sender == self.owner, "must be owner" 
        ###########################################
        self.owner = new_owner.native
    ##############################################
    # function: close
    # purpose: deletes contract
    # pre-conditions:
    # - mab is 0
    # post-conditions:
    # - contract is deleted
    # - account closed out to owner if it has a balance
    # notes:
    # - should be alled with onCompletion
    #   deleteApplication
    ##############################################
    @arc4.abimethod(allow_actions=[
        OnCompleteAction.DeleteApplication
    ])
    def close(self) -> None:
        ###########################################
        assert self.funding > 0, "funding initialized"
        ###########################################
        assert self.calculate_mab() == 0, "mab is zero"
        ###########################################
        oca = Txn.on_completion
        # JM: We should not "allow" it to be delete; we should REQUIRE it to be "delete"
        if oca == OnCompleteAction.DeleteApplication:
            itxn.Payment(
                receiver=self.owner,
                close_remainder_to=self.owner
            ).submit()
        else:
            op.err() 
    ##############################################
    # function: get_available_balance (internal)
    # purpose: get available balance
    # returns: app balance available for spending
    ##############################################
    @subroutine
    def get_available_balance(self) -> UInt64:
        balance = op.balance(Global.current_application_address)
        min_balance = op.Global.min_balance
        available_balance = balance - min_balance
        return available_balance
    ##############################################
    # function: require_payment (internal)
    # arguments: None
    # purpose: check payment
    # pre-conditions: None
    # post-conditions: None
    ##############################################
    @subroutine
    def require_payment(self, who: Account) -> UInt64:
        ref_group_index = Txn.group_index
        assert ref_group_index > 0, "group index greater than zero"
        payment_group_index = ref_group_index - 1
        assert gtxn.PaymentTransaction(payment_group_index).sender == who, "payment sender accurate"
        assert gtxn.PaymentTransaction(payment_group_index).receiver == Global.current_application_address, "payment receiver accurate"
        return gtxn.PaymentTransaction(payment_group_index).amount
    ##############################################
    # function: calculate_mab (internal)
    # arguments: None
    # purpose: calcualte minimum allowable balance
    # pre-conditions: None
    # post-conditions: None
    # notes:
    # - let period = number of months to to lockup
    #       total = total amount intially funded (airdrop + lockup bonus)
    #       y = vesting delay in months
    #       p = 1 / (self.period x 12) or 1 / (period)
    # - mimumum allowable balance =
    #     total x min(1, p x max(0, (period - (now() - funding + y x seconds-in-month)) / seconds-in-month))
    ##############################################
    @subroutine
    def calculate_mab(self) -> UInt64:
        # JM: You should make a normal Python script to run this function (with `now` as a parameter) 
        # with a bunch of different values to produce a CSV to produce a graph so the Foundation can 
        # look at it and ensure that it matches their expectations
        now = Global.latest_timestamp
        y = TemplateVar[UInt64]("VESTING_DELAY") # vesting delay
        seconds_in_period = TemplateVar[UInt64]("PERIOD_SECONDS") 
        p = TemplateVar[UInt64]("LOCKUP_DELAY") * self.period # lockup period
        locked_up = now < self.funding + p * seconds_in_period
        fully_vested = now >= self.funding + (y + p) * seconds_in_period
        lockup_seconds = p * seconds_in_period
        # if locked up then total
        # elif fully vested then zero
        # else calculate mab using elapsed periods
        if locked_up: #  if locked up then total
            return self.total 
        elif fully_vested: #  elif fully vested then zero
            return UInt64(0) 
        else: #  else calculate mab using elapsed periods
            m =  (now - (self.funding + lockup_seconds)) // seconds_in_period # elapsed period after lockup
            return (self.total * (y - m)) // y
