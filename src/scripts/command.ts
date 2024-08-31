import { Command } from "commander";
import fs from "fs";
import axios from "axios";
import csv from "csv-parser";
import { AirdropClient, APP_SPEC as AirdropSpec } from "./AirdropClient.js";
import {
  CompensationFactory,
  CompensationFactoryClient,
  APP_SPEC as CompensationFactorySpec,
} from "./CompensationFactoryClient.js";
import {
  AirdropFactoryClient,
  APP_SPEC as AirdropFactorySpec,
} from "./AirdropFactoryClient.js";
import {
  StakingFactoryClient,
  APP_SPEC as StakingFactorySpec,
} from "./StakingFactoryClient.js";
import {
  MessengerClient,
  APP_SPEC as MessengerSpec,
} from "./MessengerClient.js";
import algosdk from "algosdk";
import { CONTRACT } from "ulujs";
import moment from "moment";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const program = new Command();

const {
  MN,
  MN2,
  MN3,
  CTC_INFO_FACTORY_AIRDROP,
  CTC_INFO_FACTORY_STAKING,
  CTC_INFO_AIRDROP,
  CTC_INFO_FACTORY_COMPENSATION,
} = process.env;

const mnemonic = MN || "";
const mnemonic2 = MN2 || "";
const mnemonic3 = MN3 || "";

const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
const { addr: addr2, sk: sk2 } = algosdk.mnemonicToSecretKey(mnemonic2);
const { addr: addr3, sk: sk3 } = algosdk.mnemonicToSecretKey(mnemonic3);

const ALGO_SERVER = "https://testnet-api.voi.nodly.io";
const ALGO_INDEXER_SERVER = "https://testnet-idx.voi.nodly.io";

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

const makeSpec = (methods: any) => {
  return {
    name: "",
    desc: "",
    methods,
    events: [],
  };
};

const signSendAndConfirm = async (txns: string[], sk: any) => {
  const stxns = txns
    .map((t) => new Uint8Array(Buffer.from(t, "base64")))
    .map(algosdk.decodeUnsignedTransaction)
    .map((t: any) => algosdk.signTransaction(t, sk));
  await algodClient.sendRawTransaction(stxns.map((txn: any) => txn.blob)).do();
  return await Promise.all(
    stxns.map((res: any) =>
      algosdk.waitForConfirmation(algodClient, res.txID, 4)
    )
  );
};

program
  .command("deploy <type>")
  .description("Deploy a specific contract type")
  .action(async (type) => {
    const deployer = {
      addr: addr,
      sk: sk,
    };

    switch (type) {
      case "compensation-factory": {
        const appClient = new CompensationFactoryClient(
          {
            resolveBy: "creatorAndName",
            findExistingUsing: indexerClient,
            creatorAddress: deployer.addr,
            name: "compensation-factory",
            sender: deployer,
          },
          algodClient
        );
        await appClient.deploy({
          deployTimeParams: {},
          onUpdate: "update",
          onSchemaBreak: "fail",
        });
        break;
      }
      case "airdrop-factory": {
        const appClient = new AirdropFactoryClient(
          {
            resolveBy: "creatorAndName",
            findExistingUsing: indexerClient,
            creatorAddress: deployer.addr,
            name: "f8",
            sender: deployer,
          },
          algodClient
        );
        await appClient.deploy({
          deployTimeParams: {},
          onUpdate: "update",
          onSchemaBreak: "fail",
        });
        break;
      }
      case "staking-factory": {
        const appClient = new StakingFactoryClient(
          {
            resolveBy: "creatorAndName",
            findExistingUsing: indexerClient,
            creatorAddress: deployer.addr,
            name: "staking-factory-2",
            sender: deployer,
          },
          algodClient
        );
        await appClient.deploy({
          deployTimeParams: {},
          onUpdate: "update",
          onSchemaBreak: "fail",
        });
        break;
      }
      case "messenger": {
        const appClient = new MessengerClient(
          {
            resolveBy: "creatorAndName",
            findExistingUsing: indexerClient,
            creatorAddress: deployer.addr,
            name: "m6",
            sender: deployer,
          },
          algodClient
        );
        await appClient.deploy({
          deployTimeParams: {},
          onUpdate: "update",
          onSchemaBreak: "fail",
        });
        break;
      }
      default:
        console.error("Unknown deploy type");
    }
  });

