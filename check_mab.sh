
diff \
  --suppress-common-lines \
  -y \
  <(cat src/contract_mab.py | sed -e "/^#.*/d" -e "1,5d" -e "s/ -> UInt64:/:/" -e "s/: UInt64//" -e "/@subroutine/d" -e "s/UInt64(0)/0/") \
  <(cat src/simulate_mab.py | sed -e "/#.*/d")
test ! ${?} -ne 0 || {
	echo "[!] contract and simulate mab functions do not match!"
	false
}

