import typing
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
    subroutine
)
from contract_mab import calculate_mab_pure
from utils import (
    require_payment,
    get_available_balance
)

Bytes32: typing.TypeAlias = arc4.StaticArray[arc4.Byte, typing.Literal[32]]
Bytes64: typing.TypeAlias = arc4.StaticArray[arc4.Byte, typing.Literal[64]]

class PartKeyInfo(arc4.Struct):
    address: arc4.Address
    vote_key: Bytes32
    selection_key: Bytes32
    vote_first: arc4.UInt64
    vote_last: arc4.UInt64
    vote_key_dilution: arc4.UInt64
    state_proof_key: Bytes64

class MessagePartKeyInfo(arc4.Struct):
    who: arc4.Address
    partkey: PartKeyInfo

##################################################
# Ownable
#   allows contract to be owned
##################################################
class Ownable(ARC4Contract):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        self.owner = Account()             # zero address
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
        assert Txn.sender == self.owner, "must be owner"
        self.owner = new_owner.native

##################################################
# Stakeable
#   allows contract to participate in consensus,
#   stake
##################################################
class Stakeable(Ownable):
    def __init__(self) -> None:
        self.delegate = Account()          # zero address
        self.stakeable = bool(1)         # 1 (Default unlocked)
    #############################################
    # function: set_delegate
    # arguments:
    # - delegate, who is the delegate
    # purpose: set delegate
    # pre-conditions
    # - only callable by owner
    # post-conditions: delegate set
    ##############################################
    @arc4.abimethod
    def set_delegate(self, delegate: arc4.Address) -> None:
        assert Txn.sender == self.owner, "must be owner"
        self.delegate = delegate.native
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
    # - min balance is not relevant due to the fee
    #   payment added
    ##############################################
    @arc4.abimethod
    def participate(self, vote_k: Bytes32, sel_k: Bytes32, vote_fst: arc4.UInt64,
        vote_lst: arc4.UInt64, vote_kd: arc4.UInt64, sp_key: Bytes64) -> None: 
        ###########################################
        assert Txn.sender == self.owner or Txn.sender == self.delegate, "must be owner or delegate" 
        ###########################################
        key_reg_fee = Global.min_txn_fee
        # require payment of min fee to prevent draining
        assert require_payment(Txn.sender) == key_reg_fee, "payment amout accurate"
        ###########################################
        itxn.KeyRegistration(
            vote_key=vote_k.bytes,
            selection_key=sel_k.bytes,
            vote_first=vote_fst.native,
            vote_last=vote_lst.native,
            vote_key_dilution=vote_kd.native,
            state_proof_key=sp_key.bytes,
            fee=key_reg_fee
        ).submit()

##################################################
# Deleteable
#   allows contract to be deleted
##################################################
class Deleteable(ARC4Contract):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        self.deletable = bool(1) # 1 (Default unlocked)
    ##############################################
    # function: on_delete
    # arguments: None
    # purpose: on delete
    # pre-conditions
    # - only callable by creator
    # - deletable must be true
    # post-conditions:
    # - None
    ##############################################
    @arc4.baremethod(allow_actions=["DeleteApplication"])
    def on_delete(self) -> None:
        ##########################################
        # WARNING: This app can be deleted by the creator (Development)
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        assert self.deletable == UInt64(1), "not approved"
        ##########################################

##################################################
# Upgradeable
#   allows contract to be updated
##################################################
class Upgradeable(ARC4Contract):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        self.contract_version = UInt64()   # 0
        self.deployment_version = UInt64() # 0
        self.updatable = bool(1)           # 1 (Default unlocked)
    ##############################################
    # function: set_version
    # arguments:
    # - contract_version, contract version
    # - deployment_version, deployment version
    # purpose: set version
    # pre-conditions
    # - only callable by creator
    # post-conditions:
    # - contract_version and deployment_version set
    ##############################################
    @arc4.abimethod
    def set_version(self, contract_version: arc4.UInt64, deployment_version: arc4.UInt64) -> None:
        assert Txn.sender == Global.creator_address, "must be creator"
        self.contract_version = contract_version.native
        self.deployment_version = deployment_version.native
    ##############################################
    # function: on_update
    # arguments: None
    # purpose: on update
    # pre-conditions
    # - only callable by creator
    # - updatable must be true
    # post-conditions:
    # - None
    ##############################################
    @arc4.baremethod(allow_actions=["UpdateApplication"])
    def on_update(self) -> None:
        ##########################################
        # WARNING: This app can be updated by the creator
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        assert self.updatable == UInt64(1), "not approved"
        ##########################################

