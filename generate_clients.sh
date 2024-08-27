#!/usr/bin/env bash

generate_clients() {
    local artifacts=("Base" "Airdrop" "StakeReward" "BaseFactory" "AirdropFactory" "StakeRewardFactory" "Messenger" "EarlyStakeReward" "EarlyStakeRewardFactory")
    for artifact in "${artifacts[@]}"; do
        /root/.local/bin/pipenv run algokit generate client "/artifacts/${artifact}.arc32.json" --language typescript --output "/artifacts/${artifact}Client.ts"
        /root/.local/bin/pipenv run algokit generate client "/artifacts/${artifact}.arc32.json" --language python --output "/artifacts/${artifact}Client.py"
        jq '.contract' "/artifacts/${artifact}.arc32.json" > "/artifacts/${artifact,,}.contract.json"
    done
}

generate_clients