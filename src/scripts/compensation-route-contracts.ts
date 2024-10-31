import algosdk from "algosdk";
import fs from "fs";

import {
  AirdropClient,
  APP_SPEC as AirdropSpec,
} from "./clients/AirdropClient.js";
import axios from "axios";
import { parse } from "json2csv";

const ALGO_SERVER = "https://mainnet-api.voi.nodely.dev";
const ALGO_INDEXER_SERVER = "https://mainnet-idx.voi.nodely.dev";
const ARC72_INDEXER_SERVER = "https://mainnet-idx.nautilus.sh";

const algodServerURL = process.env.ALGOD_SERVER || ALGO_SERVER;
const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN || "",
  algodServerURL,
  process.env.ALGOD_PORT || ""
);

const indexerServerURL = process.env.INDEXER_SERVER || ALGO_INDEXER_SERVER;
const indexerClient = new algosdk.Indexer(
  process.env.INDEXER_TOKEN || "",
  indexerServerURL,
  process.env.INDEXER_PORT || ""
);

interface GetContractParams {
  parentId?: number;
  contractId?: number;
  contractAddress?: string;
  owner?: string;
}
const getAccounts = async (params: GetContractParams) => {
  return (
    (
      await axios.get(`https://mainnet-idx.nautilus.sh/v1/scs/accounts`, {
        params,
      })
    )?.data?.accounts || []
  );
};

const infile = "program/tmp/compensation-kill.json";
const contracts = JSON.parse(fs.readFileSync(infile, "utf8"));

const actions = [];
for (const row of contracts) {
  const { parent_id: parentId, contract_id2: contractId, owner2: owner } = row;
  if (!parentId || !contractId || !owner) continue;
  console.log(parentId, contractId, owner);
  const accounts = await getAccounts({
    parentId,
    owner,
  });
  if (accounts.length === 0) {
    const action = {
      ...row,
      type: "create",
    };
    console.log(action);
    actions.push(action);
  } else {
    const action = {
      ...row,
      type: "fill",
    };
    console.log(action);
    actions.push(action);
  }
}
fs.writeFileSync("actions.json", JSON.stringify(actions, null, 2));
// Convert JSON to CSV
try {
  const csv = parse(actions);
  // Write the CSV to a file
  fs.writeFileSync(`actions.json.csv`, csv);
  console.log("CSV file successfully written!");
} catch (err) {
  console.error(err);
}

process.exit(0);

// const compensationList = [];
// for (const contract of contracts) {
//   try {
//     const { global_owner, contractId, global_parent_id, global_total } =
//       contract;
//     const { account } = await indexerClient
//       .lookupAccountByID(global_owner)
//       .do();
//     const { ["sig-type"]: sigType } = account;
//     if (!sigType) {
//       const accounts = await getAccounts({
//         contractAddress: global_owner,
//       });
//       if (accounts.length === 1) {
//         const [account] = accounts;
//         console.log(
//           global_parent_id,
//           contractId,
//           global_owner,
//           global_total,
//           account.global_parent_id,
//           account.contractId,
//           account.global_owner
//         );
//         compensationList.push({
//           parent_id: global_parent_id,
//           contract_id: contractId,
//           owner: global_owner,
//           global_total,
//           parent_id2: account.global_parent_id,
//           contract_id2: account.contractId,
//           owner2: account.global_owner,
//         });
//       } else {
//         console.log(global_parent_id, contractId, global_owner, global_total);
//         compensationList.push({
//           parent_id: global_parent_id,
//           contract_id: contractId,
//           owner: global_owner,
//           global_total,
//         });
//       }
//     }
//   } catch (e) {
//     console.error(e);
//   }
// }
// fs.writeFileSync(
//   "compensation.json",
//   JSON.stringify(compensationList, null, 2)
// );
// // Convert JSON to CSV
// try {
//   const csv = parse(compensationList);
//   // Write the CSV to a file
//   fs.writeFileSync(`compensation.json.csv`, csv);
//   console.log("CSV file successfully written!");
// } catch (err) {
//   console.error(err);
// }
