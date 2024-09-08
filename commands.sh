#!/bin/bash
scs-build-image() {
  docker build . -t algokit-builder
}
scs-build-artifacts() {
  docker run -v $(pwd):/src -v $(pwd)/artifacts:/artifacts algokit-builder && 
  cp -v artifacts/AirdropClient.ts ./src/scripts/clients/ && 
  cp -v artifacts/AirdropFactoryClient.ts ./src/scripts/clients/ && 
  cp -v artifacts/StakingFactoryClient.ts ./src/scripts/clients/ && 
  cp -v artifacts/CompensationFactoryClient.ts ./src/scripts/clients/ && 
  cp -v artifacts/MessengerClient.ts ./src/scripts/clients/
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
scs-mocha() {
  (
    set -e
    cd src/scripts
    npx tsc
    test ${#} -eq 0 && {
      npm test
      true
    } || {
      npm run test-${1}
    }
  )
}
scs-program() {
  (
    set -e
    cd src/scripts/program
    npx tsc 
    case ${1} in
      "airdrop") {
        node ${1}.js ${@:2}
      } ;;
      *) {
        cat << EOF
scs-program

  execute a program

  USAGE scs-program airdrop [command] [args]

EOF
        false
      } ;;
    esac
  )
}
