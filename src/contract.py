import typing
from algopy import (
    ARC4Contract,
    Account,
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
from src.contract_mab import calculate_mab_pure
from src.utils import require_payment, get_available_balance, close_offline_on_delete

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


##################################################
# Receiver
#   reference to messenger
##################################################


class ReceiverInterface(ARC4Contract):
    """
    Interface for all abimethods of receiver contract.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.messenger_id = UInt64()


class Receiver(ReceiverInterface):
    def __init__(self) -> None:  # pragma: no cover
        super().__init__()


##################################################
# Ownable
#   allows contract to be owned
##################################################


class OwnershipTransferred(arc4.Struct):
    previousOwner: arc4.Address
    newOwner: arc4.Address


class OwnableInterface(ARC4Contract):
    """
    Interface for all abimethods operated by owner.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.owner = Account()

    @arc4.abimethod
    def transfer(self, new_owner: arc4.Address) -> None:  # pragma: no cover
        """
        Transfer ownership of the contract to a new owner. Emits OwnershipTransferred event.
        """
        pass


class Ownable(OwnableInterface):
    def __init__(self) -> None:  # pragma: no cover
        super().__init__()

    @arc4.abimethod
    def transfer(self, new_owner: arc4.Address) -> None:
        assert Txn.sender == self.owner, "must be owner"
        arc4.emit(OwnershipTransferred(arc4.Address(self.owner), new_owner))
        self.owner = new_owner.native


##################################################
# Fundable
#   allows contract to be funded
##################################################


class Filled(arc4.Struct):
    amount: arc4.UInt64
    total: arc4.UInt64


class FunderGranted(arc4.Struct):
    previousFunder: arc4.Address
    newFunder: arc4.Address


class FundingSet(arc4.Struct):
    old_funding: arc4.UInt64
    funding: arc4.UInt64


class FundingAborted(arc4.Struct):
    owner: arc4.Address
    funder: arc4.Address


class TotalReduced(arc4.Struct):
    adjustment: arc4.UInt64
    newTotal: arc4.UInt64


class FundableInterface(ARC4Contract):
    """
    Interface for all methods called by funder.

    This class defines the basic interface for all types of vehicles,
    including methods for starting and stopping the engine. Subclasses
    must implement these methods to provide concrete behavior

    Global State:
    - funder, who funded the contract
    - funding, when funded
    """

    def __init__(self) -> None:  # pragma: no cover
        self.funder = Account()
        self.funding = UInt64()
        self.total = UInt64()

    @arc4.abimethod
    def fill(self) -> None:  # pragma: no cover
        """
        Add funds to the contract and increments total.
        """
        pass

    @arc4.abimethod
    def set_funding(self, funding: arc4.UInt64) -> None:  # pragma: no cover
        """
        Extend the funding period. Should be called before the funding deadline.
        Should not allow setting the funding deadline back. Can be called multiple
        times.
        """
        pass

    @arc4.abimethod(allow_actions=[OnCompleteAction.DeleteApplication])
    def abort_funding(self) -> None:  # pragma: no cover
        """
        Abort funding. Must be called when funding not initialized.
        """
        pass

    @arc4.abimethod
    def reduce_total(self, adjustment: arc4.UInt64) -> None:  # pragma: no cover
        """
        Adjust total funding. Should be called by funder when funding not initialized.
        Used to reduce the total funding amount in the contract in case of staking
        program last funded account.
        """
        pass


class Fundable(FundableInterface):
    def __init__(self) -> None:  # pragma: no cover
        super().__init__()

    @arc4.abimethod
    def fill(self) -> None:
        #########################################
        assert Txn.sender == self.funder, "must be funder"
        #########################################
        payment_amount = require_payment(self.funder)
        assert payment_amount >= UInt64(0), "payment amount accurate"
        #########################################
        total = self.total + payment_amount
        arc4.emit(
            Filled(
                arc4.UInt64(payment_amount),
                arc4.UInt64(total),
            )
        )
        self.total = total

    @arc4.abimethod
    def grant_funder(self, funder: arc4.Address) -> None:
        #########################################
        assert Txn.sender == self.funder, "must be funder"
        #########################################
        arc4.emit(FunderGranted(arc4.Address(self.funder), funder))
        self.funder = funder.native

    @arc4.abimethod
    def set_funding(self, funding: arc4.UInt64) -> None:  # pragma: no cover
        #########################################
        assert Txn.sender == self.funder, "must be funder"
        #########################################
        assert (
            self.funding == UInt64(0) or self.funding > Global.latest_timestamp
        ), "funding not be initialized or can be extended"
        #########################################
        arc4.emit(FundingSet(arc4.UInt64(self.funding), funding))
        self.funding = funding.native

    @arc4.abimethod(allow_actions=[OnCompleteAction.DeleteApplication])
    def abort_funding(self) -> None:
        #########################################
        assert Txn.sender == self.funder, "must be funder"
        #########################################
        assert self.funding == UInt64(0)
        #########################################
        arc4.emit(FundingAborted(arc4.Address(self.funder), arc4.Address(self.funder)))
        close_offline_on_delete(self.funder)

    @arc4.abimethod
    def reduce_total(self, adjustment: arc4.UInt64) -> None:
        #########################################
        assert Txn.sender == self.funder, "must be funder"
        #########################################
        assert self.funding == UInt64(0)
        #########################################
        assert adjustment <= self.total, "adjustment accurate"
        #########################################
        total = self.total - adjustment.native
        arc4.emit(TotalReduced(adjustment, arc4.UInt64(total)))
        self.total = total


##################################################
# Stakeable
#   allows contract to participate in consensus,
#   stake
##################################################


class DelegateUpdated(arc4.Struct):
    previousDelegate: arc4.Address
    newDelegate: arc4.Address


class Participated(arc4.Struct):
    who: arc4.Address
    partkey: PartKeyInfo


class StakeableInterface(ARC4Contract):
    """
    Interface for all abimethods of stakeable contract.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.delegate = Account()
        self.stakeable = bool(1)

    @arc4.abimethod
    def set_delegate(self, delegate: arc4.Address) -> None:  # pragma: no cover
        """
        Set delegate.
        """
        pass

    @arc4.abimethod
    def participate(
        self,
        vote_k: Bytes32,
        sel_k: Bytes32,
        vote_fst: arc4.UInt64,
        vote_lst: arc4.UInt64,
        vote_kd: arc4.UInt64,
        sp_key: Bytes64,
    ) -> None:  # pragma: no cover
        """
        Participate in consensus.
        """
        pass


class Stakeable(StakeableInterface, OwnableInterface):
    def __init__(self) -> None:  # pragma: no cover
        # ownable state
        self.owner = Account()
        # stakeable state
        self.delegate = Account()  # zero address
        self.stakeable = bool(1)  # 1 (Default unlocked)

    @arc4.abimethod
    def set_delegate(self, delegate: arc4.Address) -> None:
        assert (
            Txn.sender == self.owner or Txn.sender == Global.creator_address
        ), "must be owner or creator"
        arc4.emit(DelegateUpdated(arc4.Address(self.delegate), delegate))
        self.delegate = delegate.native

    @arc4.abimethod
    def participate(
        self,
        vote_k: Bytes32,
        sel_k: Bytes32,
        vote_fst: arc4.UInt64,
        vote_lst: arc4.UInt64,
        vote_kd: arc4.UInt64,
        sp_key: Bytes64,
    ) -> None:
        ###########################################
        assert (
            Txn.sender == self.owner or Txn.sender == self.delegate
        ), "must be owner or delegate"
        ###########################################
        key_reg_fee = Global.min_txn_fee
        # require payment of min fee to prevent draining
        assert require_payment(Txn.sender) == key_reg_fee, "payment amout accurate"
        ###########################################
        arc4.emit(
            Participated(
                arc4.Address(Txn.sender),
                PartKeyInfo(
                    address=arc4.Address(Txn.sender),
                    vote_key=vote_k,
                    selection_key=sel_k,
                    vote_first=vote_fst,
                    vote_last=vote_lst,
                    vote_key_dilution=vote_kd,
                    state_proof_key=sp_key,
                ),
            )
        )
        itxn.KeyRegistration(
            vote_key=vote_k.bytes,
            selection_key=sel_k.bytes,
            vote_first=vote_fst.native,
            vote_last=vote_lst.native,
            vote_key_dilution=vote_kd.native,
            state_proof_key=sp_key.bytes,
            fee=key_reg_fee,
        ).submit()


##################################################
# Deleteable
#   allows contract to be deleted
##################################################


class DeleteableInterface(ARC4Contract):
    """
    Interface for all abimethods of deletable contract.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.deletable = bool(1)

    @arc4.abimethod
    def on_delete(self) -> None:  # pragma: no cover
        """
        Delete the contract.
        """
        pass


class Deleteable(DeleteableInterface):
    def __init__(self) -> None:  # pragma: no cover
        super().__init__()

    @arc4.baremethod(allow_actions=["DeleteApplication"])
    def on_delete(self) -> None:  # pragma: no cover
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


class VersionUpdated(arc4.Struct):
    contract_version: arc4.UInt64
    deployment_version: arc4.UInt64


class UpdateApproved(arc4.Struct):
    who: arc4.Address
    approval: arc4.Bool


class UpgradeableInterface(ARC4Contract):
    """
    Interface for all abimethods of upgradeable contract.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.contract_version = UInt64()
        self.deployment_version = UInt64()
        self.updatable = bool(1)

    @arc4.abimethod
    def set_version(
        self, contract_version: arc4.UInt64, deployment_version: arc4.UInt64
    ) -> None:  # pragma: no cover
        """
        Set contract and deployment version.
        """
        pass

    @arc4.abimethod
    def on_update(self) -> None:  # pragma: no cover
        """
        On update.
        """
        pass

    @arc4.abimethod
    def approve_update(self, approval: arc4.Bool) -> None:  # pragma: no cover
        """
        Approve update.
        """
        pass


class Upgradeable(UpgradeableInterface, OwnableInterface):
    def __init__(self) -> None:  # pragma: no cover
        # ownable state
        self.owner = Account()
        # upgradeable state
        self.contract_version = UInt64()
        self.deployment_version = UInt64()
        self.updatable = bool(1)

    @arc4.abimethod
    def set_version(
        self, contract_version: arc4.UInt64, deployment_version: arc4.UInt64
    ) -> None:
        assert Txn.sender == Global.creator_address, "must be creator"
        arc4.emit(VersionUpdated(contract_version, deployment_version))
        self.contract_version = contract_version.native
        self.deployment_version = deployment_version.native

    @arc4.baremethod(allow_actions=["UpdateApplication"])
    def on_update(self) -> None:
        ##########################################
        # WARNING: This app can be updated by the creator
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        assert self.updatable == UInt64(1), "not approved"
        ##########################################

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
        arc4.emit(UpdateApproved(arc4.Address(self.owner), approval))
        self.updatable = approval.native


##################################################
# Deployable
#   ensures that contract is created by factory
#   and recorded
##################################################


class DeployableInterface(ARC4Contract):
    """
    Interface for all abimethods of deployable contract.
    """

    def __init__(self) -> None:  # pragma: no cover
        self.parent_id = UInt64()
        self.deployer = Account()

    @arc4.abimethod(create="require")
    def on_create(self) -> None:  # pragma: no cover
        """
        Execute on create.
        """
        pass


class Deployable(DeployableInterface):
    def __init__(self) -> None:  # pragma: no cover
        super().__init__()

    @arc4.baremethod(create="require")
    def on_create(self) -> None:
        caller_id = Global.caller_application_id
        assert caller_id > 0, "must be created by factory"
        self.parent_id = caller_id


##################################################
# Lockable
#   allows contract to be lock network tokens
##################################################


class Template(arc4.Struct):
    period_limit: arc4.UInt64
    vesting_delay: arc4.UInt64
    lockup_delay: arc4.UInt64
    period_seconds: arc4.UInt64
    messenger_id: arc4.UInt64
    distribution_count: arc4.UInt64
    distribution_seconds: arc4.UInt64
    period: arc4.UInt64
    deadline: arc4.UInt64
    total: arc4.UInt64
    funding: arc4.UInt64
    delegate: arc4.Address


class Setup(arc4.Struct):
    deployer: arc4.Address
    owner: arc4.Address
    funder: arc4.Address
    initial: arc4.UInt64


class Configured(arc4.Struct):
    old_period: arc4.UInt64
    period: arc4.UInt64


class Withdrawn(arc4.Struct):
    min_balance: arc4.UInt64
    amount: arc4.UInt64


class Closed(arc4.Struct):
    who: arc4.Address
    close_remainder_to: arc4.Address


class LockableInterface(ARC4Contract):
    """
    Interface for all methods of lockable contracts.
    This class defines the basic interface for all types of lockable contracts.
    Subclasses must implement these methods to provide concrete behavior

    Global State:
    - period, lockup period
    - initial, initial balance
    - deadline, deadline for lockup period configuration
    - period_seconds, seconds in a period
    - lockup_delay, lockup delay
    - vesting_delay, vesting delay
    - period_limit, period limit
    """

    def __init__(self) -> None:  # pragma: no cover
        self.period = UInt64()  # 0
        self.initial = UInt64()  # 0
        self.deadline = UInt64()  # 0
        self.period_seconds = UInt64()  # 0
        self.lockup_delay = UInt64()  # 0
        self.vesting_delay = UInt64()  # 0
        self.period_limit = UInt64()  # 0
        self.distribution_count = UInt64()  # 0
        self.distribution_seconds = UInt64()  # 0

    @arc4.abimethod
    def template(
        self,
        period_limit: arc4.UInt64,
        vesting_delay: arc4.UInt64,
        lockup_delay: arc4.UInt64,
        period_seconds: arc4.UInt64,
        messenger_id: arc4.UInt64,
        distribution_count: arc4.UInt64,
        distribution_seconds: arc4.UInt64,
        period: arc4.UInt64,
        deadline: arc4.UInt64,
        total: arc4.UInt64,
        funding: arc4.UInt64,
        delegate: arc4.Address,
    ) -> None:
        """
        Template method.
        """
        pass

    @arc4.abimethod
    def setup(
        self,
        deployer: arc4.Address,
        owner: arc4.Address,
        funder: arc4.Address,
        initial: arc4.UInt64,
    ) -> None:  # pragma: no cover
        """
        Setup lockup. Should be called by creator.
        """
        pass

    @arc4.abimethod
    def configure(self, period: arc4.UInt64) -> None:  # pragma: no cover
        """
        Configure lockup period. Should be called by owner.
        """
        pass

    @arc4.abimethod
    def withdraw(self, amount: arc4.UInt64) -> UInt64:  # pragma: no cover
        """
        Withdraw funds from contract. Should be called by owner.
        """
        return UInt64()

    @arc4.abimethod
    def close(self) -> None:  # pragma: no cover
        """
        Close contract. Should be called by owner or funder.
        """
        pass

    @subroutine
    def calculate_min_balance(self) -> UInt64:  # pragma: no cover
        """
        Calculate minimum balance.
        """
        return UInt64()


##################################################
# Lockable
#   allows contract to be lock network tokens
# State:
#   hot state
#     - funder, who funded the contract
#     - period, lockup period
#     - funding, when funded
#     - total, total amount funded
#     - initial, initial balance
#     - deadline, funding deadline
#   warm state
#     - vesting_delay, vesting delay
#       periods from funding until lockup
#       vesting delay in early staking rewards
#       depends on period
#       ex)
#         vd = (p + 1) 2 / 3
#               , where p is between 1 and 18
#       otherwise cold
#   cold state
#     - parent_id, parent id
#     - period_seconds, period seconds
#     - lockup_delay, lockup delay
#     - period_limit, period limit
##################################################
class Lockable(
    LockableInterface,
    OwnableInterface,
    FundableInterface,
    DeployableInterface,
    ReceiverInterface,
):
    def __init__(self) -> None:  # pragma: no cover
        # ownable state
        self.owner = Account()
        # lockable state
        self.period = UInt64()
        self.initial = UInt64()
        self.deadline = UInt64()
        self.period_seconds = UInt64()
        self.lockup_delay = UInt64()
        self.vesting_delay = UInt64()
        self.period_limit = UInt64()
        self.distribution_count = UInt64()
        self.distribution_seconds = UInt64()
        # fundable state
        self.funder = Account()
        self.funding = UInt64()
        self.total = UInt64()
        # deployable state
        self.parent_id = UInt64()
        self.deployer = Account()
        # receiver state
        self.messenger_id = UInt64()

    @arc4.abimethod
    def setup(
        self,
        deployer: arc4.Address,
        owner: arc4.Address,
        funder: arc4.Address,
        initial: arc4.UInt64,
    ) -> None:
        ##########################################
        assert self.owner == Global.zero_address, "owner not initialized"
        assert self.funder == Global.zero_address, "funder not initialized"
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        ##########################################
        arc4.emit(Setup(deployer, owner, funder, initial))
        self.deployer = deployer.native
        self.owner = owner.native
        self.funder = funder.native
        self.initial = initial.native

    @arc4.abimethod
    def configure(self, period: arc4.UInt64) -> None:
        ##########################################
        assert self.funding == 0, "funding not initialized"
        assert self.total == 0, "total not initialized"
        ##########################################
        assert Txn.sender == self.owner, "must be owner"
        ##########################################
        assert period <= self.period_limit
        ##########################################
        assert self.deadline > Global.latest_timestamp, "deadline not passed"
        ##########################################
        arc4.emit(Configured(arc4.UInt64(self.period), period))
        self.period = period.native

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
        """
        Withdraw funds from contract.
        """
        ##########################################
        assert Txn.sender == self.owner, "must be owner"
        ##########################################
        if self.funding > 0:
            min_balance = self.calculate_min_balance()
            arc4.emit(Withdrawn(arc4.UInt64(min_balance), amount))
            available_balance = get_available_balance()
            assert available_balance - amount.native >= min_balance, "balance available"
            if amount > 0:
                itxn.Payment(amount=amount.native, receiver=Txn.sender, fee=0).submit()
            return min_balance
        else:
            min_balance = self.total
            arc4.emit(Withdrawn(arc4.UInt64(min_balance), amount))
            available_balance = get_available_balance()
            assert available_balance - amount.native >= min_balance, "balance available"
            if amount > 0:
                itxn.Payment(amount=amount.native, receiver=Txn.sender, fee=0).submit()
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
    @arc4.abimethod(allow_actions=[OnCompleteAction.DeleteApplication])
    def close(self) -> None:
        ###########################################
        assert self.funding > 0, "funded"
        ###########################################
        assert self.calculate_min_balance() == 0, "min balance not zero"
        ###########################################
        assert (
            Txn.sender == self.owner or Txn.sender == self.funder
        ), "must be owner or funder"
        ###########################################
        arc4.emit(Closed(arc4.Address(Txn.sender), arc4.Address(self.owner)))
        close_offline_on_delete(self.owner)

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
        min_balance: UInt64 = calculate_mab_pure(
            now,
            self.vesting_delay,
            self.period_seconds,
            self.lockup_delay,
            self.period,
            self.funding,
            self.total,
            self.distribution_count,
            self.distribution_seconds,
        )
        return min_balance


##################################################
# Messenger
#   emits events
##################################################


class MessagePartKeyInfo(arc4.Struct):
    who: arc4.Address
    partkey: PartKeyInfo


class MessengerInterface(ARC4Contract):
    """
    Interface for all abimethods of messenger contract.
    """

    @arc4.abimethod
    def partkey_broastcast(
        self,
        address: arc4.Address,
        vote_k: Bytes32,
        sel_k: Bytes32,
        vote_fst: arc4.UInt64,
        vote_lst: arc4.UInt64,
        vote_kd: arc4.UInt64,
        sp_key: Bytes64,
    ) -> None:  # pragma: no cover
        """
        Broastcast partkey information.
        """
        pass


class Messenger(MessengerInterface, Upgradeable):
    def __init__(self) -> None:  # pragma: no cover
        # upgradeable state
        self.contract_version = UInt64()  # 0
        self.deployment_version = UInt64()  # 0
        self.updatable = bool(1)  # 1 (Default unlocked)

    @arc4.abimethod
    def partkey_broastcast(
        self,
        address: arc4.Address,
        vote_k: Bytes32,
        sel_k: Bytes32,
        vote_fst: arc4.UInt64,
        vote_lst: arc4.UInt64,
        vote_kd: arc4.UInt64,
        sp_key: Bytes64,
    ) -> None:
        arc4.emit(
            MessagePartKeyInfo(
                arc4.Address(Txn.sender),
                PartKeyInfo(
                    address, vote_k, sel_k, vote_fst, vote_lst, vote_kd, sp_key
                ),
            )
        )


##################################################
# Airdrop
#   facilitates airdrop staking
##################################################


class Airdrop(
    Lockable, Ownable, Fundable, Deployable, Stakeable, Upgradeable, Receiver
):
    def __init__(self) -> None:  # pragma: no cover
        # deployable state
        self.parent_id = UInt64()
        self.deployer = Account()
        # stakeable state
        self.delegate = Account()
        self.stakeable = bool(1)
        # upgradeable state
        self.contract_version = UInt64()
        self.deployment_version = UInt64()
        self.updatable = bool(1)
        # ownable state
        self.owner = Account()
        # lockable state
        self.period = UInt64()
        self.initial = UInt64()
        self.deadline = UInt64()
        self.period_seconds = UInt64()
        self.lockup_delay = UInt64()
        self.vesting_delay = UInt64()
        self.period_limit = UInt64()
        self.distribution_count = UInt64()
        self.distribution_seconds = UInt64()
        # fundable state
        self.funder = Account()
        self.funding = UInt64()
        self.total = UInt64()
        # receiver state
        self.messenger_id = UInt64()

    # implements lockable template method
    @arc4.abimethod
    def template(
        self,
        period_limit: arc4.UInt64,
        vesting_delay: arc4.UInt64,
        lockup_delay: arc4.UInt64,
        period_seconds: arc4.UInt64,
        messenger_id: arc4.UInt64,
        distribution_count: arc4.UInt64,
        distribution_seconds: arc4.UInt64,
        period: arc4.UInt64,
        deadline: arc4.UInt64,
        total: arc4.UInt64,
        funding: arc4.UInt64,
        delegate: arc4.Address,
    ) -> None:
        """
        Template method.
        """
        ##########################################
        assert Txn.sender == Global.creator_address, "must be creator"
        assert self.period_limit == UInt64(0), "period limit not initialized"
        assert self.vesting_delay == UInt64(0), "vesting delay not initialized"
        assert self.lockup_delay == UInt64(0), "lockup delay not initialized"
        assert self.period_seconds == UInt64(0), "period seconds not initialized"
        assert self.messenger_id == UInt64(0), "messenger id not initialized"
        assert self.distribution_count == UInt64(
            0
        ), "distribution count not initialized"
        assert self.distribution_seconds == UInt64(
            0
        ), "distribution seconds not initialized"
        assert self.distribution_count == UInt64(
            0
        ), "distribution count not initialized"
        assert self.distribution_seconds == UInt64(
            0
        ), "distribution seconds not initialized"
        assert distribution_seconds > UInt64(0), "distribution seconds must be positive"
        assert distribution_count > UInt64(0), "distribution count must be positive"
        assert self.period == UInt64(0), "period not initialized"
        assert self.deadline == UInt64(0), "deadline not initialized"
        assert self.total == UInt64(0), "total not initialized"
        assert self.funding == UInt64(0), "funding not initialized"
        assert self.delegate == Global.zero_address, "delegate not initialized"
        ##########################################
        arc4.emit(
            Template(
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
        )
        self.period_limit = period_limit.native
        self.vesting_delay = vesting_delay.native
        self.lockup_delay = lockup_delay.native
        self.period_seconds = period_seconds.native
        self.messenger_id = messenger_id.native
        self.distribution_count = distribution_count.native
        self.distribution_seconds = distribution_seconds.native
        self.period = period.native
        self.deadline = deadline.native
        self.total = total.native
        self.funding = funding.native
        self.delegate = delegate.native

    # override fundable abort_funding abimethod
    #   close offline on delete to owner
    @arc4.abimethod(allow_actions=[OnCompleteAction.DeleteApplication])
    def abort_funding(self) -> None:
        ##########################################
        assert (
            Txn.sender == self.funder or Txn.sender == self.owner
        ), "must be funder or owner"
        ##########################################
        assert self.funding == UInt64(0)
        ##########################################
        arc4.emit(
            FundingAborted(
                arc4.Address(Txn.sender),
                arc4.Address(self.owner),
            )
        )
        close_offline_on_delete(self.owner)


##################################################
# BaseFactory
#   factory for airdrop also serves as a base for
#   upgrading contracts if applicable
##################################################


class FactoryCreated(arc4.Struct):
    created_app: arc4.UInt64


class BaseFactory(Upgradeable):
    """
    Base factory for all factories.
    """

    def __init__(self) -> None:  # pragma: no cover
        """
        Initialize factory.
        """
        # upgradeable state
        self.contract_version = UInt64()  # 0
        self.deployment_version = UInt64()  # 0
        self.updatable = bool(1)  # 1 (Default unlocked)

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
        # def create(self, *args) -> UInt64:
        #    return UInt64()
        ##############################################

    @subroutine
    def get_initial_payment(self) -> UInt64:
        """
        Get initial payment.
        """
        payment_amount = require_payment(Txn.sender)
        mbr_increase = UInt64(884500)
        min_balance = op.Global.min_balance  # 100000
        assert (
            payment_amount >= mbr_increase + min_balance
        ), "payment amount accurate"  # 884500 + 100000 = 984500
        initial = payment_amount - mbr_increase - min_balance
        return initial


##################################################
# AirdropFactory
#   factory for airdrop also serves as a base for
#   upgrading contracts if applicable
##################################################


class AirdropFactory(BaseFactory):
    """
    Factory for airdrop requiring lockup period
    configuration and funding.
    """

    def __init__(self) -> None:  # pragma: no cover
        super().__init__()

    @arc4.abimethod
    def create(
        self,
        owner: arc4.Address,
        funder: arc4.Address,
        deadline: arc4.UInt64,
        initial: arc4.UInt64,
    ) -> UInt64:
        """
        Create airdrop.

        Arguments:
        - owner, who is the beneficiary
        - funder, who funded the contract
        - deadline, funding deadline
        - initial, initial funded value not including lockup bonus

        Returns:
        - app id
        """
        ##########################################
        self.get_initial_payment()
        ##########################################
        base_app = arc4.arc4_create(Airdrop).created_app
        arc4.emit(FactoryCreated(arc4.UInt64(base_app.id)))
        arc4.abi_call(
            Airdrop.template,
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_LIMIT")),
            arc4.UInt64(UInt64(0)),  # vesting delay
            arc4.UInt64(TemplateVar[UInt64]("LOCKUP_DELAY")),
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_SECONDS")),
            arc4.UInt64(TemplateVar[UInt64]("MESSENGER_ID")),
            arc4.UInt64(TemplateVar[UInt64]("DISTRIBUTION_COUNT")),
            arc4.UInt64(TemplateVar[UInt64]("DISTRIBUTION_SECONDS")),
            arc4.UInt64(UInt64(0)),  # period
            deadline,
            arc4.UInt64(UInt64(0)),  # total
            arc4.UInt64(UInt64(0)),  # funding
            arc4.Address(Global.zero_address),
            app_id=base_app,
        )
        itxn.Payment(
            receiver=base_app.address, amount=op.Global.min_balance, fee=0  # 100000
        ).submit()
        arc4.abi_call(  # setup(deployer, owner, funder, initial)
            Airdrop.setup, Txn.sender, owner, funder, initial, app_id=base_app
        )
        # configured by owner
        # funder
        #   fill
        #   set funding
        # vesting
        # lockup
        # done
        ##########################################
        return base_app.id


##################################################
# StakingFactory
##################################################


class StakingFactory(BaseFactory):
    def __init__(self) -> None:  # pragma: no cover
        """
        Factory for staking contract.
        """
        super().__init__()

    @arc4.abimethod
    def create(
        self,
        owner: arc4.Address,
        funder: arc4.Address,
        delegate: arc4.Address,
        period: arc4.UInt64,
    ) -> UInt64:
        """
        Create early stake reward.

        Arguments:
        - owner, who is the beneficiary
        - funder, who funded the contract
        - delegate, who is the delegate
        - period, lockup period

        Returns:
        - app id
        """
        ##########################################
        initial = self.get_initial_payment()
        ##########################################
        assert period < 18, "period less than 18"
        ##########################################
        base_app = arc4.arc4_create(Airdrop).created_app
        arc4.emit(FactoryCreated(arc4.UInt64(base_app.id)))
        arc4.abi_call(  # emit Template
            Airdrop.template,
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_LIMIT")),
            arc4.UInt64(TemplateVar[UInt64]("VESTING_DELAY")),
            arc4.UInt64(TemplateVar[UInt64]("LOCKUP_DELAY")),
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_SECONDS")),
            arc4.UInt64(TemplateVar[UInt64]("MESSENGER_ID")),
            arc4.UInt64((period.native + UInt64(2)) * UInt64(2) // UInt64(3)),
            arc4.UInt64(TemplateVar[UInt64]("DISTRIBUTION_SECONDS")),
            period,
            Global.latest_timestamp,  # deadline
            initial,  # total
            arc4.UInt64(UInt64(0)),  # funding
            delegate,
            app_id=base_app,
        )
        itxn.Payment(
            receiver=base_app.address, amount=initial + op.Global.min_balance, fee=0
        ).submit()
        arc4.abi_call(  # emit Setup(deployer, owner, funder, inttial)
            Airdrop.setup,
            Txn.sender,
            owner,
            funder,
            initial,
            app_id=base_app,
        )
        # funder
        #   fill, set funding, abort
        # vesting, lockup
        #   withdraw, participate
        # close
        #########################################
        return base_app.id


##################################################
# CompensationFactory
##################################################


class CompensationFactory(BaseFactory):
    def __init__(self) -> None:  # pragma: no cover
        """
        Factory for staking contract.
        """
        super().__init__()
        self.contract_version = UInt64(1)

    @arc4.abimethod
    def create(
        self,
        owner: arc4.Address,
    ) -> UInt64:
        """
        Create compensation contract.

        Arguments:
        - owner, who is the beneficiary
        - period, vesting period

        Returns:
        - app id
        """
        ##########################################
        initial = self.get_initial_payment()
        ##########################################
        # total, payment amount
        # period, 0 (no lockup)
        # deadline, now
        # vesting delay, 0 (no vesting)
        # deployer Sender
        # owner arg
        # funder Sender
        ##########################################
        base_app = arc4.arc4_create(Airdrop).created_app
        arc4.emit(FactoryCreated(arc4.UInt64(base_app.id)))
        arc4.abi_call(  # emit Template
            Airdrop.template,
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_LIMIT")),
            arc4.UInt64(UInt64(0)),  # vesting delay
            arc4.UInt64(TemplateVar[UInt64]("LOCKUP_DELAY")),
            arc4.UInt64(TemplateVar[UInt64]("PERIOD_SECONDS")),
            arc4.UInt64(TemplateVar[UInt64]("MESSENGER_ID")),
            arc4.UInt64(TemplateVar[UInt64]("DISTRIBUTION_COUNT")),
            arc4.UInt64(TemplateVar[UInt64]("DISTRIBUTION_SECONDS")),
            arc4.UInt64(UInt64(0)),  # period
            Global.latest_timestamp,  # deadline
            initial,  # total
            Global.latest_timestamp,  # funding
            Global.zero_address,
            app_id=base_app,
        )
        itxn.Payment(
            receiver=base_app.address, amount=initial + op.Global.min_balance, fee=0
        ).submit()
        arc4.abi_call(  # emit Setup(Txn.sender, owner, Txn.sender, initial)
            Airdrop.setup,
            Txn.sender,  # deployer
            owner,  # owner
            Txn.sender,  # funder
            initial,  # initial
            app_id=base_app,
        )
        # vesting
        #   withdraw, participate
        # close
        #########################################
        return base_app.id
