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
main() {
  local -i app_id
  local -i mb
  local config_distribution_count
  local config_lockup_delay
  local config_name
  local config_seconds
  local config_type
  local fapid
  local mfapid
  local period
  local word
  config_type=airdrop-factory
  config_name=airdrop-demo
  config_seconds=1
  config_lockup_delay=12
  config_distribution_count=12
  mfapid=$( cli deploy --period-seconds ${config_seconds} --period-limit 5 --vesting-delay 0 --lockup-delay ${config_lockup_delay} --messenger-id 73060985 --distribution-count ${config_distribution_count} --distribution-seconds ${config_seconds} --type ${config_type} --name ${config_name} )
  for word in $mfapid; do
   fapid="${word}"
  done
  echo ===========================================
  echo AIR DROP DEMO
  echo ===========================================
  cat << EOF
config_type: ${config_type}
config_name: ${config_name}
config_seconds: ${config_seconds}
config_lockup_delay: ${config_lockup_delay}
config_distribution_count: ${config_distribution_count}
factory apid: ${fapid}
===========================================
EOF
  sleep 1
  test ! ${fapid} -le 0 || {
    echo "failed to deploy airdrop factory"
    exit 1
  }
  for period in $( seq 0 5 )
  do
    echo "period:${period}"
    app_id=$( cli factory deploy-airdrop --apid ${fapid} --initial 1 )
    test ! ${app_id} -eq 0 || {
      echo "failed to deploy app"
      exit 1
    }
    echo "app_id:${app_id}"
    echo [${app_id}] configuring app...
    cli airdrop configure --apid ${app_id} --period ${period} 
    echo [${app_id}] funding app...
    cli airdrop fill --apid ${app_id} --amount 1 --timestamp $( date +%s )
    sleep 4
    let -i start=$( date +%s )
    while :
    do
      mb=$( cli airdrop get-mb --apid ${app_id} )
      echo $( date ) ${mb}
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
    cli airdrop close --apid ${app_id} 
    echo "==========================================="
  done
  echo cleaning up...
  sleep 10
  cli factory update-airdrop --apid ${fapid} --delete
  echo "==========================================="
}
main
##################################################