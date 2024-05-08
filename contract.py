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
        # JM: Since this is global.creator, you don't need to store it at all
        self.funder = Account()     # zero address
        self.period = UInt64()      # 0
        self.funding = UInt64()     # 0
        self.total = UInt64()       # 0
    ##############################################
    # function: constructor
    # arguments:
    # - owner, who is the beneficiary
    # - funder, who is this
    # - total, total amount without lockup
    # purpose: create contract
    # pre-conditions: None
    # post-conditions: set owner and funder
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address) -> None:
        # JM: I don't think this function is useful and you should just put the enforce_step constraints in each function itself
        self.enforce_step(UInt64(0)) # Non-existant
        self.require_creator()
        self.funder = Txn.sender
        self.owner = owner.native
    ##############################################
    # function: configure
    # arguments:
    # - period, lockup period
    # purpose: set lockup period
    # pre-conditions
    # - funder and owner initialized
    # - period 0
    # post-conditions: set owner and funder
    ##############################################
    @arc4.abimethod
    def configure(self, period: arc4.UInt64) -> None:
        self.enforce_step(UInt64(1)) # Fresh
        self.require_owner()
        assert period > 0, "period must be greater than 0" 
        # JM: The Voi Foundation needs to verify that they are happy with this.
        assert period <= 5, "period must be less than or equal to 5"
        self.period = period.native
    ##############################################
    # function: fill
    # arguments:
    # - total, how much to fill
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
    def fill(self, total: arc4.UInt64, funding: arc4.UInt64) -> None:
        self.enforce_step(UInt64(2)) # Ready
        self.require_funder()
        # JM: It is actually not necessary to have `total` as an argument that you check like this. Instead, you can inspect what the payment actually is and then that's what "total" is
        self.require_payment(self.funder, total.native)
        assert total > 0, "payment is greater than zero"
        self.total = total.native
        self.funding = funding.native
    ##############################################
    # function: participate
    # arguments:
    # - key registration params
    # purpose: allow contract to particpate in 
    #          consensus
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
        self.enforce_step(UInt64(3)) # Full
        self.require_owner()
        self.require_payment(self.owner, UInt64(1000))
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
    # returns:
    # - mab
    # purpose: extract funds from contract
    # pre-conditions
    # - only callable by owner
    # - let balance be the current balance of the
    #   contract
    # - let fee be one fee value
    # - balance - amount - fee >= mag
    # post-conditions: 
    # - transfer amount from the contract account
    #   to owner
    # notes:
    # - 2 fees
    ##############################################
    @arc4.abimethod
    def withdraw(self, amount: arc4.UInt64) -> UInt64:
        self.enforce_step(UInt64(3)) # Full
        self.require_owner()
        mab = self.calculate_mab()
        available_balance = self.get_available_balance()
        # JM: You need to add the fee amount to the negative side OR set the fee of the itxn to 0 and enforce that the fee on the appl txn is 2
        assert available_balance - amount.native >= mab, "mab available"
        if amount > 0:
            itxn.Payment(
                amount=amount.native,
                receiver=Txn.sender,
            ).submit()
        return mab
    ##############################################
    # function: transfer
    # arguments:
    # - owner, new owner
    # purpose: change owner
    # pre-conditions
    # - only callable by the owner
    # post-conditions: 
    # - new owner
    # notes:
    # - fee taken out of amount transfered to 
    #   owner
    ##############################################
    @arc4.abimethod
    # JM: I prefer to use the name `newOwner` to make sure we're not making a mistake
    def transfer(self, owner: arc4.Address) -> None:
        self.enforce_step(UInt64(3)) # Full
        self.require_owner()
        # JM: Why bother?
        assert self.owner != owner.native, "new owner must not be owner"
        self.owner = owner.native
    ##############################################
    # function: close
    # arguments: None
    # purpose: deletes contract
    # pre-conditions:
    # - mab is 0
    # post-conditions:
    # - contract is deleted
    # - account closed out to owner if it has a balance
    # - 2 fees
    # notes:
    # - should be alled with onCompletion
    #   deleteApplication
    ##############################################
    @arc4.abimethod(allow_actions=[
        OnCompleteAction.DeleteApplication
    ])
    def close(self) -> None:
        self.enforce_step(UInt64(3)) # Full
        # JM: The spec does not require this to be called by the owner, because it is in the Foundation's interest to close it and get the resources back and there are no choices about how much or who to close to
        self.require_owner()
        assert self.calculate_mab() == 0, "mab is zero"
        oca = Txn.on_completion
        # JM: We should not "allow" it to be delete; we should REQUIRE it to be "delete"
        if oca == OnCompleteAction.DeleteApplication:
            available_balance = self.get_available_balance()
            if available_balance > 0:
                # JM: Do we need to handle the case where the balance is less than a fee, so we can't pay for a close out? I don't think so, because the foundation (which is the one that wants the app resources back) can send a fee and then make this happen
                itxn.Payment(
                    # JM: The receiver should be the owner, not the creator/funder
                    receiver=Global.creator_address,
                    close_remainder_to=self.owner
                ).submit()
    ##############################################
    # function: get_available_balance (internal)
    # arguments: None
    # purpose: get available balance
    # pre-conditions: None
    # post-conditions: None
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
    def require_payment(self, who: Account, amount: UInt64) -> None:
        # JM: These 0s should be "my txn id - 1" to make the txn composable
        assert gtxn.PaymentTransaction(0).sender == who, "payment sender accurate"
        assert gtxn.PaymentTransaction(0).amount == amount, "payment amount accurate"
        assert gtxn.PaymentTransaction(0).receiver == Global.current_application_address, "payment receiver accurate"
    ##############################################
    # function: require_creator (internal)
    # arguments: None
    # purpose: check that sender is creator
    # pre-conditions: None
    # post-conditions: None
    ##############################################
    @subroutine
    def require_creator(self) -> None: 
        assert Txn.sender == Global.creator_address, "must be creator" 
    ##############################################
    # function: require_funder (internal)
    # arguments: None
    # purpose: check that sender is funder
    # pre-conditions: None
    # post-conditions: None
    ##############################################
    @subroutine
    def require_funder(self) -> None: 
        assert Txn.sender == self.funder, "must be funder" 
    ##############################################
    # function: require_owner (internal)
    # arguments: None
    # purpose: check that sender is owner
    # pre-conditions: None
    # post-conditions: None
    ##############################################
    @subroutine
    def require_owner(self) -> None: 
        assert Txn.sender == self.owner, "must be owner" 
    ##############################################
    # function: enforce_step (internal)
    # arguments:
    # - step, what step to enforce
    # purpose:
    # - enforce that method may be allowed in step
    # pre-conditions: None
    # post-conditions: None
    ##############################################
    @subroutine
    def enforce_step(self, n: UInt64) -> None:
        match n:
            case UInt64(0): # Non-existent
                assert self.funder == Global.zero_address, "funder must not be initialized"
                assert self.owner == Global.zero_address, "owner must not be initialized"
                assert self.period == 0, "period must not be initialize"
                assert self.funding == 0, "funding must not be initialize"
                assert self.total == 0, "total must not be initialized"
            case UInt64(1): # Fresh
                assert self.funder == Global.creator_address, "funder must be initialize" 
                assert self.owner != Global.zero_address, "owner must be initialized"
                assert self.period == 0, "period must not be initialized"
                assert self.funding == 0, "funding must not be initialized"
                assert self.total == 0, "total must not be initialized"
            case UInt64(2): # Ready
                assert self.funder == Global.creator_address, "funder must be initialize"
                assert self.owner != Global.zero_address, "owner must be initialized"
                # JM: This "5" should be a global variable in the Python to reduce redundant redundancy
                assert self.period <= 5, "period within bounds" 
                assert self.funding == 0, "funding must not be initialized"
                assert self.total == 0, "total must not be initialized"
            case UInt64(3): # Full
                assert self.funder == Global.creator_address, "funder must be initialize"
                assert self.owner != Global.zero_address, "owner must be initialized"
                assert self.period <= 5, "period within bounds"
                assert self.funding > 0, "funding must be initialized"
                assert self.total > 0, "total must be initialized"
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
        # JM: You should make a normal Python script to run this function (with `now` as a parameter) with a bunch of different values to produce a CSV to produce a graph so the Foundation can look at it and ensure that it matches their expectations
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