program
  .command("cleanup-airdrop")
  .description("Clean up the airdrop factory")
  .action(async () => {
    console.log("airdrop factory cleanup");
    const {
      data: { accounts },
    } = await axios.get(
      `https://arc72-idx.nautilus.sh/v1/scs/accounts?parentId=${CTC_INFO_FACTORY_AIRDROP}&deleted=0`
    );

    for await (const account of accounts) {
      const { contractId, global_funder, global_funding } = account;
      if (global_funder !== addr) continue;

      if (global_funding === 1) {
        const ci = new CONTRACT(
          contractId,
          algodClient,
          indexerClient,
          makeSpec(AirdropSpec.contract.methods),
          {
            addr,
            sk: new Uint8Array(0),
          }
        );
        ci.setFee(3000);
        ci.setOnComplete(5); // deleteApplicationOC
        const closeR = await ci.close();
        if (closeR.success) {
          console.log("closing...");
          await signSendAndConfirm(closeR.txns, sk);
        }
      } else {
        console.log(`[${contractId}] something else`);
      }
    }
  });

program
  .command("broadcast-message")
  .description("Broadcast a message using the messenger")
  .action(async () => {
    const messengerCtcInfo = 72977126;
    const spec = {
      name: "",
      desc: "",
      methods: MessengerSpec.contract.methods,
      events: [
        {
          name: "PartKeyInfo",
          args: [
            { type: "address", name: "who" },
            { type: "address", name: "adddress" },
            { type: "byte[32]", name: "vote_k" },
            { type: "byte[32]", name: "sel_k" },
            { type: "uint64", name: "vote_fst" },
            { type: "uint64", name: "vote_lst" },
            { type: "uint64", name: "vote_kd" },
            { type: "byte[64]", name: "sp_key" },
          ],
        },
      ],
    };

    const makeCi = (ctcInfo: number, addr: string) => {
      return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
        addr,
        sk: new Uint8Array(0),
      });
    };

    const ci = makeCi(messengerCtcInfo, addr);
    const partkey_broadcastR = await ci.partkey_broastcast(
      addr2,
      new Uint8Array(
        Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")
      ),
      new Uint8Array(
        Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")
      ),
      6558699,
      9558699,
      1733,
      new Uint8Array(
        Buffer.from(
          "FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==",
          "base64"
        )
      )
    );

    await signSendAndConfirm(partkey_broadcastR.txns, sk);
  });

const factory = new Command("factory").description("Manage factory operations");

factory
  .command("deploy-compensation")
  .description("Create a compensation factory")
  .option("-o, --owner <string>", "Specify the owner address")
  .option("-a, --amount <number>", "Specify the amount for compensation")
  .action(async (options) => {
    const ctcInfo = Number(CTC_INFO_FACTORY_COMPENSATION);
    const ci = new CONTRACT(
      ctcInfo,
      algodClient,
      indexerClient,
      {
        name: "",
        desc: "",
        methods: CompensationFactorySpec.contract.methods,
        events: [],
      },
      {
        addr,
        sk: new Uint8Array(0),
      }
    );
    const paymentAmount = 884500 + 100000 + Number(options.amount) * 1e6;
    const owner = options.owner || addr2;
    ci.setFee(9000);
    ci.setPaymentAmount(paymentAmount);
    const createR = await ci.create(owner);
    if (createR.success) {
      const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
      console.log(appCallTxn["inner-txns"][0]["application-index"]);
    } else {
      console.error(createR);
    }
  });

factory
  .command("deploy-airdrop")
  .description("Create an airdrop factory")
  .option("-o, --owner <string>", "Specify the owner address")
  .option("-f, --funder <string>", "Specify the funder address")
  .option("-d, --deadline <number>", "Specify the deadline")
  .requiredOption(
    "-a, --initial <number>",
    "Specify the initial airdrop amount"
  )
  .action(async (options) => {
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
        addr,
        sk: new Uint8Array(0),
      }
    );
    const initial = Number(options.initial) * 1e6;
    const paymentAmount = 884500 + 100000;
    const owner = options.owner || addr2;
    const funder = options.funder || addr;
    const deadline = options.deadline
      ? Number(options.deadline)
      : moment().unix() + 60 * 60 * 24 * 7; // 7 days
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(8000);
    const createR = await ci.create(owner, funder, deadline, initial);
    if (createR.success) {
      const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
      console.log(appCallTxn["inner-txns"][0]["application-index"]);
    } else {
      console.error(createR);
    }
  });

factory
  .command("deploy-staking")
  .requiredOption("-a, --amount <number>", "Specify the amount for staking")
  .requiredOption("-p, --period <number>", "Specify the lockup period")
  .description("Create a staking contract")
  .action(async (options) => {
    const ctcInfo = Number(CTC_INFO_FACTORY_STAKING);
    const ci = new CONTRACT(
      ctcInfo,
      algodClient,
      indexerClient,
      {
        name: "",
        desc: "",
        methods: StakingFactorySpec.contract.methods,
        events: [],
      },
      {
        addr,
        sk: new Uint8Array(0),
      }
    );

    const stakingAmount = Number(options.amount) * 1e6;
    const paymentAmount = stakingAmount + 884500 + 100000;
    const owner = addr2;
    const funder = addr;
    const delegate = addr3;
    const period = Number(options.period);
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(8000);
    const createR = await ci.create(owner, funder, delegate, period);
    if (createR.success) {
      const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
      console.log(appCallTxn["inner-txns"][0]["application-index"]);
    } else {
      console.error(createR);
    }
  });

