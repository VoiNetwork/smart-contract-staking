# Upgradable: Close Offline to Funder

In order to perform contract upgrade:

1. Implement `upgrade` method in `Airdrop` contract.

```
@arc4.abimethod(allow_actions=[OnCompleteAction.DeleteApplication])
def update(self) -> None:
  assert Txn.sender == self.upgrader, "must be upgrader"
  assert self.updatable == UInt64(1), "not approved"
  close_offline_on_delete(self.funder)
```

2. Use command line tool to upgrade contract as `upgrader` account.

```
scs-cli airdrop update -a 1
```