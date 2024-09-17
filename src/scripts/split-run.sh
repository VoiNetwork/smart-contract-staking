# 1 - program (1 or 2)
# 2 - slice number
exit # experimental
test ${#} -eq 2 || {
  echo "invalid parmeters"
  exit 1
}
test ${2} -gt 0 || {
  echo "invalid slice number"
  exit 2
}
basefile=program/data/airdrop-itnp${1}.csv
test -f ${basefile} || {
  echo "invalid program"
  exit 3
}
case ${1} in
  1) program="airdrop" ;;
  2) program="airdrop2" ;;
  *) echo "invalid program" ; exit 4 ;;
esac
car() { echo "${1}" ; }
lines=$( car $( wc -l ${basefile} ) )
chunk_size=1000
chunks=$(( lines / chunk_size + 1 ))
echo lines: ${lines} chunk_size: ${chunk_size} chunks: ${chunks}
read -t 3 || true
heading() {
 cat << EOF
TestnetTotal,MainnetP0,Address
EOF
}
rm -f x*
split program/data/airdrop-itnp${1}.csv
sed -i "1d" xaa
for i in $( find . -maxdepth 1 -type f -name "x*" )
do
 cat <( heading ) ${i} > x_$( basename ${i} )
done
bash <( sed -n "${2}p" <( for i in x_*
do
 echo bash command.sh ${program} process-csv --file $( realpath ${i} ) --verbose
done ) )