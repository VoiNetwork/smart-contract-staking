# Smart Contract Staking

Implementation of smart contract for staking solution described in document [Smart Contract Staking - Voi Foundation - 20231218](https://docs.google.com/document/d/17-Hvqp7ZndS0G2CrJEui_hFIHZksBALYNU7CqKvnyxM/edit#heading=h.rhnx1imq9wmf).

## requirements

- algokit >= version 2.0.3
- python >= 3.12.3
- node >= v20.12.2
- puyapy >= 2.2.0

## commands

### build all using docker

```shell
docker build . -t algokit-builder
```
 
```shell
docker run -v $(pwd):/src -v $(pwd)/artifacts:/artifacts algokit-builder
```

### build and run script
```shell
(docker run -v $(pwd):/src -v $(pwd)/artifacts:/artifacts algokit-builder && cp -v artifacts/BaseClient.ts ./scripts/ && cp -v artifacts/AirdropClient.ts ./scripts/ && cp -v artifacts/StakeRewardClient.ts ./scripts/  && cp -v artifacts/EarlyStakeRewardClient.ts ./scripts/ && cp -v artifacts/BaseFactoryClient.ts ./scripts/ && cp -v artifacts/AirdropFactoryClient.ts ./scripts/ && cp -v artifacts/StakeRewardFactoryClient.ts ./scripts/ && cp -v artifacts/EarlyStakeRewardFactoryClient.ts ./scripts/ && cp -v artifacts/MessengerClient.ts ./scripts/)
```

```
(cd scripts && npx tsc && node deploy.js)
```

### unit test

```shell
pytest
```

### check mab

Run the following command to make sure the mab function in the contract matches the mab function in the simulateion python code.

```shell
bash check_mab.sh
```

### simulate

Generate plot and csv file for all lockup period options

![328694992-ce990421-eda1-4d85-8dd4-3202ab5d50c6](https://github.com/NautilusOSS/smart-contract-staking/assets/23183451/6c6cb3fe-ca44-41e5-882c-522e756ff065)

```
python simulate.py
```
