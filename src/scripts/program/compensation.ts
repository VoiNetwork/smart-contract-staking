import { Command } from "commander";
import fs from "fs";
import csv from "csv-parser";
import algosdk from "algosdk";
import { APP_SPEC as AirdropFactorySpec } from "../clients/AirdropFactoryClient.js";
import { APP_SPEC as CompensationFactorySpec } from "../clients/AirdropClient.js";
import {
  AirdropClient,
  APP_SPEC as AirdropSpec,
} from "../clients/AirdropClient.js";
import * as dotenv from "dotenv";
import { CONTRACT, abi } from "ulujs";
import moment from "moment";
import BigNumber from "bignumber.js";
import axios from "axios";
import { parse } from "json2csv";
import { deployCompensation } from "../command.js";
dotenv.config({ path: "../.env" });

// Usage: deploy-itnp1 [options] [command]
//
// Options:
//   -h, --help             display help for command
//
// Commands:
//   process-csv [options]  Process a CSV file and create airdrop contracts
//   check [options]        Check that all are set up
//   fill [options]         Fill the contracts
//   help [command]         display help for command
//
// deploy-itnp1 process-csv
// deploy-itnps check
// deploy-itnp1 fill --dryrun true --funding 1629788400
//

function computeLockupMultiplier(B2: number, R1: number) {
  if (B2 <= 12) {
    return 0.45 * Math.pow(B2 / R1, 2);
  } else {
    return Math.pow(B2 / R1, 2);
  }
}

function computeTimingMultiplier(week: number) {
  switch (week) {
    case 1:
      return 1;
    case 2:
      return 0.8;
    case 3:
      return 0.6;
    case 4:
      return 0.4;
    default:
      return 0;
  }
}

const networks = (networkName: string) => {
  switch (networkName) {
    case "voimain":
      return {
        ALGO_SERVER: "https://testnet-api.voi.nodly.io",
        ALGO_INDEXER_SERVER: "https://testnet-idx.voi.nodly.io",
        ARC72_INDEXER_SERVER: "https://mainnet-idx.nautilus.sh",
      };
    case "voitest":
      return {
        ALGO_SERVER: "https://testnet-api.voi.nodly.io",
        ALGO_INDEXER_SERVER: "https://testnet-idx.voi.nodly.io",
        ARC72_INDEXER_SERVER: "https://arc72-idx.nautilus.sh",
      };
    case "custom":
      return {
        ALGO_SERVER: process.env.ALGOD_SERVER || "",
        ALGO_INDEXER_SERVER: process.env.INDEXER_SERVER || "",
        ARC72_INDEXER_SERVER: process.env.ARC72_INDEXER_SERVER || "",
      };
    default:
      return {
        ALGO_SERVER: "https://testnet-api.voi.nodly.io",
        ALGO_INDEXER_SERVER: "https://testnet-idx.voi.nodly.io",
      };
  }
};

const writeErrorToFile = (error: any, filePath: string) => {
  const errorMessage = `[${new Date().toISOString()}] ${
    error.stack || error
  }\n`;
  fs.appendFileSync(filePath, errorMessage, "utf8");
};

const program = new Command();

program
  .option("-n, --network <name>", "Network name", "voitest")
  .command("help")
  .description("display help for command")
  .action((cmd) => {
    program.help();
  });

program
  .command("prepare")
  .description("Prepare to pay")
  .requiredOption("--funding <number>", "Funding timestamp")
  .option("-f, --file <path>", "Path to the CSV file", "data/compensation.csv")
  .option(
    "-g, --file2 <path>",
    "Path to the JSON file",
    "tmp/compensation.json"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--apid <number>", "Application ID")
  .option("--funder <address>", "Funder's address")
  .option("--debug", "Debug", false)
  .action(async (options) => {
    const results: any[] = [];
    fs.createReadStream(options.file)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        console.log("CSV file successfully processed");
        console.log(`TOTAL ${results.length}`);
        const payload = [];
        let sum = 0;
        for (const row of results) {
          const { Address, Amount } = row;
          sum += Number(Amount);
          if (options.debug) {
            console.log(Address, Amount, sum);
          }
          const job = {
            contractId: options.apid,
            funding: options.funding,
            address: Address,
            amount: Amount,
          };
          payload.push(job);
        }
        console.log(`TOTAL ${Number(sum).toLocaleString()}`);
        // Write the JSON to a file
        fs.writeFileSync(options.file2, JSON.stringify(payload, null, 2));
        // Convert JSON to CSV
        try {
          const csv = parse(payload);
          // Write the CSV to a file
          fs.writeFileSync(`${options.file2}.csv`, csv);
          console.log("CSV file successfully written!");
        } catch (err) {
          console.error(err);
        }
      });
  });

program
  .command("pay")
  .description("Pay the recipients")
  .requiredOption("--funding <number>", "Funding timestamp")
  .option("-f, --file <path>", "Path to the JSON file", "tmp/compensation.json")
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--funder <address>", "Funder's address")
  .option("--dryrun", "No dry run", false)
  .option("--debug", "Debug", false)
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER } = networks(
      parentOptions.network
    );

    const dryrun = options.dryrun;
    const infile = options.file;

    const { MN, CTC_INFO_FACTORY_COMPENSATION, ARC72_INDEXER_SERVER } =
      process.env;
    const mnemonic = MN || "";
    const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);

    const algodClient = new algosdk.Algodv2(
      process.env.ALGOD_TOKEN || "",
      process.env.ALGOD_SERVER || ALGO_SERVER,
      process.env.ALGOD_PORT || ""
    );

    const indexerClient = new algosdk.Indexer(
      process.env.INDEXER_TOKEN || "",
      process.env.INDEXER_SERVER || ALGO_INDEXER_SERVER,
      process.env.INDEXER_PORT || ""
    );

    const { ["last-round"]: lastRound } = await algodClient.status().do();

    console.log(`lastRound: ${lastRound}`);

    console.log("Requesting accounts and catching up...");

    let accounts: any[] = [];
    let currentRound = 0;
    do {
      const {
        data: { accounts: contractAcounts, ["current-round"]: round },
      } = await axios.get(`${ARC72_INDEXER_SERVER}/v1/scs/accounts`, {
        params: {
          parentId: CTC_INFO_FACTORY_COMPENSATION,
          funder: options.funder || addr,
        },
      });
      if (!round) {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        continue;
      }
      accounts = contractAcounts;
      currentRound = round;
      console.log(
        `currentRound: ${currentRound} roundsBehind: ${
          lastRound - currentRound
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    } while (currentRound <= lastRound);

    console.log("Accounts received ...");

    const contracts = JSON.parse(fs.readFileSync(infile, "utf8"));

    if (dryrun) {
      console.log("=== DRY RUN ===");
    }

    for (const row of contracts) {
      const { contractId: apid, funding, address: owner, amount } = row;

      const account = accounts.find((a) => a.global_owner === owner);

      if(!!account) {
        console.log("Already paid", owner);
        continue;
      }

      const amountBi = BigInt(new BigNumber(amount).times(1e6).toFixed());
      const mapid = await deployCompensation({
        apid: Number(apid),
        owner,
        amount: amountBi,
      });
      console.log("apid", mapid);
    }
  });

program.parse(process.argv);
