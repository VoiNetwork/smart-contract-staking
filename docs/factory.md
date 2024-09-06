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

### Airdrop Contract

| Variable Name        | Value    |
| -------------------- | -------- |
| PERIOD_LIMIT         | 5        |
| VESTING_DELAY        | 1        |
| LOCKUP_DELAY         | 12       |
| PERIOD_SECONDS       | 2628288  |
| MESSENGER_ID         | 73060985 |
| DISTRIBUTION_COUNT   | 12       |
| DISTRIBUTION_SECONDS | 2628288  |

owner, funder, deadline, and initial are parameters specified by deployer

PERIOD_SECONDS = 2628288 = 30.5 days

### Staking Contract

| Variable Name        | Value    |
| -------------------- | -------- |
| PERIOD_LIMIT         | 17       |
| VESTING_DELAY        | 1        |
| LOCKUP_DELAY         | 1        |
| PERIOD_SECONDS       | 2628288  |
| MESSENGER_ID         | 73060985 |
| DISTRIBUTION_COUNT   | 1        |
| DISTRIBUTION_SECONDS | 2628288  |

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

### Comp