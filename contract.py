from algopy import (
    ARC4Contract, 
    Account,
    Bytes,
    Global,
    OnCompleteAction,
    TemplateVar,
    Txn,
    UInt64,
    arc4,
    itxn,
    op,
    subroutine,
)
from contract_mab import calculate_mab_pure
from utils import (
    require_payment,
    get_available_balance
)

class Upgradeable(ARC4Contract):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        # hot state
        self.owner = Account()             # zero address
        self.contract_version = UInt64()   # 0
        self.deployment_version = UInt64() # 0
        # TODO update after debate
        self.updatable = bool(1)           # 1 (Default unlocked)
    ##############################################
    @arc4.abimethod
    def approve_update(self, approval: arc4.Bool) -> None:
        assert Txn.sender == self.owner, "must be owner"
        self.updatable = approval.native
    ##############################################
    @arc4.abimethod
    def set_version(self, contract_version: arc4.UInt64, deployment_version: arc4.UInt64) -> None:
        assert Txn.sender == Global.creator_address, "must be creator"
        self.contract_version = contract_version.native
        self.deployment_version = deployment_version.native
    ##############################################
    @arc4.baremethod(allow_actions=["UpdateApplication"])
    def on_update(self) -> None:
        ##########################################
        # WARNING: This app can be updated by the creator
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        assert self.updatable == UInt64(1), "not approved"
        ##########################################

class SmartContractStaking(Upgradeable):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        super().__init__()
        # hot state
        self.owner = Account()          # zero address
        self.funder = Account()         # zero address
        self.period = UInt64()          # 0
        self.funding = UInt64()         # 0
        self.total = UInt64()           # 0
        # cold state
        self.period_seconds = TemplateVar[UInt64]("PERIOD_SECONDS") # ex) 2592000
        self.lockup_delay = TemplateVar[UInt64]("LOCKUP_DELAY") # ex) 12
        self.vesting_delay = TemplateVar[UInt64]("VESTING_DELAY") # ex) 12
        self.period_limit = TemplateVar[UInt64]("PERIOD_LIMIT") # ex) 5
    ##############################################
    # function: setup
    # arguments:
    # - owner, who is the beneficiary
    # purpose: set owner once
    # post-conditions: owner set
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address, funder: arc4.Address) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        assert self.funder == Global.zero_address, "funder not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        self.owner = owner.native
        self.funder = funder.native
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
        assert self.funder != Global.zero_address, "funder initialized"
        assert self.funding == 0, "funding not initialized"
        ##########################################
        assert Txn.sender == self.funder, "must be funder" 
        ##########################################
        payment_amount = require_payment(self.funder)
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
        key_reg_fee = Global.min_txn_fee
        assert require_payment(self.owner) == key_reg_fee, "payment amout accurate"
        ###########################################
        itxn.KeyRegistration(
            vote_key=vote_k,
            selection_key=sel_k,
            vote_first=vote_fst.native,
            vote_last=vote_lst.native,
            vote_key_dilution=vote_kd.native,
            state_proof_key=sp_key,
            fee=key_reg_fee
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
        available_balance = get_available_balance()
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
        if oca == OnCompleteAction.DeleteApplication:
            itxn.Payment(
                receiver=self.owner,
                close_remainder_to=self.owner
            ).submit()
        else:
            op.err() 
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
        now: UInt64 = Global.latest_timestamp
        vesting_delay: UInt64 = TemplateVar[UInt64]("VESTING_DELAY") # vesting delay
        period_seconds: UInt64 = TemplateVar[UInt64]("PERIOD_SECONDS") 
        lockup_delay: UInt64 = TemplateVar[UInt64]("LOCKUP_DELAY") * self.period # lockup period
        mab: UInt64 = calculate_mab_pure(
            now,
            vesting_delay,
            period_seconds,
            lockup_delay,
            self.period,
            self.funding,
            self.total,
        )
        return mab