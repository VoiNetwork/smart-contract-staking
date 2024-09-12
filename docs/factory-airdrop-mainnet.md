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

### Mainnet

**Configuration**

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

**Command**

Deploy airdrop contract with configuration

```
scs-cli deploy --period-seconds 2628288 --period-limit 5 --vesting-delay 1 --lockup-delay 12 --messenger-id 73060985 --distribution-count 12 --distribution-seconds 2628288 --type airdrop-factory --name airdrop 
```