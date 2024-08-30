FROM node:20.12.2-bookworm@sha256:3864be2201676a715cf240cfc17aec1d62459f92a7cbe7d32d1675e226e736c9 as node

FROM python:3.12.3-bookworm@sha256:feb165fc7a6faf49f1b6ab2571891e8c6f259b40a2325f38875bc928519ab911 as python

COPY --from=node /usr/local /usr/local

WORKDIR /

RUN apt-get update && apt-get install -y jq
RUN python3 -m pip install --user pipx==1.5.0 && \
    python3 -m pipx ensurepath && \
    /root/.local/bin/pipx install algokit==2.3.0

# uses latest version of puyapy
CMD /root/.local/bin/algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=1 \
    --template-var VESTING_DELAY=1 \
    --template-var LOCKUP_DELAY=12 \
    --template-var PERIOD_SECONDS=1 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=1  \
    --template-var DISTRIBUTION_SECONDS=1 \
    --out-dir /artifacts \
    /src/contract.py && \
    /root/.local/bin/algokit generate client /artifacts/Messenger.arc32.json --language typescript --output /artifacts/MessengerClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/Messenger.arc32.json --language python --output /artifacts/MessengerClient.py && \
    jq '.contract' /artifacts/Messenger.arc32.json > /artifacts/messenger.contract.json && \
    /root/.local/bin/algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=5 \
    --template-var VESTING_DELAY=1 \
    --template-var LOCKUP_DELAY=12 \
    --template-var PERIOD_SECONDS=10 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=12  \
    --template-var DISTRIBUTION_SECONDS=10 \
    --out-dir /artifacts \
    /src/contract.py && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language typescript --output /artifacts/AirdropClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language python --output /artifacts/AirdropClient.py && \
    jq '.contract' /artifacts/Airdrop.arc32.json > /artifacts/airdrop.contract.json && \
    /root/.local/bin/algokit generate client /artifacts/AirdropFactory.arc32.json --language typescript --output /artifacts/AirdropFactoryClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/AirdropFactory.arc32.json --language python --output /artifacts/AirdropFactoryClient.py && \
    jq '.contract' /artifacts/AirdropFactory.arc32.json > /artifacts/factory.airdrop.contract.json && \
    /root/.local/bin/algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=17 \
    --template-var VESTING_DELAY=1 \
    --template-var LOCKUP_DELAY=1 \
    --template-var PERIOD_SECONDS=10 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=1  \
    --template-var DISTRIBUTION_SECONDS=10 \
    --out-dir /artifacts \
    /src/contract.py && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language typescript --output /artifacts/AirdropClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language python --output /artifacts/AirdropClient.py && \
    jq '.contract' /artifacts/Airdrop.arc32.json > /artifacts/airdrop.contract.json && \
    /root/.local/bin/algokit generate client /artifacts/StakingFactory.arc32.json --language typescript --output /artifacts/StakingFactoryClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/StakingFactory.arc32.json --language python --output /artifacts/StakingFactoryClient.py && \
    jq '.contract' /artifacts/StakingFactory.arc32.json > /artifacts/factory.staking.contract.json && \
    /root/.local/bin/algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=1 \
    --template-var VESTING_DELAY=1 \
    --template-var LOCKUP_DELAY=1 \
    --template-var PERIOD_SECONDS=10 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=12  \
    --template-var DISTRIBUTION_SECONDS=10 \
    --out-dir /artifacts \
    /src/contract.py && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language typescript --output /artifacts/AirdropClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/Airdrop.arc32.json --language python --output /artifacts/AirdropClient.py && \
    jq '.contract' /artifacts/Airdrop.arc32.json > /artifacts/airdrop.contract.json && \
    /root/.local/bin/algokit generate client /artifacts/CompensationFactory.arc32.json --language typescript --output /artifacts/CompensationFactoryClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/CompensationFactory.arc32.json --language python --output /artifacts/CompensationFactoryClient.py && \
    jq '.contract' /artifacts/CompensationFactory.arc32.json > /artifacts/factory.compensation.contract.json