##################################################
# Lockable
#   allows contract to be lock network tokens
##################################################
class Lockable(Ownable):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        # hot state
        self.funder = Account()            # zero address
        self.period = UInt64()             # 0
        self.funding = UInt64()            # 0
        self.total = UInt64()              # 0
        self.initial = UInt64()            # 0
        self.deadline = UInt64()           # 0
        # cold state
        self.parent_id = UInt64()                                   # 0
        self.messenger_id = TemplateVar[UInt64]("MESSENGER_ID")     # ex) 0
        self.period_seconds = TemplateVar[UInt64]("PERIOD_SECONDS") # ex) 2592000
        self.lockup_delay = TemplateVar[UInt64]("LOCKUP_DELAY")     # ex) 12
        self.vesting_delay = TemplateVar[UInt64]("VESTING_DELAY")   # ex) 12
        self.period_limit = TemplateVar[UInt64]("PERIOD_LIMIT")     # ex) 5
    ##############################################
    # function: withdraw
    # arguments:
    # - amount
    # returns: min balance
    # purpose: extract funds from contract
    # pre-conditions
    # - only callable by owner
    # - let balance be the current balance of the
    #   contract
    # - balance - amount >= min_balance
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
        min_balance = self.calculate_min_balance()
        available_balance = get_available_balance()
        assert available_balance - amount.native >= min_balance, "balance available"
        if amount > 0:
            itxn.Payment(
                amount=amount.native,
                receiver=Txn.sender,
                fee=0
            ).submit()
        return min_balance
    ##############################################
    # function: close
    # purpose: deletes contract
    # pre-conditions:
    # - min balance is 0
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
        assert self.calculate_min_balance() == 0, "min balance not zero"
        ###########################################
        assert Txn.sender == self.owner, "must be owner"
        ###########################################
        oca = Txn.on_completion
        if oca == OnCompleteAction.DeleteApplication:
            keyreg_txn = itxn.KeyRegistration(
                non_participation=True,
                vote_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                selection_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                vote_first=UInt64(0),
                vote_last=UInt64(0),
                vote_key_dilution=UInt64(0),
                state_proof_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="),
                fee=0
            )
            pmt_txn = itxn.Payment(
                receiver=self.owner,
                close_remainder_to=self.owner,
                fee=0
            )
            itxn.submit_txns(keyreg_txn, pmt_txn)
        else:
            op.err() 
    ##############################################
    # function: min_balance (internal)
    # arguments: None
    # purpose: calcualte minimum balance
    # pre-conditions: None
    # post-conditions: None
    # notes:
    # - let period = number of months to to lockup
    #       total = total amount intially funded (airdrop + lockup bonus)
    #       y = vesting delay in months
    #       p = 1 / (self.period x 12) or 1 / (period)
    # - mimumum balance =
    #     total x min(1, p x max(0, (period - (now() - funding + y x seconds-in-month)) / seconds-in-month))
    ##############################################
    @subroutine
    def calculate_min_balance(self) -> UInt64:
        now: UInt64 = Global.latest_timestamp
        vesting_delay: UInt64 = TemplateVar[UInt64]("VESTING_DELAY") # vesting delay
        period_seconds: UInt64 = TemplateVar[UInt64]("PERIOD_SECONDS") 
        lockup_delay: UInt64 = TemplateVar[UInt64]("LOCKUP_DELAY") * self.period # lockup period
        min_balance: UInt64 = calculate_mab_pure(
            now,
            vesting_delay,
            period_seconds,
            lockup_delay,
            self.period,
            self.funding,
            self.total,
        )
        return min_balance
    ##############################################


    
