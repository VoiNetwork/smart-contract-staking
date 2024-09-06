import { Command } from "commander";
import fs from "fs";
import axios from "axios";
import csv from "csv-parser";
import {
  AirdropClient,
  APP_SPEC as AirdropSpec,
} from "./clients/AirdropClient.js";
import {
  CompensationFactoryClient,
  APP_SPEC as CompensationFactorySpec,
} from "./clients/CompensationFactoryClient.js";
import {
  AirdropFactoryClient,
  APP_SPEC as AirdropFactorySpec,
} from "./clients/AirdropFactoryClient.js";
import {
  StakingFactoryClient,
  APP_SPEC as StakingFactorySpec,
} from "./clients/StakingFactoryClient.js";
import {
  MessengerClient,
  APP_SPEC as MessengerSpec,
} from "./clients/MessengerClient.js";
import algosdk from "algosdk";
import { CONTRACT } from "ulujs";
import moment from "moment";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

export const program = new Command();

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

export const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
export const { addr: addr2, sk: sk2 } = algosdk.mnemonicToSecretKey(mnemonic2);
export const { addr: addr3, sk: sk3 } = algosdk.mnemonicToSecretKey(mnemonic3);

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

type DeployType =
  | "airdrop-factory"
  | "staking-factory"
  | "compensation-factory"
  | "messenger";
interface DeployOptions {
  type: DeployType;
  name: string;
  periodSeconds: number;
  periodLimit: number;
  vestingDelay: number;
  lockupDelay: number;
  messengerId: number;
  distributionCount: number;
  distributionSeconds: number;
}
export const deploy: any = async (options: DeployOptions) => {
  const deployer = {
    addr: addr,
    sk: sk,
  };
  let Client;
  switch (options.type) {
    case "airdrop-factory": {
      Client = AirdropFactoryClient;
      break;
    }
    case "staking-factory": {
      Client = StakingFactoryClient;
      break;
    }
    case "compensation-factory": {
      Client = CompensationFactoryClient;
      break;
    }
    case "messenger": {
      Client = MessengerClient;
      break;
    }
    default:
      console.error("Unknown deploy type");
  }
  const clientParams: any = {
    resolveBy: "creatorAndName",
    findExistingUsing: indexerClient,
    creatorAddress: deployer.addr,
    name: options.name || "",
    sender: deployer,
  };
  const appClient = Client ? new Client(clientParams, algodClient) : null;
  if (appClient) {
    const app = await appClient.deploy({
      deployTimeParams: {
        PERIOD_SECONDS: options.periodSeconds
          ? Number(options.periodSeconds)
          : 1,
        PERIOD_LIMIT: options.periodLimit ? Number(options.periodLimit) : 1,
        VESTING_DELAY: options.vestingDelay ? Number(options.vestingDelay) : 1,
        LOCKUP_DELAY: options.lockupDelay ? Number(options.lockupDelay) : 1,
        MESSENGER_ID: options.messengerId ? Number(options.messengerId) : 1,
        DISTRIBUTION_COUNT: options.distributionCount
          ? Number(options.distributionCount)
          : 1,
        DISTRIBUTION_SECONDS: options.distributionSeconds
          ? Number(options.distributionSeconds)
          : 1,
      },
      onUpdate: "update",
      onSchemaBreak: "fail",
    });
    return app.appId;
  }
};
program
  .command("deploy")
  .requiredOption("-t, --type <string>", "Specify factory type")
  .requiredOption("-n, --name <string>", "Specify contract name")
  .requiredOption("-s, --period-seconds <number>", "Specify period seconds")
  .requiredOption("-p, --period-limit <number>", "Specify period limit")
  .requiredOption("-v, --vesting-delay <number>", "Specify vesting delay")
  .requiredOption("-l, --lockup-delay <number>", "Specify lockup delay")
  .requiredOption("-m, --messenger-id <number>", "Specify messenger ID")
  .requiredOption(
    "-c, --distribution-count <number>",
    "Specify distribution count"
  )
  .requiredOption(
    "-d, --distribution-seconds <number>",
    "Specify distribution seconds"
  )
  .description("Deploy a specific contract type")
  .action(deploy);

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

const messenger = new Command("messenger").description(
  "Manage messenger operations"
);

