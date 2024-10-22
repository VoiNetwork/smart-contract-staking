import { Command } from "commander";
import fs from "fs";
import csv from "csv-parser";
import algosdk from "algosdk";
import * as crypto from "crypto";
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
dotenv.config({ path: "../.env" });

const makeSpec = (methods: any) => {
  return {
    name: "",
    desc: "",
    methods,
    events: [],
  };
};

function generateSHA256Hash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      const fileHash = hash.digest("hex");
      resolve(fileHash);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

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
        ALGO_SERVER: "https://mainnet-api.voi.nodely.dev",
        ALGO_INDEXER_SERVER: "https://mainnet-idx.voi.nodely.dev",
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
        ARC72_INDEXER_SERVER: "https://arc72-idx.nautilus.sh",
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

const writeOutputToFile = (output: any, filePath: string) => {
  const outputMessage = `[${new Date().toISOString()}] ${output}\n`;
  fs.appendFileSync(filePath, outputMessage, "utf8");
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

program.command("check-hash").action(async () => {
  generateSHA256Hash("data/airdrop-itnp2.csv")
    .then((hash) => {
      console.log(`File hash: ${hash}`);
    })
    .catch((err) => {
      console.error(`Error generating hash: ${err}`);
    });
});

program
  .command("process-csv")
  .description("Process a CSV file and create airdrop contracts")
  .option("-f, --file <path>", "Path to the CSV file", "data/airdrop-itnp2.csv")
  .option(
    "-l, --output-log <path>",
    "Path to the out log file",
    "tmp/output.log"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--funder <address>", "Funder's address", "")
  .option("--deadline <timestamp>", "Deadline as a Unix timestamp", "")
  .option("--verbose", "Verbose output", false)
  .option("--dryrun", "Dry run", false)
  .action(async (options) => {
    console.log("Processing CSV file for Testnet Phase II Airdrop...");
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER, ARC72_INDEXER_SERVER } = networks(
      parentOptions.network
    );

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

    const { MN, CTC_INFO_FACTORY_AIRDROP } = process.env;
    const mnemonic = MN || "";
    const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);

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
          parentId: CTC_INFO_FACTORY_AIRDROP,
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

    const signSendAndConfirm = async (
      txns: string[],
      sk: any,
      confirm = true
    ) => {
      const stxns = txns
        .map((t) => new Uint8Array(Buffer.from(t, "base64")))
        .map(algosdk.decodeUnsignedTransaction)
        .map((t) => algosdk.signTransaction(t, sk));
      if (confirm) {
        await algodClient.sendRawTransaction(stxns.map((txn) => txn.blob)).do();
        return Promise.all(
          stxns.map((res) =>
            algosdk.waitForConfirmation(algodClient, res.txID, 4)
          )
        );
      } else {
        await algodClient.sendRawTransaction(stxns.map((txn) => txn.blob)).do();
      }
    };

    const results: any[] = [];

    fs.createReadStream(options.file)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        console.log("CSV file successfully processed");
        console.log("Deploying contracts ...");
        const funder = options.funder || addr; // funder is provided or defaults to deployer
        console.log(`Funder: "${funder}"`);
        if (options.dryrun) {
          console.log("=== DRY RUN ===");
        }
        for (const row of results) {
          const initial = BigInt(
            new BigNumber(row.MainnetP0)
              .multipliedBy(new BigNumber(10).pow(6))
              .toFixed(0)
          ).toString();
          const account = accounts.find(
            (d: any) =>
              d.global_owner === row.Address && d.global_initial === initial
          );
          if (account) {
            const msg = `FOUND ${row.Address} ${row.MainnetP0} ${account.contractId}`;
            if (options.verbose) {
              console.log(msg);
            }
            writeOutputToFile(msg, options.outputLog);
            continue;
          }
          const { MainnetP0, Address } = row;
          const ctcInfo = Number(CTC_INFO_FACTORY_AIRDROP);
          const ci = new CONTRACT(
            ctcInfo,
            algodClient,
            indexerClient,
            {
              name: "",
              desc: "",
              methods: AirdropFactorySpec.contract.methods,
              events: [],
            },
            {
              addr: funder,
              sk: new Uint8Array(0),
            }
          );
          const paymentAmount = 1234500 + 100000; // min payment (1234500)
          const owner = Address;
          const deadline = options.deadline
            ? Number(options.deadline) // use provided timestamp
            : moment().unix() + 60 * 60 * 24 * 7; // default to now + 7 days
          ci.setPaymentAmount(paymentAmount);
          ci.setFee(10000);
          const createR = await ci.create(
            owner,
            funder,
            deadline,
            Number(initial)
          );
          if (createR.success) {
            if (!options.dryrun) {
              //const [, appCallTxn] =
              await signSendAndConfirm(createR.txns, sk, false);
              //const appId = appCallTxn["inner-txns"][0]["application-index"];
            }
            const msg = !options.dryrun
              ? `SUCCESS ${MainnetP0} ${Address}`
              : `SUCCESS ${MainnetP0} ${Address} DRYRUN`;
            if (options.verbose) {
              console.log(msg);
            }
            writeOutputToFile(msg, options.outputLog);
          } else {
            const msg = `FAILURE ${MainnetP0} ${Address} ${createR.error}`;
            if (options.verbose) {
              console.log(msg);
            }
            writeErrorToFile(msg, options.errorLog);
          }
        }
      })
      .on("error", (e) => {
        writeErrorToFile(e, options.errorLog);
      });
  });

