#!/usr/bin/env bash
scs-cli() {
  echo ${1}
  case ${1} in 
    airdrop|airdrop2|staking|compensation) {
      echo ${@}
      cp -v .env ./program
      cd program
      node ${1}.js ${@:2}
    }
      ;;
    main)
      node main.js ${@:2}
      ;;
    *)
      echo "Command not found"
      ;;
  esac
}
scs-cli ${@}
