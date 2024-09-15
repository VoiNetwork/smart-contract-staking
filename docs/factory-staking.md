# Factory

## Variables

| Variable Name          | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `PERIOD_LIMIT`         | Determines max value for lockup in configurable airdrop contract. |
| `VESTING_DELAY`        | Determines the number of periods before vesting starts.           |
| `LOCKUP_DELAY`         | Determines the number of periods of a single lockup.              |
| `PERIOD_SECONDS`       | Determines the number of seconds in a period.                     |
| `MESSENGER_ID`         | Determines the messenger id for the airdrop contract.             |
| `DISTRIBUTION_COUNT`   | Determines the number of distributions.                           |
| `DISTRIBUTION_SECONDS` | Determines the number of seconds between distributions.           |

## Settings

Settings for known contract factories and their variable.

### Staking Contract

| Variable Name        | Value    |
| -------------------- | -------- |
| PERIOD_LIMIT         | 17       |
| VESTING_DELAY        | 1        |
| LOCKUP_DELAY         | 1        |
| PERIOD_SECONDS       | 2630000  |
| MESSENGER_ID         | 73060985 |
| DISTRIBUTION_COUNT   | 0        |
| DISTRIBUTION_SECONDS | 2630000  |

#### Deploy staking factor contract

```
scs-cli deploy --period-seconds 2630000 --period-limit 17 --vesting-delay 1 --lockup-delay 1 --messenger-id 73060985 --distribution-count 0 --distribution-seconds 2630000 --type staking-factory  --name staking --debug
```

#### Deploy staking contract 

```
scs-cli factory deploy-staking --apid 87502365 --amount 1 --period 0 --debug
```


**Notes**

```

owner, funder, delegate, and period are parameters specified by deployer. 

The deployer is not the funder. The deployer is likely the owner. The funder is the address that will fund the contract.
The delegate is the address that will operate the contract participation.

period is a parameter specified by deployer that determines lockup period

PERIOD_SECONDS = 2628288 = 30.5 days

DISTRIBUTION_COUNT is variable dependent on period

period must be greater than 0
```