messenger
  .command("broadcast-partkey")
  .description("Broadcast a message using the messenger")
  .requiredOption("-m, --messenger-id <number>", "Specify the messenger ID")
  .requiredOption("-v, --vote-k <string>", "Specify the vote key")
  .requiredOption("-s, --sel-k <string>", "Specify the selection key")
  .requiredOption("-f, --vote-fst <number>", "Specify the vote first")
  .requiredOption("-l, --vote-lst <number>", "Specify the vote last")
  .requiredOption("-d, --vote-kd <number>", "Specify the vote key duration")
  .requiredOption("-k, --sp-key <string>", "Specify the sp key")
  .action(async (options) => {
    const ctcInfo = Number(options.messengerId);
    const voteFst = Number(options.voteFst);
    const voteLst = Number(options.voteLst);
    const voteKd = Number(options.voteKd);
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

    const ci = makeCi(ctcInfo, addr);
    const partkey_broadcastR = await ci.partkey_broastcast(
      addr2,
      new Uint8Array(Buffer.from(options.voteK, "base64")),
      new Uint8Array(Buffer.from(options.selK, "base64")),
      voteFst,
      voteLst,
      voteKd,
      new Uint8Array(Buffer.from(options.spKey, "base64"))
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
    const paymentAmount = 1034500 + 100000 + Number(options.amount) * 1e6;
    const owner = options.owner || addr2;
    ci.setFee(10000);
    ci.setPaymentAmount(paymentAmount);
    const createR = await ci.create(owner);
    if (createR.success) {
      const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
      console.log(appCallTxn["inner-txns"][0]["application-index"]);
    } else {
      console.error(createR);
    }
  });

export const deployAirdrop = async (options: any) => {
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
  const paymentAmount = 1134500 + 100000; // not arbitrary
  const owner = options.owner || addr2;
  const funder = options.funder || addr;
  const deadline = options.deadline
    ? Number(options.deadline)
    : moment().unix() + 60 * 60 * 24 * 7; // 7 days
  ci.setPaymentAmount(paymentAmount);
  ci.setFee(10000);
  const createR = await ci.create(owner, funder, deadline, initial);
  if (createR.success) {
    const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
    const apid = appCallTxn["inner-txns"][0]["application-index"];
    //console.log(createR);
    return apid;
  } else {
    //console.error(createR);
  }
};
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
  .action(deployAirdrop);

// update all airdrop contracts

factory
  .command("update-airdrop")
  .description("Update all airdrop contracts")
  .option("-d --delete", "Delete the application")
  .action(async (options) => {
    const {
      data: { accounts },
    } = await axios.get(
      `https://arc72-idx.nautilus.sh/v1/scs/accounts?parentId=${CTC_INFO_FACTORY_AIRDROP}&deleted=0`
    );
    for await (const account of accounts) {
      try {
        const { contractId } = account;
        console.log(`[${contractId}] updating...`);
        const apid = Number(contractId);
        await new AirdropClient(
          {
            resolveBy: "id",
            id: apid,
            sender: {
              addr,
              sk,
            },
          },
          algodClient
        ).appClient.update();
        const ci = makeCi(apid, addr);
        ci.setFee(3000);
        if (options.delete) {
          ci.setOnComplete(5); // deleteApplicationOC
        }
        const updateR = await ci.update();
        console.log(updateR);
        if (updateR.success) {
          await signSendAndConfirm(updateR.txns, sk);
        }
      } catch (e) {
        console.log(e);
      }
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
    const paymentAmount = stakingAmount + 1034500 + 100000;
    const owner = addr2;
    const funder = addr;
    const delegate = addr3;
    const period = Number(options.period);
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(10000);
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

// configure the airdrop contract as default owner addr2
export const airdropConfigure: any = async (apid: number, period: number) => {
  const ci = makeCi(apid, addr2);
  const configureR = await ci.configure(period);
  if (configureR.success) {
    await signSendAndConfirm(configureR.txns, sk2);
    return true;
  }
  return false;
};
airdrop
  .command("configure <apid> <period>")
  .description("Configure the lockup period")
  .action(airdropConfigure);

airdrop
  .command("fill")
  .description("Fill the staking contract")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .requiredOption("-f, --fillAmount <number>", "Specify the amount to fill")
  .action(async (options) => {
    const ci = makeCi(Number(options.apid), addr);
    const paymentAmount = Number(options.fillAmount) * 1e6;
    ci.setPaymentAmount(paymentAmount);
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
    console.log(set_fundingR);
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

const app = new Command("app").description("Manage app operations");

interface AppUpdateOptions {
  apid: number;
  delete: boolean;
}
export const updateApp: any = async (options: AppUpdateOptions) => {
  const apid = Number(options.apid);
  const ci = makeCi(apid, addr);
  ci.setFee(3000);
  if (options.delete) {
    ci.setOnComplete(5); // deleteApplicationOC
  }
  const updateR = await ci.update();
  if (updateR.success) {
    await signSendAndConfirm(updateR.txns, sk);
    return true;
  }
  return false;
};
app
  .command("update")
  .description("Update the airdrop contract")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .option("-c --client <string>", "Specify the client")
  .option("-d --delete", "Delete the application")
  .action(updateApp);

program.addCommand(app);
program.addCommand(messenger);
program.addCommand(factory);
program.addCommand(airdrop);
