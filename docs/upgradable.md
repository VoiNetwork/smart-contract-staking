# Upgradable

The `Upgradable` concrete class provides a way to upgrade a contract to a new version while maintaining state. It is designed to be used as a base class for contracts that need to be upgradable. It also allows for optional upgradability, so that contracts can be deployed with the ability for authorized user to opt-out of future upgrades.

## Upgradable Contract

An upgradable contract may be upgraded by the `upgrader` account. At time of deployment, `upgrader` is set the the creator account. Only the creator account may grant the `upgrader` role to another account. 

In order to perform contract upgrade followed by action:

1. Implement `upgrade` method in `Airdrop` contract.

```
@arc4.abimethod
def update(self) -> None:
  ##########################################
  assert Txn.sender == self.upgrader, "must be upgrader"
  ##########################################
  assert self.updatable == UInt64(1), "not approved"
  ##########################################
  # replace pass with your code
  pass 
```

2. Use command line tool to upgrade contract as `upgrader` account.

```
scs-cli airdrop update -a 1
```