##################################################
# Messenger
#   emits events
##################################################
class Messenger(Upgradeable):
    def __init__(self) -> None:
        super().__init__()
    @arc4.abimethod
    def partkey_broastcast(self, address: arc4.Address, vote_k: Bytes32, sel_k: Bytes32,
        vote_fst: arc4.UInt64, vote_lst: arc4.UInt64, vote_kd: arc4.UInt64, 
        sp_key: Bytes64) -> None: 
        arc4.emit(MessagePartKeyInfo(arc4.Address(Txn.sender), PartKeyInfo(address, 
            vote_k, sel_k, vote_fst, vote_lst, vote_kd, sp_key)))

##################################################
# OwnedUpgradeable
#  combines owned and upgradeable and adds method 
#  to approve update as owner
##################################################
class BaseBridge(Stakeable, Upgradeable, Ownable):
    def __init__(self) -> None:
        # stakeable state
        self.delegate = Account()          # zero address
        self.stakeable = bool(1)         # 1 (Default unlocked)
        # upgradeable state
        self.contract_version = UInt64()   # 0
        self.deployment_version = UInt64() # 0
        self.updatable = bool(1)           # 1 (Default unlocked)
        # ownable state
        self.owner = Account()             # zero address
    ##############################################
    # function: approve_update
    # arguments:
    # - approval, approval status
    # purpose: approve update
    # pre-conditions
    # - only callable by owner
    # post-conditions:
    # - updatable set to approval
    ##############################################
    @arc4.abimethod
    def approve_update(self, approval: arc4.Bool) -> None:
        assert Txn.sender == self.owner, "must be owner"
        self.updatable = approval.native


##################################################
# AirdropBridge
#   similar to base bridge with lockable
##################################################
class AirdropBridge(Stakeable, Upgradeable, Lockable):
    def __init__(self) -> None:
        # stakeable state
        self.delegate = Account()          # zero address
        self.stakeable = bool(1)         # 1 (Default unlocked)
        # upgradeable state
        self.contract_version = UInt64()   # 0
        self.deployment_version = UInt64() # 0
        self.updatable = bool(1)           # 1 (Default unlocked)
        # ownable state
        self.owner = Account()             # zero address
        # lockable state
        self.funder = Account()            # zero address
        self.period = UInt64()             # 0
        self.funding = UInt64()            # 0
        self.total = UInt64()              # 0
        self.initial = UInt64()            # 0
        self.deadline = UInt64()           # 0
        self.parent_id = UInt64()                                   # 0
        self.messenger_id = TemplateVar[UInt64]("MESSENGER_ID")     # ex) 0
        self.period_seconds = TemplateVar[UInt64]("PERIOD_SECONDS") # ex) 2592000
        self.lockup_delay = TemplateVar[UInt64]("LOCKUP_DELAY")     # ex) 12
        self.vesting_delay = TemplateVar[UInt64]("VESTING_DELAY")   # ex) 12
        self.period_limit = TemplateVar[UInt64]("PERIOD_LIMIT")     # ex) 5
    ############################################## 
    # function: approve_update
    # arguments:
    # - approval, approval status
    # purpose: approve update
    # pre-conditions
    # - only callable by owner
    # post-conditions:
    # - updatable set to approval
    ##############################################
    @arc4.abimethod
    def approve_update(self, approval: arc4.Bool) -> None:
        assert Txn.sender == self.owner, "must be owner"
        self.updatable = approval.native 

