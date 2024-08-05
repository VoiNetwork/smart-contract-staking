import fs from "fs";
import csv from "csv-parser";
import { BaseClient, APP_SPEC as BaseSpec } from "./BaseClient.js";
import { AirdropClient, APP_SPEC as AirdropSpec } from "./AirdropClient.js";
import {
  AirdropFactoryClient,
  APP_SPEC as AirdropFactorySpec,
} from "./AirdropFactoryClient.js";
import {
  BaseFactoryClient,
  APP_SPEC as BaseFactorySpec,
} from "./BaseFactoryClient.js";
import {
  MessengerClient,
  APP_SPEC as MessengerSpec,
} from "./MessengerClient.js";

import algosdk from "algosdk";

import { CONTRACT } from "ulujs";

import moment from "moment";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const { MN, MN2, MN3, NODE_ADDR } = process.env;

const mnemonic = MN || "";
const mnemonic2 = MN2 || "";
const mnemonic3 = MN3 || "";

const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
const { addr: addr2, sk: sk2 } = algosdk.mnemonicToSecretKey(mnemonic2);
const { addr: addr3, sk: sk3 } = algosdk.mnemonicToSecretKey(mnemonic3);

console.log({ addr, addr2, addr3 });

const address = addr;
const key = sk;

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

const signSendAndConfirm = async (txns: string[], sk: any) => {
  const stxns = txns
    .map((t) => new Uint8Array(Buffer.from(t, "base64")))
    .map(algosdk.decodeUnsignedTransaction)
    .map((t: any) => algosdk.signTransaction(t, sk));
  console.log(stxns.map((res: any) => res.txID));
  await algodClient.sendRawTransaction(stxns.map((txn: any) => txn.blob)).do();
  await Promise.all(
    stxns.map((res: any) =>
      algosdk.waitForConfirmation(algodClient, res.txID, 4)
    )
  );
};

const deployer = {
  addr: address,
  sk: key,
};

const secondsCustom = 30;
const secondsInMinute = 60;
const secondsInHour = 3600;
const secondsInMonth = 31557600;
const periodSeconds = secondsCustom;

const deployWhat: string = "airdrop-factory";

