# Smart Contract Staking

Implementation of smart contract for staking solution described in document [Smart Contract Staking - Voi Foundation - 20231218](https://docs.google.com/document/d/17-Hvqp7ZndS0G2CrJEui_hFIHZksBALYNU7CqKvnyxM/edit#heading=h.rhnx1imq9wmf).

## requirements

- algokit >= version 2.0.3
- python >= 3.12.3
- node >= v20.12.2
- puyapy >= 2.2.0

## commands

Import the commands in the shell

```shell
source commands.sh
```

### build all using docker

Build docker image

```shell
scs-build-image
```
 
Build artifacts

```shell
scs-build-artifacts
```

Build all
  
```shell
scs-build-all
```

### unit test

```shell
scs-pytest
```

### check mab

Run the following command to make sure the mab function in the contract matches the mab function in the simulateion python code.

```shell
scs-check-mab
```

### simulate

Generate plot and csv file for all lockup period options

![328694992-ce990421-eda1-4d85-8dd4-3202ab5d50c6](https://github.com/NautilusOSS/smart-contract-staking/assets/23183451/6c6cb3fe-ca44-41e5-882c-522e756ff065)

```
scs-simulate
```

### GitHub Actions

To run the GitHub Action workflows locally use [act](https://github.com/nektos/act) to simulate the GitHub Actions environment.

```bash
act -s GITHUB_TOKEN="$(gh auth token)" --container-architecture linux/amd64
```