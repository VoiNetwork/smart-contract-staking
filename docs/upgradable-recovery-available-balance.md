# Upgradable: Recovery Available Balance

In order to perform contract upgrade followed by action:

1. Implement `upgrade` method in `Airdrop` contract.

```
@arc4.abimethod
def update(self) -> None:
  assert Txn.sender == self.upgrader, "must be upgrader"
  assert self.updatable == UInt64(1), "not approved"
  available_balance = get_available_balance()
  itxn.Payment(receiver=Txn.sender, amount=available_balance, fee=0).submit()
```

2. Use command line tool to upgrade contract as `upgrader` account.

```
scs-cli app update -a APID
```