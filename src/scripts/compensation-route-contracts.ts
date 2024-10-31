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
