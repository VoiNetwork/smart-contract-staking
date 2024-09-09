# Factory Airdrop Testnet

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

### Configuration**

| Variable Name        | Value    |
| -------------------- | -------- |
| PERIOD_LIMIT         | 5        |
| VESTING_DELAY        | 1        |
| LOCKUP_DELAY         | 12       |
| PERIOD_SECONDS       | 10       |
| MESSENGER_ID         | 73060985 |
| DISTRIBUTION_COUNT   | 12       |
| DISTRIBUTION_SECONDS | 10       |

`10` is an arbitrary value for `PERIOD_SECONDS` and `DISTRIBUTION_SECONDS` for testing purposes.

## Commands

### Load commands

```
source commands.sh
```

### Get help

```
scs-cli --help
```

### Deploy airdrop factory contract with default configuration

```
scs-cli deploy --period-seconds 2628288 --period-limit 5 --vesting-delay 1 --lockup-delay 12 --period-seconds 1 --messenger-id 73060985 --distribution-count 12 --distribution-seconds 1 --type airdrop-factory --name "airdrop" 
```

### Deploy airdrop contract with default parameters

Deploy airdrop contract with factory configuration using defaults. Following command deploys airdrop contract with default owner and funder. The zero lockup airdrop amount is 1 token.

```
sci-cli factory --initial 1
```

### Deploy airdrop contract with specific parameters

```
factory deploy-airdrop --initial 1 --owner OWNER --funder FUNDER --deadline FUTURE_TIMESTAMP
```


### Test airdrop contract

Creates an airdrop contract for each configuration.

```
scs-test airdrop
```