##################################################
# Base
#   smart contract staking
##################################################
class Base(BaseBridge):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        super().__init__()
        self.parent_id = UInt64()                               # 0
        self.messenger_id = TemplateVar[UInt64]("MESSENGER_ID") # ex) 0
    ##############################################
    # function: on_create
    # arguments: None
    # purpose: on create
    # pre-conditions
    # - only callable by CreateApplication
    # post-conditions:
    # - indexer_id set to caller_application_id
    ##############################################
    @arc4.baremethod(create="require")
    def on_create(self) -> None:
        caller_id = Global.caller_application_id
        assert caller_id > 0, "must be created by factory"
        self.parent_id = caller_id
    ##############################################
    # function: setup
    # arguments:
    # - owner, who is the beneficiary
    # - delegate, who is the delegate
    # purpose: set owner and delegate
    # post-conditions: owner and delegate set
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address, delegate: arc4.Address) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        self.owner = owner.native
        self.delegate = delegate.native
    ##############################################
    # function: withdraw
    # arguments:
    # - amount
    # returns: available balance
    # purpose: extract funds from contract
    # pre-conditions
    # - only callable by owner
    # post-conditions: 
    # - transfer amount from the contract account
    #   to owner
    # notes: costs 2 fees
    ##############################################
    @arc4.abimethod
    def withdraw(self, amount: arc4.UInt64) -> UInt64:
        ##########################################
        assert Txn.sender == self.owner, "must be owner" 
        ##########################################
        available_balance = get_available_balance()
        remaining_balance = available_balance - amount.native
        assert remaining_balance >= 0, "balance available"
        if amount > 0:
            itxn.Payment(
                amount=amount.native,
                receiver=Txn.sender,
                fee=0
            ).submit()
        return available_balance
    ##############################################
    # function: close
    # purpose: deletes contract
    # pre-conditions:
    # - must be owner 
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
        assert Txn.sender == self.owner, "must be owner"
        ###########################################
        oca = Txn.on_completion
        if oca == OnCompleteAction.DeleteApplication:
            keyreg_txn = itxn.KeyRegistration(
                non_participation=True,
                vote_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                selection_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                vote_first=UInt64(0),
                vote_last=UInt64(0),
                vote_key_dilution=UInt64(0),
                state_proof_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="),
                fee=0
            )
            pmt_txn = itxn.Payment(
                receiver=self.owner,
                close_remainder_to=self.owner,
                fee=0
            )
            itxn.submit_txns(keyreg_txn, pmt_txn)
        else:
            op.err() 

##################################################
# Airdrop
#   facilitates airdrop staking
##################################################
class Airdrop(AirdropBridge):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        super().__init__()
    ##############################################
    # function: on_create
    # arguments: None
    # purpose: on create
    # pre-conditions
    # - only callable by CreateApplication
    # post-conditions:
    # - indexer_id set to caller_application_id
    ##############################################
    @arc4.baremethod(create="require")
    def on_create(self) -> None:
        caller_id = Global.caller_application_id
        assert caller_id > 0, "must be created by factory"
        self.parent_id = caller_id
    #############################################
    # function: setup
    # arguments:
    # - owner, who is the beneficiary
    # purpose: set owner once
    # post-conditions: owner set
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address, funder: arc4.Address, deadline: arc4.UInt64,
        initial: arc4.UInt64) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        assert self.funder == Global.zero_address, "funder not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        self.owner = owner.native
        self.funder = funder.native
        self.deadline = deadline.native
        self.initial = initial.native
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
        assert self.deadline > Global.latest_timestamp, "deadline not passed"
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
    # - must be combined with payment transaction
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
    # function: close
    # purpose: deletes contract
    # pre-conditions:
    # - min balance is 0
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
        assert self.calculate_min_balance() == 0, "min balance not zero"
        ###########################################
        assert Txn.sender == self.owner or Txn.sender == self.funder, "must be owner or funder"
        ###########################################
        oca = Txn.on_completion
        if oca == OnCompleteAction.DeleteApplication:
            keyreg_txn = itxn.KeyRegistration(
                non_participation=True,
                vote_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                selection_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
                vote_first=UInt64(0),
                vote_last=UInt64(0),
                vote_key_dilution=UInt64(0),
                state_proof_key=Bytes.from_base64("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="),
                fee=0
            )
            pmt_txn = itxn.Payment(
                receiver=self.owner,
                close_remainder_to=self.owner,
                fee=0
            )
            itxn.submit_txns(keyreg_txn, pmt_txn)
        else:
            op.err() 
    ##############################################

