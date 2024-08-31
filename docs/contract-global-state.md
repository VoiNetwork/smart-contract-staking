# Contract Global State

There are 2 main contracts in the staking solution: `Airdrop` and `Factory`. The global state of these contracts is described below.

## Airdrop

| Key                 | Type  |
|---------------------|-------|
| contract_version    | uint  |
| deadline            | uint  |
| delegate            | address |
| deployer            | address |
| deployment_version  | uint  |
| distribution_count  | uint  |
| distribution_seconds| uint  |
| funder              | address |
| funding             | uint  |
| initial             | uint  |
| lockup_delay        | uint  |
| messenger_id        | uint  |
| owner               | address |
| parent_id           | uint  |
| period              | uint  |
| period_limit        | uint  |
| period_seconds      | uint  |
| stakeable           | uint  |
| total               | uint  |
| updatable           | uint  |
| vesting_delay       | uint  |

## Factory

| Key                | Type  |
|--------------------|-------|
| contract_version   | uint  |
| deployment_version | uint  |
| updatable          | uint  |
