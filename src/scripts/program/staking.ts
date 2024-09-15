import { Command } from "commander";
import fs from "fs";
import csv from "csv-parser";
import algosdk from "algosdk";
import { APP_SPEC as AirdropFactorySpec } from "../clients/AirdropFactoryClient.js";
import { APP_SPEC as AirdropSpec } from "../clients/AirdropClient.js";
import * as dotenv from "dotenv";
import { CONTRACT, abi } from "ulujs";
import moment from "moment";
import BigNumber from "bignumber.js";
import axios from "axios";
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

const lookupRate = (period: number) => {
  switch (period) {
    case 1:
      return "0.10";
    case 2:
      return "0.12";
    case 3:
      return "0.15";
    case 4:
      return "0.18";
    case 5:
      return "0.20";
    default:
      return "0.00";
  }
};

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

const computeCompoundedInterest = (
  principal: string,
  rate: string,
  periods: number
) => {
  const p = new BigNumber(principal);
  const r = new BigNumber(rate);
  const n = new BigNumber(periods);
  return p.times(r.plus(1).pow(n));
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
  .command("check")
  .description("Check that all are set up")
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option(
    "-o, --output <path>",
    "Path to the output file",
    "tmp/staking-payload.json"
  )
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ARC72_INDEXER_SERVER } = networks(parentOptions.network);
    const { CTC_INFO_FACTORY_STAKING } = process.env;
    const {
      data: { accounts },
    } = await axios.get(`${ARC72_INDEXER_SERVER}/v1/scs/accounts`, {
      params: {
        parentId: CTC_INFO_FACTORY_STAKING,
      },
    });
    console.log(`FOUND ${accounts.length} ACCOUNTS`);
  });

program
  .command("fill")
  .description("Fill the contracts")
  .requiredOption("--funding <number>", "Funding timestamp")
  .option(
    "-f, --file <path>",
    "Path to the JSON file",
    "tmp/airdrop-itnp1-payload.json"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--dryrun <boolean>", "No dry run")
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER } = networks(
      parentOptions.network
    );
    const dryrun = (options.dryrun ?? "true") === "true";
    const funding = Number(options.funding);
    const infile = options.file;

    const { MN } = process.env;
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

    const signSendAndConfirm = async (txns: string[], sk: any) => {
      const stxns = txns
        .map((t) => new Uint8Array(Buffer.from(t, "base64")))
        .map(algosdk.decodeUnsignedTransaction)
        .map((t) => algosdk.signTransaction(t, sk));
      await algodClient.sendRawTransaction(stxns.map((txn) => txn.blob)).do();
      return await Promise.all(
        stxns.map((res) =>
          algosdk.waitForConfirmation(algodClient, res.txID, 4)
        )
      );
    };
    const contracts = JSON.parse(fs.readFileSync(infile, "utf8"));

    if (dryrun) {
      console.log("=== DRY RUN ===");
    }

    for (const row of contracts) {
      const ctcInfo = Number(row.contractId);

      // get app info using algod

      const appInfo = await indexerClient.lookupApplications(ctcInfo).do();

      if (!appInfo.application) {
        console.log(`MISSING ${ctcInfo}`);
        continue;
      }

      const globalState = appInfo.application.params["global-state"];

      const globalFunding =
        globalState.find((d: any) => d.key === "ZnVuZGluZw==")?.value?.uint ||
        0;

      const globalTotal =
        globalState.find((d: any) => d.key === "dG90YWw=")?.value?.uint || 0;

      if (globalFunding !== 0) {
        console.log(
          `ALREADY FUNDED ${ctcInfo} ${row.Address} ${globalTotal} ${globalTotal}`
        );
        continue;
      }
      const ci = new CONTRACT(ctcInfo, algodClient, indexerClient, abi.custom, {
        addr,
        sk: new Uint8Array(0),
      });
      const builder = {
        staker: new CONTRACT(
          ctcInfo,
          algodClient,
          indexerClient,
          {
            name: "",
            desc: "",
            methods: AirdropSpec.contract.methods,
            events: [],
          },
          {
            addr,
            sk: new Uint8Array(0),
          },
          true,
          false,
          true
        ),
      };
      const buildN = [];
      buildN.push({
        ...(await builder.staker.fill())?.obj,
        payment:
          BigInt(new BigNumber(row.total).multipliedBy(1e6).toFixed(0)) /
          100000000n, // remove later
      });
      buildN.push({
        ...(await builder.staker.set_funding(funding))?.obj,
      });
      ci.setFee(1000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      const customR = await ci.custom();
      if (customR.success) {
        if (!dryrun) {
          //await signSendAndConfirm(customR.txns, sk);
        }
        console.log(
          `SUCCESS ${ctcInfo} ${row.Address} ${row.period} ${row.total}`
        );
      } else {
        console.log(
          `FAILURE ${ctcInfo} ${row.Address} ${row.period} ${row.total} ${customR.error}`
        );
      }
    }
  });

program.parse(process.argv);