// deploy
do {
  break;
  switch (deployWhat) {
    case "base-factory": {
      const appClient = new BaseFactoryClient(
        {
          resolveBy: "creatorAndName",
          findExistingUsing: indexerClient,
          creatorAddress: deployer.addr,
          name: "f1",
          sender: deployer,
        },
        algodClient
      );
      const app = await appClient.deploy({
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
          name: "f7",
          sender: deployer,
        },
        algodClient
      );
      const app = await appClient.deploy({
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
      const app = await appClient.deploy({
        deployTimeParams: {},
        onUpdate: "update",
        onSchemaBreak: "fail",
      });
      break;
    }
    case "staking": {
      const appClient = new BaseClient(
        {
          resolveBy: "creatorAndName",
          findExistingUsing: indexerClient,
          creatorAddress: deployer.addr,
          name: "311",
          sender: deployer,
        },
        algodClient
      );
      const app = await appClient.deploy({
        deployTimeParams: {
          /*
          MESSENGER_ID: 73060985,
          PERIOD_SECONDS: periodSeconds,
          PERIOD_LIMIT: 5,
          VESTING_DELAY: 12,
          LOCKUP_DELAY: 12,
          */
        },
        onUpdate: "update",
        onSchemaBreak: "fail",
      });
      break;
    }
  }
} while (0); // end deploy
// enter messenger
do {
  break;
  const messengerCtcInfo = 72977126;
  const spec = {
    name: "",
    desc: "",
    methods: MessengerSpec.contract.methods,
    events: [
      {
        name: "PartKeyInfo",
        args: [
          {
            type: "address",
            name: "who",
          },
          {
            type: "address",
            name: "adddress",
          },
          {
            type: "byte[32]",
            name: "vote_k",
          },
          {
            type: "byte[32]",
            name: "sel_k",
          },
          {
            type: "uint64",
            name: "vote_fst",
          },
          {
            type: "uint64",
            name: "vote_lst",
          },
          {
            type: "uint64",
            name: "vote_kd",
          },
          {
            type: "byte[64]",
            name: "sp_key",
          },
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
  // broadcast message
  do {
    break;
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
  } while (0); // end broadcast message
  // get events
  do {
    break;
    // get current round
    const lastRound = (await algodClient.status().do())["last-round"];
    const ci = makeCi(messengerCtcInfo, addr);
    const PartKeyInfoEvents = (
      await ci.getEvents({
        minRound: Math.min(0, lastRound - 1e6),
        sender: addr3,
      })
    ).find((el: any) => el.name === "PartKeyInfo");
    console.log(PartKeyInfoEvents);
  } while (0); // end get events
} while (0); // end messenger
// enter base factory
do {
  break;
  const ctcInfo = 73855743;
  const spec = {
    name: "",
    desc: "",
    methods: BaseFactorySpec.contract.methods,
    events: [],
  };
  const makeCi = (ctcInfo: number, addr: string) => {
    return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
      addr,
      sk: new Uint8Array(0),
    });
  };
  const ci = makeCi(ctcInfo, addr);
  // update
  do {
    break;
    //const BoxPayment = 105700;
    //ci.setPaymentAmount(BoxPayment);
    const updateR = await ci.update();
    console.log(updateR);
    const res = await signSendAndConfirm(updateR.txns, sk);
    console.log(res);
  } while (0); // end update
  // create
  do {
    break;
    const paymentAmount = 642000; // MBR increase for new contract
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(3000);
    const owner = addr2;
    const delegate = addr;
    const createR = await ci.create(owner, delegate);
    console.log(createR, owner, delegate);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end factory
// enter airdrop factory
do {
  break;
  const ctcInfo = 73765773;
  const spec = {
    name: "",
    desc: "",
    methods: AirdropFactorySpec.contract.methods,
    events: [],
  };
  const makeCi = (ctcInfo: number, addr: string) => {
    return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
      addr,
      sk: new Uint8Array(0),
    });
  };
  const ci = makeCi(ctcInfo, addr);
  // update
  do {
    break;
    //const BoxPayment = 105700;
    //ci.setPaymentAmount(BoxPayment);
    const updateR = await ci.update();
    console.log(updateR);
    const res = await signSendAndConfirm(updateR.txns, sk);
    console.log(res);
  } while (0); // end update
  // create batch
  do {
    break;
    // read from csv
    interface AirdropI {
      owner: string;
      funder: string;
      deadline: number;
      initial: string;
    }
    const results: AirdropI[] = [];
    fs.createReadStream("airdrop.csv")
      .pipe(csv())
      .on("data", (data) =>
        results.push({
          owner: data.owner,
          funder: data.funder,
          deadline: Number(data.deadline),
          initial: data.initial,
        })
      )
      .on("end", async () => {
        for (const airdrop of results) {
          const { owner, funder, deadline, initial } = airdrop;
          console.log(owner, funder, deadline, initial);
          const paymentAmount = 642000; // MBR increase for new contract
          ci.setPaymentAmount(paymentAmount);
          ci.setFee(3000);
          const initialBi = BigInt(initial);
          const createR = await ci.create(
            owner,
            funder,
            deadline,
            initialBi
          );
          if (!createR.success) {
            console.log("create failed");
            break;
          }
          const res = await signSendAndConfirm(createR.txns, sk);
          console.log(res);
        }
      });
  } while (0); // end create batch
  // create
  do {
    break;
    const paymentAmount = 642000; // MBR increase for new contract
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(3000);
    const owner = "VVNPL3MM2XWE6XGVP6ILCQ5A6B5UFKAZMSKVLXMV5DQP75ODVZM3XCHGDA";
    const funder = addr;
    const deadline = 1722937600; // future time
    const initial = 1e6 * 1000; // 1000 VOI
    const createR = await ci.create(owner, funder, deadline, initial);
    console.log(createR, addr2);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end factory
// enter airdrop
do {
  break;
  // create instance of existing contract
  const ctcInfo = 75669325;

  const spec = {
    name: "",
    desc: "",
    methods: AirdropSpec.contract.methods,
    events: [],
  };

  console.log(spec.methods);

  const makeCi = (ctcInfo: number, addr: string) => {
    return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
      addr,
      sk: new Uint8Array(0),
    });
  };

  const ci = makeCi(ctcInfo, addr);
  const ci2 = makeCi(ctcInfo, addr2);
  const ci3 = makeCi(ctcInfo, addr3);

  const currentTimestamp = moment().unix();
  // not in use, setup must be factory
  // creator setup owner and funder
  // do {
  //   break;
  //   ci.setPaymentAmount(0.1 * 1e6);
  //   const setupR = await ci.setup(
  //     "NL3HRVWN37WUIWGE7LXF2JBOOY36UOI4ARGERNPWK3RKEV4ISV272O2WRM",
  //     addr
  //   );
  //   console.log(setupR);
  //   const res = await signSendAndConfirm(setupR.txns, sk);
  //   console.log(res);
  // } while (0); // end setup
  // owner configure lockup period
  do {
    break;
    const period = 5;
    const configureR = await ci3.configure(period);
    console.log(configureR);
    const res = await signSendAndConfirm(configureR.txns, sk3);
    console.log(res);
  } while (0); // end configure
  // funder fills contract
  do {
    break;
    ci.setPaymentAmount(1e6);
    const fillR = await ci.fill(currentTimestamp);
    console.log(fillR);
    const res = await signSendAndConfirm(fillR.txns, key);
    console.log(res);
  } while (0); // end fill
  // owner or delegate participates (participation)
  do {
    break;
    console.log("participate online");
    // send 100000
    ci3.setPaymentAmount(1000);
    const participateR = await ci3.participate(
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
    console.log(participateR);
    const res = await signSendAndConfirm(participateR.txns, sk3);
    console.log(res);
  } while (0); // end participation (participation)
  // owner or delegate participates (non-participation)
  do {
    break;
    console.log("participate offline");
    ci2.setPaymentAmount(11000);
    const participateR = await ci2.participate(
      new Uint8Array(32),
      new Uint8Array(32),
      0,
      0,
      0,
      new Uint8Array(64)
    );
    console.log(participateR);
    const res = await signSendAndConfirm(participateR.txns, sk2);
    console.log(res);
  } while (0); // end participation (non-participation)
  // owner set delegate
  do {
    break;
    const nodeAddr = NODE_ADDR || "";
    const set_delegateR = await ci2.set_delegate(nodeAddr);
    console.log(set_delegateR);
    const res = await signSendAndConfirm(set_delegateR.txns, sk2);
    console.log(res);
  } while (0); // end set delegate
  // owner withdraws (simulate for mab)
  do {
    break;
    ci2.setFee(2000);
    const withdrawR = await ci2.withdraw(0);
    if (!withdrawR.success) {
      console.log(withdrawR);
      break;
    }
    const withdraw = withdrawR.returnValue;
    console.log(withdraw);
  } while (0); // end withdraw (simulate for mab)
  // owner withdraw
  do {
    break;
    ci2.setFee(2000);
    const withdrawR = await ci2.withdraw(1e6);
    if (!withdrawR.success) {
      console.log(withdrawR);
      break;
    }
    const withdraw = withdrawR.returnValue;
    console.log(withdraw);
    const res = await signSendAndConfirm(withdrawR.txns, sk2);
    console.log(res);
  } while (0); // end withdraw
  // anybody close
  do {
    break;
    ci2.setFee(2000);
    ci2.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci2.close();
    console.log(closeR);
    const res = await signSendAndConfirm(closeR.txns, sk2);
    console.log(res);
  } while (0); // end close
} while (0); // end staking
