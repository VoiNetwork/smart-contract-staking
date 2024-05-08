# Smart Contract Staking

Implementation of smart contract for staking solution described in document [Smart Contract Staking - Voi Foundation - 20231218](https://docs.google.com/document/d/17-Hvqp7ZndS0G2CrJEui_hFIHZksBALYNU7CqKvnyxM/edit#heading=h.rhnx1imq9wmf).

## requirements

- algokit >= version 2.0.3
- python >= 3.12.3
- node >= v20.12.2

## commands

### build all using algokit
```shell
algokit compile py contract.py
algokit generate client SmartContractStaking.arc32.json --language typescript --output SmartContractStakingClient.ts
algokit generate client SmartContractStaking.arc32.json --language python --output SmartContractStakingClient.py
```

### build all using docker

```shell
docker build . -t algokit-builder
```
 
```shell
docker run -v $(pwd):/src -v $(pwd)/artifacts:/artifacts algokit-builder
```

### simulate

Generate plot and csv file for all lockup period options

![328694992-ce990421-eda1-4d85-8dd4-3202ab5d50c6](https://github.com/NautilusOSS/smart-contract-staking/assets/23183451/6c6cb3fe-ca44-41e5-882c-522e756ff065)

```
python simulate.py
```
