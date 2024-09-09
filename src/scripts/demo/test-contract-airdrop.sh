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
main() {
  local -i mb
  local -i app_id
  for period in $( seq 0 5 )
  do
    echo "period:${period}"
    app_id=$( cli factory deploy-airdrop --initial 1 )
    test ! ${app_id} -eq 0 || {
      echo "failed to deploy app"
      exit 1
    }
    echo "app_id:${app_id}"
    report_mb ${app_id}
    echo [${app_id}] configuring app...
    cli airdrop configure -a ${app_id} -p ${period}
    echo [${app_id}] filling app...
    cli airdrop fill ${app_id}
    echo [${app_id}] setting funding for app...
    cli airdrop set-funding ${app_id} $( date +%s )
    let -i start=$( date +%s )
    while :
    do
      report_mb ${app_id}
      test ! ${mb} -eq 0 || {
        true
        break
      }
      sleep 0
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