program
  .command("check-kill")
  .description("Check that all are set up")
  .option(
    "-f, --file <path>",
    "Path to the CSV file",
    "data/airdrop-itnp2c.csv"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option(
    "-o, --output <path>",
    "Path to the output file",
    "tmp/airdrop-itnp2-kill-payload.json"
  )
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ARC72_INDEXER_SERVER } = networks(parentOptions.network);
    const { CTC_INFO_FACTORY_AIRDROP } = process.env;
    const {
      data: { accounts },
    } = await axios.get(`${ARC72_INDEXER_SERVER}/v1/scs/accounts`, {
      params: {
        parentId: CTC_INFO_FACTORY_AIRDROP,
      },
    });
    const phase2Accounts = new Set(
      accounts
        .filter((d: any) => d.global_initial === "0")
        .map((d: any) => d.contractId)
        .map(Number)
    );
    console.log(`FOUND ${phase2Accounts.size} ACCOUNTS`);
    fs.createReadStream(options.file)
      .pipe(csv())
      .on("data", (row) => {
        const { contractId } = row;
        if (phase2Accounts.has(Number(contractId))) {
          phase2Accounts.delete(Number(contractId));
        }
      })
      .on("end", async () => {
        console.log("CSV file successfully processed");
        console.log(phase2Accounts.size);
        const killAccounts = [];
        for (const contractId of phase2Accounts) {
          const account = accounts.find(
            (d: any) => Number(d.contractId) === contractId
          );
          killAccounts.push(account);
        }
        fs.writeFileSync(options.output, JSON.stringify(killAccounts, null, 2));
      });
  });

