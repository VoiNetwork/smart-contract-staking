import axios from "axios"
import fs from "fs"
import { parse } from "json2csv";

const getAccounts = async () => {
  return (await axios.get("https://mainnet-idx.nautilus.sh/v1/scs/accounts?parentId=5211"))?.data?.accounts || []
}

const accounts = await getAccounts()

const testnetList = []
for(const account of accounts) {
  const { global_parent_id: parentId, contractId, global_owner, global_initial, global_total } = account
  if(global_initial === global_total) {
    console.log(parentId, contractId, global_owner, global_initial, global_total)
    testnetList.push({ parentId, contractId, global_owner, global_initial, global_total })
  }
}
fs.writeFileSync(
  "testnet.json",
  JSON.stringify(testnetList, null, 2)
);
// Convert JSON to CSV
try {
  const csv = parse(testnetList);
  // Write the CSV to a file
  fs.writeFileSync(`testnet.json.csv`, csv);
  console.log("CSV file successfully written!");
} catch (err) {
  console.error(err);
}

