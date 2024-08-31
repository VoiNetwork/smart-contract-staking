#!/bin/bash
scs-build-image() {
  docker build . -t algokit-builder
}
scs-build-artifacts() {
  docker run -v $(pwd):/src -v $(pwd)/artifacts:/artifacts algokit-builder && 
  cp -v artifacts/AirdropClient.ts ./src/scripts/ && 
  cp -v artifacts/AirdropFactoryClient.ts ./src/scripts/ && 
  cp -v artifacts/StakingFactoryClient.ts ./src/scripts/ && 
  cp -v artifacts/CompensationFactoryClient.ts ./src/scripts/ && 
  cp -v artifacts/MessengerClient.ts ./src/scripts/
}
scs-build-all() {
  scs-build-image && scs-build-artifacts
}
scs-simulate() {
  (
    cd src
    python simulate.py
  )
}
scs-cli() {
  (
    cd src/scripts
    source tests/utils.sh
    npx tsc
    cli ${@}
  )
}
scs-check-mab() {
  (
    bash check_mab.sh
  )
}
scs-pytest() {
  (
    cd src
    pytest
  )
}
scs-test() {
  (
    cd src/scripts
    case ${1} in
      "airdrop") {
        bash tests/test-contract-${1}.sh
      } ;;
      "staking") {
        bash tests/test-contract-${1}.sh
      } ;;
      "compensation") {
        bash tests/test-contract-${1}.sh
      } ;;
      *) {
        echo "test not found"
        false
      } ;;
    esac
  )
}