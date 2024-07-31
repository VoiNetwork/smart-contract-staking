FROM node:20.12.2-bookworm@sha256:3864be2201676a715cf240cfc17aec1d62459f92a7cbe7d32d1675e226e736c9 as node

FROM python:3.12.3-bookworm@sha256:feb165fc7a6faf49f1b6ab2571891e8c6f259b40a2325f38875bc928519ab911 as python

COPY --from=node /usr/local /usr/local

WORKDIR /

RUN apt-get update && apt-get install -y jq
RUN python3 -m pip install --user pipx==1.5.0 && \
    python3 -m pipx ensurepath && \
    /root/.local/bin/pipx install algokit==2.0.3

CMD /root/.local/bin/algokit compile --version 2.1.2 py /src/contract.py --out-dir /artifacts && \
    /root/.local/bin/algokit generate client /artifacts/SmartContractStaking.arc32.json --language typescript --output /artifacts/SmartContractStakingClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/SmartContractStaking.arc32.json --language python --output /artifacts/SmartContractStakingClient.py && \
    jq '.contract' /artifacts/SmartContractStaking.arc32.json > /artifacts/contract.json && \
    /root/.local/bin/algokit generate client /artifacts/Messenger.arc32.json --language typescript --output /artifacts/MessengerClient.ts && \
    /root/.local/bin/algokit generate client /artifacts/Messenger.arc32.json --language python --output /artifacts/MessengerClient.py && \
    jq '.contract' /artifacts/Messenger.arc32.json > /artifacts/messenger.contract.json
