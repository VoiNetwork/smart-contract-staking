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
  cat <<EOF
##################################################
 COMPENSATION TEST
##################################################
EOF
}
main() {
  local app_id
  local mb
  local now
  local period
  show_banner
  for period in 0
  do
    app_id=$( cli factory deploy-compensation --amount 1 )
    echo "app_id:${app_id}"
    report_mb ${app_id}
    let -i start=$( date +%s )
    while :
    do
      report_mb ${app_id}
      test ! ${mb} -eq 0 || {
        true
        break
      }
      sleep 5
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