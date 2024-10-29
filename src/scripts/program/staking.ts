import { Command } from "commander";
import fs from "fs";
import csv from "csv-parser";
import algosdk from "algosdk";
import { APP_SPEC as AirdropFactorySpec } from "../clients/AirdropFactoryClient.js";
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

function computeLockupMultiplier(lockupPeriod: number, maxLockupPeriod: number) {
  if (lockupPeriod <= 12) {
    return 0.45 * Math.pow(lockupPeriod / maxLockupPeriod, 2);
  } else {
    return Math.pow(lockupPeriod / maxLockupPeriod, 2);
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

const periodLimit = 17;

const computeRate = (week: number) => (period: number) => {
  const lockupMultiplier = computeLockupMultiplier(period, periodLimit + 1);
  const timingMultiplier = computeTimingMultiplier(week);
  return lockupMultiplier * timingMultiplier;
};

function getWeeksFromTime(
  startTime: Date,
  currentUnixTime = moment().unix()
): number {
  const startUnixTime = moment(startTime).unix(); // Start time in Unix timestamp

  const secondsPerWeek = 60 * 60 * 24 * 7;

  const timeDifference = currentUnixTime - startUnixTime;
  const weeksPassed = Math.floor(timeDifference / secondsPerWeek);

  return weeksPassed;
}

const startTime = new Date("2024-09-30T00:00:00Z"); // start of week 1

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
  .option("--funding <number>", "Funding timestamp")
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ARC72_INDEXER_SERVER } = networks(parentOptions.network);
    const ctcInfoFactoryStaking = 400350;
    const {
      data: { accounts },
    } = await axios.get(`${ARC72_INDEXER_SERVER}/v1/scs/accounts`, {
      params: {
        parentId: ctcInfoFactoryStaking,
      },
    });
    console.log(`FOUND ${accounts.length} ACCOUNTS`);
    const payload = [];
    for (const account of accounts) {
      const { global_owner, global_deadline, global_total, global_period } =
        account;
      const period = global_period + 1;
      const week = getWeeksFromTime(startTime, global_deadline) + 1;
      const rate = computeRate(week);
      const bonus = rate(period);
      const total = Math.round(
        Number(global_total) + Number(global_total) * bonus
      );
      const initial = Number(global_total);
      console.log(
        `ACCOUNT ${global_owner} ${week} ${global_deadline} ${global_total} ${bonus} ${total}`
      );
      payload.push({
        contractId: account.contractId,
        contractAddress: account.contractAddress,
        creator: account.creator,
        global_funder: account.global_funder,
        global_funding: Number(options.funding),
        global_owner: account.global_owner,
        global_period: period,
        week,
        bonus_rate: bonus,
        bonus_amount: total - initial,
        global_initial: initial,
        global_total: total,
        initial: initial / 1e6,
        total: total / 1e6,
      });
    }
    fs.writeFileSync(options.output, JSON.stringify(payload, null, 2));
    // Convert JSON to CSV
    try {
      const csv = parse(payload);
      // Write the CSV to a file
      fs.writeFileSync(`${options.output}.csv`, csv);
      console.log("CSV file successfully written!");
    } catch (err) {
      console.error(err);
    }
  });

program
  .command("fill")
  .description("Fill the contracts")
  .option(
    "-f, --file <path>",
    "Path to the JSON file",
    "tmp/staking-payload.json"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--funder <address>", "Funder's address")
  .option("--debug", "Debug", false)
  .option("--nodryrun", "No dry run", false)
  .option("--noconfirm", "Do Confirmation", false)
  .option("--delay <number>", "Delay ms")
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER } = networks(
      parentOptions.network
    );
    const infile = options.file;
    const delay = Number(options.delay) || 0;
    const noconfirm = options.noconfirm;

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

    const signSendAndConfirm = async (
      txns: string[],
      sk: any,
      noconfirm: boolean
    ) => {
      const stxns = txns
        .map((t) => new Uint8Array(Buffer.from(t, "base64")))
        .map(algosdk.decodeUnsignedTransaction)
        .map((t) => algosdk.signTransaction(t, sk));
      await algodClient.sendRawTransaction(stxns.map((txn) => txn.blob)).do();
      if (noconfirm) {
        return await Promise.all(
          stxns.map((res) =>
            algosdk.waitForConfirmation(algodClient, res.txID, 4)
          )
        );
      }
    };
    const contracts = JSON.parse(fs.readFileSync(infile, "utf8"));

    if (!options.nodryrun) {
      console.log("=== DRY RUN ===");
    }

    for (const row of contracts) {
      const ctcInfo = Number(row.contractId);
      const funding = Number(row.global_funding);
      const bonusAmount = Number(row.bonus_amount);

      if (!ctcInfo) {
        console.log(`MISSING ${ctcInfo}`);
        continue;
      }

      if (!funding) {
        console.log(`MISSING ${funding}`);
        continue;
      }

      if (!bonusAmount) {
        console.log(`MISSING ${bonusAmount}`);
        continue;
      }

      // get app info using algod

      const appInfo = await indexerClient.lookupApplications(ctcInfo).do();

      if (!appInfo.application) {
        console.log(`MISSING ${ctcInfo}`);
        continue;
      }

      const client = new AirdropClient(
        {
          resolveBy: "id",
          id: ctcInfo,
          sender: {
            addr,
            sk,
          },
        },
        algodClient
      );

      const gstate = await client.getGlobalState();

      const globalFunding = gstate.funding?.asNumber() || 0;

      const globalTotal = gstate.total?.asNumber() || 0;

      const globalFunder = algosdk.encodeAddress(
        gstate.funder?.asByteArray() || new Uint8Array(0)
      );

      const address = options.funder || addr;

      if (globalFunder !== address) {
        console.log(`FUNDER MISMATCH ${ctcInfo} ${globalFunder} ${address}`);
        continue;
      }

      if (globalFunding !== 0) {
        console.log(`ALREADY FUNDED ${ctcInfo} ${globalTotal}`);
        continue;
      }

      const accInfo = await algodClient.accountInformation(address).do();
      const amount = accInfo.amount;
      const minBalance = accInfo["min-balance"];
      const availableBalance = Math.max(amount - minBalance - 2000, 0);

      const fillAmount = BigInt(bonusAmount);

      if (fillAmount > BigInt(availableBalance)) {
        console.log(
          `INSUFFICIENT BALANCE ${ctcInfo} ${address} ${row.period} ${row.total} ${fillAmount} ${availableBalance}`
        );
        continue;
      }

      const ci = new CONTRACT(ctcInfo, algodClient, indexerClient, abi.custom, {
        addr: options.funder || addr,
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
            addr: options.funder || addr,
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
        payment: fillAmount,
      });
      buildN.push({
        ...(await builder.staker.set_funding(funding))?.obj,
      });
      ci.setFee(1000);
      ci.setEnableGroupResourceSharing(true);
      ci.setExtraTxns(buildN);
      const customR = await ci.custom();
      if (customR.success) {
        if (options.nodryrun) {
          const res = await signSendAndConfirm(customR.txns, sk, noconfirm);
          if (options.debug) {
            console.log(res);
          }
        }
        console.log(
          `SUCCESS ${ctcInfo} ${row.week} ${row.bonus_rate} ${row.global_period} ${row.global_initial} ${row.global_total} ${bonusAmount}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.log(
          `FAILURE ${ctcInfo} ${row.week} ${row.bonus_rate} ${row.global_period} ${row.global_initial} ${row.global_total} ${bonusAmount}`
        );
      }
    }
  });

program.parse(process.argv);
