#!/bin/bash
##################################################
source ./$( dirname ${0} )/utils.sh
##################################################
# deploy airdrop contract via staking factory
# reduce total by half
# fund the contract
# participate
# shower rewards
# withdraw rewards
# wait for it
# close the contract
##################################################
report_mb() {
  mb=$( cli airdrop get-mb ${1} )
  echo $( date ) ${mb}
}
show_banner() {
  cat << EOF
##################################################
STAKING TEST
##################################################
EOF
}
main() {
  local app_id
  local mb
  local now
  local period
  show_banner
  for period in {0..17}
  do
    now=$( date +%s)
    echo "period:${period}"
<<<<<<< HEAD:src/scripts/tests/test-contract-staking.sh
    app_id=$( cli factory deploy-staking --amount 1 --period ${period} )
=======
    app_id=$( cli factory deploy-staking --amount 0.1 --period ${period} )
>>>>>>> c07a2d2 (add compensation and commands (#4)):scripts/tests/test-contract-staking.sh
    echo "app_id:${app_id}"
    report_mb ${app_id}
    cli airdrop fill ${app_id}
    cli airdrop set-funding ${app_id} ${now}
    let -i start=$( date +%s )
    while :
    do
      report_mb ${app_id}
      test ! ${mb} -eq 0 || {
        true
        break
      }
      sleep 1
    done
    let -i end=$( date +%s )
    let -i duration=${end}-${start}
    echo "duration:${duration}"
    echo "closing app ${app_id}..."
    cli airdrop close ${app_id}
  done
}
main
##################################################