##################################################
# StakeReward
#   facilitates airdrop staking
##################################################
class StakeReward(AirdropBridge):
    ##############################################
    # function: __init__ (builtin)
    # arguments: None
    # purpose: construct initial state
    # pre-conditions: None
    # post-conditions: initial state set
    ##############################################
    def __init__(self) -> None:
        super().__init__()
    ##############################################
    # function: on_create
    # arguments: None
    # purpose: on create
    # pre-conditions
    # - only callable by CreateApplication
    # post-conditions:
    # - indexer_id set to caller_application_id
    ##############################################
    @arc4.baremethod(create="require")
    def on_create(self) -> None:
        caller_id = Global.caller_application_id
        assert caller_id > 0, "must be created by factory"
        self.parent_id = caller_id
    #############################################
    # function: setup
    # arguments:
    # - owner, who is the beneficiary
    # purpose: set owner once
    # post-conditions: owner set
    ##############################################
    @arc4.abimethod
    def setup(self, owner: arc4.Address, funder: arc4.Address, delegate: arc4.Address,
        period: arc4.UInt64) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        assert self.funder == Global.zero_address, "funder not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator" 
        ##########################################
        assert period <= TemplateVar[UInt64]("PERIOD_LIMIT") 
        ##########################################
        #caller_address = Global.caller_application_address
        #payment_amount = require_payment(caller_address)
        #assert payment_amount >= UInt64(0), "payment amount accurate"
        ##########################################
        self.owner = owner.native
        self.funder = funder.native
        self.delegate = delegate.native
        self.deadline = Global.latest_timestamp
        self.period = period.native
    ##############################################
    # function: fill
    # arguments:
    # - funding, when funded
    # purpose: fund it
    # pre-conditions
    # - period must be set
    # - funding and total must be uninitialized
    # - must be combined with payment transaction
    #   for total amount
    # - must be only callable by funder 
    # post-conditions: 
    # - total and funding are set to arguments
    ##############################################
    @arc4.abimethod
    def fill(self) -> None:
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
        #assert funding > 0, "funding must be greater than zero"
        ##########################################
        application_address = Global.current_application_address
        self.initial = application_address.balance - payment_amount
        self.total = application_address.balance
        self.funding = Global.latest_timestamp
    ##############################################

class FactoryBridge(Ownable, Upgradeable):
    def __init__(self) -> None:
        # ownable state
        self.owner = Account()                          # zero address
        # upgradeable state
        self.contract_version = UInt64()                # 0
        self.deployment_version = UInt64()              # 0
        self.updatable = bool(1)                        # 1 (Default unlocked)

class BaseFactory(FactoryBridge):
    def __init__(self) -> None:
        super().__init__()
    ##############################################
    # @arc4.abimethod
    # def update(self) -> None:
    #      pass
    ##############################################
    # @arc4.abimethod
    # def remote_update(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    # @arc4.abimethod
    # def remote_delete(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    @arc4.abimethod
    def create(self, owner: arc4.Address, delegate: arc4.Address) -> UInt64:
        base_app = arc4.arc4_create(Base).created_app
        arc4.abi_call(Base.setup, owner, delegate, app_id=base_app)
        return base_app.id

class AirdropFactory(FactoryBridge):
    def __init__(self) -> None:
        super().__init__()
    ##############################################
    # @arc4.abimethod
    # def update(self) -> None:
    #      pass
    ##############################################
    # @arc4.abimethod
    # def remote_update(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    # @arc4.abimethod
    # def remote_delete(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    @arc4.abimethod
    def create(self, owner: arc4.Address, funder: arc4.Address, deadline: arc4.UInt64,
        initial: arc4.UInt64) -> UInt64:
        base_app = arc4.arc4_create(Airdrop).created_app
        arc4.abi_call(Airdrop.setup, owner, funder, deadline, initial, app_id=base_app)
        return base_app.id
    ##############################################


class StakeRewardFactory(FactoryBridge):
    def __init__(self) -> None:
        super().__init__()
    ##############################################
    # @arc4.abimethod
    # def update(self) -> None:
    #      pass
    ##############################################
    # @arc4.abimethod
    # def remote_update(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    # @arc4.abimethod
    # def remote_delete(self, app_id: arc4.UInt64) -> None:
    #     pass
    ##############################################
    @arc4.abimethod
    def create(self, owner: arc4.Address, funder: arc4.Address, delegate: arc4.Address,
        period: arc4.UInt64) -> UInt64:
        payment_amount = require_payment(Txn.sender) 
        mbr_increase = UInt64(67750)
        assert payment_amount > mbr_increase, "payment amount accurate" 
        base_app = arc4.arc4_create(StakeReward).created_app
        itxn.Payment(
            receiver=base_app.address,
            amount=payment_amount - mbr_increase,
            fee=0
        ).submit()
        arc4.abi_call(StakeReward.setup, owner, funder, delegate, period, app_id=base_app)
        return base_app.id
    ############################################## 