program
  .command("kill")
  .description("Kill the contracts")
  .option(
    "-f, --file <path>",
    "Path to the CSV file",
    "tmp/airdrop-itnp2-kill-payload.json"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--dryrun", "No dry run", false)
  .option("--update", "Update the contract", false)
  .option("--delete", "Delete the contract", false)
  .option("--debug", "Debug the deployment", false)
  .option("--sender", "Sender's address")
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER } = networks(
      parentOptions.network
    );

    const { MN } = process.env;

    const mnemonic = MN || "";
    const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);

    const dryrun = options.dryrun;
    const infile = options.file;
    const sender = options.sender || addr;
    const update = options.update;

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

    const makeCi = (ctcInfo: number, addr: string) => {
      return new CONTRACT(
        ctcInfo,
        algodClient,
        indexerClient,
        makeSpec(AirdropSpec.contract.methods),
        {
          addr: sender,
          sk: new Uint8Array(0),
        }
      );
    };

    const signSendAndConfirm = async (txns: string[], sk: any) => {
      const stxns = txns
        .map((t) => new Uint8Array(Buffer.from(t, "base64")))
        .map(algosdk.decodeUnsignedTransaction)
        .map((t: any) => algosdk.signTransaction(t, sk));
      await algodClient
        .sendRawTransaction(stxns.map((txn: any) => txn.blob))
        .do();
      return await Promise.all(
        stxns.map((res: any) =>
          algosdk.waitForConfirmation(algodClient, res.txID, 4)
        )
      );
    };

    const contracts = JSON.parse(fs.readFileSync(infile, "utf8"));
    if (dryrun) {
      console.log("=== DRY RUN ===");
    }

    for (const row of contracts) {
      try {
        const ctcInfo = Number(row.contractId);

        console.log(`KILLING ${ctcInfo}`);

        // get app info using algod

        const appInfo = await indexerClient.lookupApplications(ctcInfo).do();

        if (!appInfo.application) {
          console.log(`MISSING ${ctcInfo}`);
          continue;
        }

        if (update) {
          await new AirdropClient(
            {
              resolveBy: "id",
              id: ctcInfo,
              sender: {
                addr: sender,
                sk,
              },
            },
            algodClient
          ).appClient.update();
        }

        const ci = makeCi(ctcInfo, sender);
        ci.setFee(3000);
        if (options.delete) {
          ci.setOnComplete(5); // deleteApplicationOC
        }
        const killR = await ci.kill();
        if (options.debug) {
          console.log(killR);
        }
        if (killR.success) {
          if (!dryrun) {
            //await signSendAndConfirm(killR.txns, sk);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }
  });

program
  .command("check")
  .description("Check that all are set up")
  .option(
    "-f, --file <path>",
    "Path to the CSV file",
    "data/airdrop-itnp2c.csv"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option(
    "-o, --output <path>",
    "Path to the output file",
    "tmp/airdrop-itnp2-payload.json"
  )
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ARC72_INDEXER_SERVER } = networks(parentOptions.network);
    const { CTC_INFO_FACTORY_AIRDROP } = process.env;
    const {
      data: { accounts },
    } = await axios.get(`${ARC72_INDEXER_SERVER}/v1/scs/accounts`, {
      params: {
        parentId: CTC_INFO_FACTORY_AIRDROP,
      },
    });
    console.log(`ACCOUNTS ${accounts.length}`);
    const results: any[] = [];
    fs.createReadStream(options.file)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", async () => {
        console.log("CSV file successfully processed");
        let sum = 0;
        const periodCounts = [0, 0, 0, 0, 0, 0];
        const periodTotals = [0, 0, 0, 0, 0, 0];
        const contracts = [];
        for (const row of results) {
          const initial = BigInt(
            new BigNumber(row.estimatedRewards)
              .multipliedBy(new BigNumber(10).pow(6))
              .toFixed(0)
          ).toString();
          console.log(`FOUND ${row.global_owner} ${row.estimatedRewards}`);
          const contractId = row.contractId;
          const period = Number(row.global_period || 0);
          periodCounts[period] += 1;
          const total = computeCompoundedInterest(
            row.estimatedRewards,
            lookupRate(period),
            period
          ).toFixed(6);
          periodTotals[period] += Number(total);
          sum += Number(total);
          const payload = {
            ...row,
            initial,
            contractId,
            period,
            total,
          };
          contracts.push(payload);
        }
        console.log(`MISSING ${results.length - contracts.length} CONTRACTS`);
        console.log(`FOUND ${contracts.length} CONTRACTS`);
        console.log(`TOTAL ${Number(sum).toLocaleString()}`);
        for (let i = 0; i < periodCounts.length; i++) {
          console.log(
            `PERIOD ${i} : ${periodCounts[i]} : ${periodTotals[i]} : AVG ${
              periodCounts[i] > 0 ? periodTotals[i] / periodCounts[i] : 0
            }`
          );
        }
        fs.writeFileSync(options.output, JSON.stringify(contracts, null, 2));
      });
  });

program
  .command("fill")
  .description("Fill the contracts")
  .requiredOption("--funding <number>", "Funding timestamp")
  .option(
    "-f, --file <path>",
    "Path to the JSON file",
    "tmp/airdrop-itnp2-payload.json"
  )
  .option(
    "-e, --error-log <path>",
    "Path to the error log file",
    "tmp/error.log"
  )
  .option("--funder <address>", "Funder's address")
  .option("--dryrun", "No dry run", false)
  .action(async (options) => {
    const parentOptions = program.opts();
    const { ALGO_SERVER, ALGO_INDEXER_SERVER } = networks(
      parentOptions.network
    );
    const dryrun = options.dryrun;
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
      if (globalFunder !== (options.funder || addr)) {
        console.log(
          `FUNDER MISMATCH ${ctcInfo} ${row.Address} ${globalFunder}`
        );
        continue;
      }

      if (globalFunding !== 0) {
        console.log(
          `ALREADY FUNDED ${ctcInfo} ${row.Address} ${globalTotal} ${globalTotal}`
        );
        continue;
      }

      const address = options.funder || addr;

      const accInfo = await algodClient.accountInformation(address).do();
      const amount = accInfo.amount;
      const minBalance = accInfo["min-balance"];
      const availableBalance = Math.max(amount - minBalance - 2000, 0);

      const fillAmount = BigInt(
        new BigNumber(row.total).multipliedBy(1e6).toFixed(0)
      );

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
        payment: BigInt(new BigNumber(row.total).multipliedBy(1e6).toFixed(0)),
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
          `SUCCESS ${ctcInfo} ${row.global_owner} ${row.period} ${row.total}`
        );
      } else {
        console.log(
          `FAILURE ${ctcInfo} ${row.global_owner} ${row.period} ${row.total}`
        );
      }
    }
  });

program.parse(process.argv);