const airdrop = new Command("airdrop").description("Manage airdrop operations");

const makeCi = (ctcInfo: number, addr: string) => {
  return new CONTRACT(
    ctcInfo,
    algodClient,
    indexerClient,
    makeSpec(AirdropSpec.contract.methods),
    {
      addr,
      sk: new Uint8Array(0),
    }
  );
};

airdrop
  .command("reduce-total <amount>")
  .description("Reduce the total airdrop amount")
  .action(async (amount) => {
    const ci = makeCi(Number(CTC_INFO_AIRDROP), addr);
    const reduceR = await ci.reduce_total(Number(amount));
    console.log(reduceR);
    const res = await signSendAndConfirm(reduceR.txns, sk);
    console.log(res);
  });

airdrop
  .command("abort-funding")
  .description("Abort funding for the airdrop")
  .action(async () => {
    const ci = makeCi(Number(CTC_INFO_AIRDROP), addr);
    ci.setFee(3000);
    ci.setOnComplete(5); // deleteApplicationOC
    const abortR = await ci.abort_funding();
    console.log(abortR);
    const res = await signSendAndConfirm(abortR.txns, sk);
    console.log(res);
  });

airdrop
  .command("setup <ownerAddr>")
  .description("Setup owner and funder for the contract")
  .action(async (ownerAddr) => {
    const ci = makeCi(Number(CTC_INFO_AIRDROP), addr);
    ci.setPaymentAmount(0.1 * 1e6);
    const setupR = await ci.setup(ownerAddr, addr);
    console.log(setupR);
    const res = await signSendAndConfirm(setupR.txns, sk);
    console.log(res);
  });

airdrop
  .command("configure <apid> <period>")
  .description("Configure the lockup period")
  .action(async (apid, period) => {
    const ci2 = makeCi(Number(apid), addr2);
    const configureR = await ci2.configure(Number(period));
    if (configureR.success) {
      await signSendAndConfirm(configureR.txns, sk2);
    }
  });

airdrop
  .command("fill")
  .description("Fill the staking contract")
  .argument("<apid>", "The application ID for the contract")
  .action(async (apid) => {
    const ci = makeCi(Number(apid), addr);
    ci.setPaymentAmount(1e6);
    const fillR = await ci.fill();
    if (fillR.success) {
      const res = await signSendAndConfirm(fillR.txns, sk);
    }
  });

airdrop
  .command("set-funding <apid> <timestamp>")
  .description("Set the funding timestamp")
  .action(async (apid, timestamp) => {
    const ci = makeCi(Number(apid), addr);
    const currentTimestamp = moment().unix();
    const set_fundingR = await ci.set_funding(currentTimestamp);
    if (set_fundingR.success) {
      const res = await signSendAndConfirm(set_fundingR.txns, sk);
    }
  });

airdrop
  .command("participate")
  .description("Participate in the airdrop")
  .action(async () => {
    const ci = makeCi(Number(CTC_INFO_AIRDROP), addr2);
    ci.setPaymentAmount(1000);
    const participateR = await ci.participate(
      new Uint8Array(
        Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")
      ),
      new Uint8Array(
        Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")
      ),
      9_777_253,
      9_777_253 + 1_000_000,
      1733,
      new Uint8Array(
        Buffer.from(
          "FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==",
          "base64"
        )
      )
    );
    console.log(participateR);
    const res = await signSendAndConfirm(participateR.txns, sk2);
    console.log(res);
  });

airdrop
  .command("get-mb")
  .description("Simulate owner's withdrawal and log 'mab' value")
  .argument("<apid>", "The application ID for the contract")
  .action(async (apid) => {
    const ctcInfo = Number(apid);
    const ci = makeCi(ctcInfo, addr2);
    // TODO get owner
    // Simulate as owner
    ci.setFee(2000);
    const withdrawR = await ci.withdraw(0);
    if (withdrawR.success) {
      const withdraw = withdrawR.returnValue;
      console.log(withdraw.toString());
    } else {
      console.log("0");
    }
  });

airdrop
  .command("close")
  .description("Close the airdrop contract")
  .argument("<apid>", "The application ID for the contract")
  .action(async (apid) => {
    const ci = makeCi(Number(apid), addr);
    ci.setFee(3000);
    ci.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci.close();
    if (closeR.success) {
      await signSendAndConfirm(closeR.txns, sk);
    }
  });

program.addCommand(factory);
program.addCommand(airdrop);
program.parse(process.argv);
