FROM node:20.12.2-bookworm@sha256:3864be2201676a715cf240cfc17aec1d62459f92a7cbe7d32d1675e226e736c9 AS node

FROM python:3.12.3-bookworm@sha256:feb165fc7a6faf49f1b6ab2571891e8c6f259b40a2325f38875bc928519ab911 AS python

COPY --from=node /usr/local /usr/local

COPY /src /src
COPY Pipfile /
COPY Pipfile.lock /
COPY pytest.ini /

WORKDIR /

RUN apt-get update && apt-get install -y jq

# Using --deploy --ignore-pipfile to ensure that lockfile dependencies matches declared dependencies. Install only from lockfile.
RUN python3 -m pip install --user pipenv && \
    /root/.local/bin/pipenv install --deploy --ignore-pipfile --system

# uses latest version of puyapy
CMD generate_clients() { \
    for artifact in Base Airdrop StakeReward BaseFactory AirdropFactory StakeRewardFactory Messenger EarlyStakeReward EarlyStakeRewardFactory; do \
        /root/.local/bin/pipenv run algokit generate client /artifacts/${artifact}.arc32.json --language typescript --output /artifacts/${artifact}Client.ts && \
        /root/.local/bin/pipenv run algokit generate client /artifacts/${artifact}.arc32.json --language python --output /artifacts/${artifact}Client.py && \
        jq '.contract' /artifacts/${artifact}.arc32.json > /artifacts/${artifact,,}.contract.json; \
    done; \
}; \
/root/.local/bin/pipenv run algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=5 \
    --template-var VESTING_DELAY=12 \
    --template-var LOCKUP_DELAY=12 \
    --template-var PERIOD_SECONDS=3600 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=12 \
    --template-var DISTRIBUTION_SECONDS=3600 \
    --out-dir /artifacts \
    /src/contract.py && \
generate_clients && \
/root/.local/bin/pipenv run algokit compile py \
    --output-bytecode \
    --template-var PERIOD_LIMIT=18 \
    --template-var VESTING_DELAY=12 \
    --template-var LOCKUP_DELAY=1 \
    --template-var PERIOD_SECONDS=5 \
    --template-var MESSENGER_ID=73060985 \
    --template-var DISTRIBUTION_COUNT=12 \
    --template-var DISTRIBUTION_SECONDS=5 \
    --out-dir /artifacts \
    /src/contract.py && \
generate_clients