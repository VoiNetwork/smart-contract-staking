#!/usr/bin/env bash

generate_client_messenger() {
  generate_client 1 1 1 1 1 1 1 "Messenger"
}
generate_client_airdrop() {
  # airdrop
  # generate_client 5 1 12 1 73060985 12 1 "Airdrop"
  # staking
  # generate_client 17 1 1 1 73060985 1 1 "Airdrop"
  # compensation
  generate_client 1 1 1 1 73060985 12 1 "Airdrop"
}
generate_client_airdropfactory() {
  generate_client 5 1 12 1 73060985 12 1 "AirdropFactory"
}
generate_client_stakingfactory() {
  generate_client 17 1 1 1 73060985 1 1 "StakingFactory"
}
generate_client_compensation() {
  generate_client 1 1 1 1 73060985 12 1 "CompensationFactory"
}
generate_client() {
  local artifact="${8}"
  /root/.local/bin/pipenv run algokit compile py \
  --output-bytecode \
  --template-var PERIOD_LIMIT=${1} \
  --template-var VESTING_DELAY=${2} \
  --template-var LOCKUP_DELAY=${3} \
  --template-var PERIOD_SECONDS=${4} \
  --template-var MESSENGER_ID=${5} \
  --template-var DISTRIBUTION_COUNT=${6} \
  --template-var DISTRIBUTION_SECONDS=${7} \
  --out-dir /artifacts \
  /src/src/contract.py 
  /root/.local/bin/pipenv run algokit generate client "/artifacts/${artifact}.arc32.json" --language typescript --output "/artifacts/${artifact}Client.ts"
  jq '.contract' "/artifacts/${artifact}.arc32.json" > "/artifacts/${artifact,,}.contract.json"
}
generate_clients() {
    local artifacts=("Airdrop" "AirdropFactory" "StakingFactory" "CompensationFactory" "Messenger")
    for artifact in "${artifacts[@]}"; do
     ! declare -f generate_client_${artifact,,} > /dev/null || {
        generate_client_${artifact,,}
     }
    done 
}

generate_clients