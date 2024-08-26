import fs from "fs";
import axios from "axios";
import csv from "csv-parser";
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
  StakeRewardFactoryClient,
  APP_SPEC as StakeRewardFactorySpec,
} from "./StakeRewardFactoryClient.js";
import {
  EarlyStakeRewardFactoryClient,
  APP_SPEC as EarlyStakeRewardFactorySpec,
} from "./EarlyStakeRewardFactoryClient.js";
import {
  MessengerClient,
  APP_SPEC as MessengerSpec,
} from "./MessengerClient.js";

import algosdk from "algosdk";

import { CONTRACT } from "ulujs";

import moment from "moment";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const makeSpec = (methods: any) => {
  return {
    name: "",
    desc: "",
    methods,
    events: [],
  };
};

const { MN, MN2, MN3, CTC_INFO_FACTORY_AIRDROP } = process.env;

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

// select what to deploy
// - base-factory
// - airdrop-factory
// - reward-factory
// - early-factory
// - root-factory
// - messenger

const deployWhat: string = "airdrop-factory";

// deploy contracts

do {
  //break;
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
          name: "f8",
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
    case "reward-factory": {
      const appClient = new StakeRewardFactoryClient(
        {
          resolveBy: "creatorAndName",
          findExistingUsing: indexerClient,
          creatorAddress: deployer.addr,
          name: "f4",
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
    case "early-factory": {
      const appClient = new EarlyStakeRewardFactoryClient(
        {
          resolveBy: "creatorAndName",
          findExistingUsing: indexerClient,
          creatorAddress: deployer.addr,
          name: "0",
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
  }
} while (0); // end deploy
// enter airdrop factory cleanup
do {
  break;
  console.log("airdrop factory cleanup");
  const {
    data: { accounts },
  } = await axios.get(
    `https://arc72-idx.nautilus.sh/v1/scs/accounts?parentId=${CTC_INFO_FACTORY_AIRDROP}&deleted=0`
  );
  for await (const account of accounts) {
    const { contractId, global_funder, global_funding, global_total } = account;
    if (global_funder !== addr) continue;
    const now = moment().unix();
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
      // close
      ci.setFee(3000);
      ci.setOnComplete(5); // deleteApplicationOC
      const closeR = await ci.close();
      console.log(closeR);
      if (closeR.success) {
        console.log("closing...");
        const res = await signSendAndConfirm(closeR.txns, sk);
        console.log(res);
        break;
      }
    }
    if (!global_funding) {
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
      const set_fundingR = await ci.set_funding(1);
      console.log(set_fundingR);
      console.log(set_fundingR);
      if (set_fundingR.success) {
        console.log("funding");
        const res2 = await signSendAndConfirm(set_fundingR.txns, key);
        console.log(res2);
        break;
      }
    } else {
      console.log(`[${contractId}] something else`);
      // try close
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
      console.log(closeR);
      if (closeR.success) {
        console.log("closing...");
        //const res = await signSendAndConfirm(closeR.txns, sk);
        //console.log(res);
        break;
      }
    }
  }
} while (0); // end airdrop factory cleanup

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
// TODO: update naming to vanilla
// enter base factory
do {
  break;
  const ctcInfo = Number(1);
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
    const paymentAmount = 1e6 + 677500 + 100000; // MBR increase for new contract + min balance
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(6000);
    const delegate = addr;
    const createR = await ci.create(delegate);
    console.log(createR, delegate);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end factory
// enter early factory
do {
  break;
  const ctcInfo = Number(1);
  const spec = {
    name: "",
    desc: "",
    methods: EarlyStakeRewardFactorySpec.contract.methods,
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
    const paymentAmount = 2e6 + 677500 + 100000; // MBR increase for new contract
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(4000);
    const owner = addr2;
    const funder = addr3;
    const delegate = addr;
    const period = 18;
    const createR = await ci.create(owner, funder, delegate, period);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end early factory
// enter early
do {
  break;
  // create instance of existing contract
  const ctcInfo = Number(77517010);

  const spec = {
    name: "",
    desc: "",
    methods: AirdropSpec.contract.methods,
    events: [],
  };
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
  // fill as funder
  do {
    break;
    // get period from global state and use it to set payment amount
    // payment amount is gte global initial
    ci3.setPaymentAmount(1e6);
    const fillR = await ci3.fill();
    console.log(fillR);
    const res = await signSendAndConfirm(fillR.txns, sk3);
    console.log(res);
  } while (0); // end fill
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
    const withdrawR = await ci2.withdraw(1e6 - 100000);
    if (!withdrawR.success) {
      console.log(withdrawR);
      break;
    }
    const withdraw = withdrawR.returnValue;
    console.log(withdraw);
    const res = await signSendAndConfirm(withdrawR.txns, sk2);
    console.log(res);
  } while (0); // end withdraw
  // only owner can withdraw
  do {
    break;
    ci2.setFee(3000);
    ci2.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci2.close();
    console.log(closeR);
  } while (0);
  // close
  do {
    break;
    ci2.setFee(3000);
    ci2.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci2.close();
    console.log(closeR);
    const res = await signSendAndConfirm(closeR.txns, sk2);
    console.log(res);
  } while (0); // end close
} while (0); // end early
// enter reward factory
do {
  break;
  const ctcInfo = Number(1);
  const spec = {
    name: "",
    desc: "",
    methods: StakeRewardFactorySpec.contract.methods,
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
    const paymentAmount = 677500 + 100000; // MBR increase for new contract
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(4000);
    const owner = addr2;
    const funder = addr3;
    const delegate = addr;
    const period = 1;
    const createR = await ci.create(owner, funder, delegate, period);
    console.log(createR, owner, delegate);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end reward factory
// enter reward
do {
  break;
  // create instance of existing contract
  const ctcInfo = Number(77517391);

  const spec = {
    name: "",
    desc: "",
    methods: AirdropSpec.contract.methods,
    events: [],
  };
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
  // fill as funder
  do {
    break;
    // get period from global state and use it to set payment amount
    // payment amount is gte global initial
    ci3.setPaymentAmount(1e6);
    const fillR = await ci3.fill();
    console.log(fillR);
    const res = await signSendAndConfirm(fillR.txns, sk3);
    console.log(res);
  } while (0); // end fill
  // owner withdraws (simulate for mab)
  do {
    //break;
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
  // only owner can withdraw
  do {
    break;
    ci2.setFee(3000);
    ci2.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci2.close();
    console.log(closeR);
    const res = await signSendAndConfirm(closeR.txns, sk2);
    console.log(res);
  } while (0); // end close
} while (0); // end reward
// enter airdrop factory
do {
  break;
  const ctcInfo = Number(CTC_INFO_FACTORY_AIRDROP);
  const ctcAddr = algosdk.getApplicationAddress(ctcInfo);
  const makeCi = (ctcInfo: number, addr: string) => {
    return new CONTRACT(
      ctcInfo,
      algodClient,
      indexerClient,
      makeSpec(AirdropFactorySpec.contract.methods),
      {
        addr,
        sk: new Uint8Array(0),
      }
    );
  };
  const ci = makeCi(ctcInfo, addr);
  // cleanup as funder
  do {
    break;
    console.log("close out all contracts as funder");
    console.log({ addr });
    const {
      account: { ["created-apps"]: createdApps },
    } = await indexerClient.lookupAccountByID(ctcAddr).do();
    console.log(createdApps);
    for await (const app of createdApps) {
      const ctcInfo = app.id;
      const ci = new CONTRACT(
        ctcInfo,
        algodClient,
        indexerClient,
        makeSpec(AirdropSpec.contract.methods),
        {
          addr,
          sk: new Uint8Array(0),
        }
      );
      // owner withdraws (simulate for mab)
      do {
        break;
        // need to simulate as owner
        ci.setFee(2000);
        const withdrawR = await ci.withdraw(0);
        if (!withdrawR.success) {
          console.log(withdrawR);
          break;
        }
        const withdraw = withdrawR.returnValue;
        console.log("mab", withdraw);
      } while (0);
      // close
      do {
        //break;
        ci.setFee(3000);
        ci.setOnComplete(5); // deleteApplicationOC
        const closeR = await ci.close();
        console.log(closeR);
        if (closeR.success) {
          const res = await signSendAndConfirm(closeR.txns, sk);
          console.log(res);
        }
      } while (0);
      // break;
    }
  } while (0);

  // update (only used for non-Deployable contracts)
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
          const paymentAmount = 777500 + 100000; // MBR increase for new contract
          ci.setPaymentAmount(paymentAmount);
          ci.setFee(5000);
          const initialBi = BigInt(initial);
          const createR = await ci.create(owner, funder, deadline, initialBi);
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
    const paymentAmount = 777500 + 100000; // MBR increase for new contract
    ci.setPaymentAmount(paymentAmount);
    ci.setFee(5000);
    // begin params
    const owner = addr2;
    const funder = addr;
    const now: number = moment().unix();
    const deadline = now + 3600 * 24; // 1 hour
    const initial = 1e6 * 1; // 1 VOI
    // end params
    const createR = await ci.create(owner, funder, deadline, initial);
    console.log(createR, addr2);
    if (!createR.success) {
      console.log("create failed");
      break;
    }
    const res = await signSendAndConfirm(createR.txns, sk);
    console.log(res);
  } while (0); // end create
} while (0); // end airdrop factory
// enter funding batch
do {
  break;
  console.log("funding batch");
  // read from csv
  // contractId,contractAddress,ownerAddress,funderAddress,period,total,funding
  interface FundingI {
    contractId: number;
    contractAddress: string;
    ownerAddress: string;
    funderAddress: string;
    period: number;
    partVoteLst: number;
    total: number;
    funding: number;
    targetAmount: number;
    targetFunding: number;
  }
  const results: FundingI[] = [];
  fs.createReadStream("funding.csv")
    .pipe(csv())
    .on("data", (data) =>
      results.push({
        contractId: Number(data.contractId),
        contractAddress: data.contractAddress,
        ownerAddress: data.ownerAddress,
        funderAddress: data.funderAddress,
        period: Number(data.period),
        partVoteLst: Number(data.partVoteLst),
        total: Number(data.total),
        funding: Number(data.funding),
        targetAmount: Number(data.targetAmount),
        targetFunding: Number(data.targetFunding),
      })
    )
    .on("end", async () => {
      for (const r of results) {
        const {
          contractId,
          contractAddress,
          ownerAddress,
          funderAddress,
          period,
          partVoteLst,
          total,
          funding,
          targetAmount,
          targetFunding,
        } = r;

        console.log(r);

        const spec = {
          name: "",
          desc: "",
          methods: AirdropSpec.contract.methods,
          events: [],
        };

        const makeCi = (ctcInfo: number, addr: string) => {
          return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
            addr,
            sk: new Uint8Array(0),
          });
        };

        const ci = makeCi(contractId, addr);

        // TODO make atomic
        ci.setPaymentAmount(targetAmount);
        const fillR = await ci.fill(); // 1 hour
        console.log(fillR);
        if (fillR.success) {
          const res = await signSendAndConfirm(fillR.txns, key);
          console.log(res);
        }

        ci.setPaymentAmount(0);
        const set_fundingR = await ci.set_funding(targetFunding);
        console.log(set_fundingR);
        if (set_fundingR.success) {
          const res2 = await signSendAndConfirm(set_fundingR.txns, key);
          console.log(res2);
        }
      }
    });
} while (0);
// enter airdrop
do {
  break;
  // create instance of existing contract
  const ctcInfo = Number(81432702);

  const spec = {
    name: "",
    desc: "",
    methods: AirdropSpec.contract.methods,
    events: [],
  };

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
    const configureR = await ci2.configure(period);
    console.log(configureR);
    const res = await signSendAndConfirm(configureR.txns, sk2);
    console.log(res);
  } while (0); // end configure

  // funder fills contract
  do {
    break;
    console.log("fill");
    //payment amount is gte global initial
    ci.setPaymentAmount(1e6);
    const now: number = moment().unix();
    const fillR = await ci.fill(); // 1 hour
    console.log(fillR);
    const res = await signSendAndConfirm(fillR.txns, key);
    console.log(res);
    // const set_fundingR = await ci.set_funding(now + 60);
    // console.log(set_fundingR);
    // const res2 = await signSendAndConfirm(set_fundingR.txns, key);
    // console.log(res2);
    //TODO combine txns into group
  } while (0); // end fill
  // owner or delegate participates (participation)
  do {
    break;
    console.log("participate online");
    // send 100000
    ci2.setPaymentAmount(1000);
    const participateR = await ci2.participate(
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
  } while (0); // end participation (participation)
  // delegate participates (non-participation)
  do {
    break;
    // send 100000
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
    const res = await signSendAndConfirm(participateR.txns, sk);
    console.log(res);
  } while (0); // end participation (participation)
  // owner or delegate participates (non-participation)
  do {
    break;
    console.log("participate offline");
    ci2.setPaymentAmount(1000);
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
    console.log("set delegate");
    const set_delegateR = await ci2.set_delegate(addr);
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
    console.log("mab", withdraw.toString());
  } while (0); // end withdraw (simulate for mab)
  // owner withdraw
  do {
    break;
    ci2.setFee(2000);
    const withdrawR = await ci2.withdraw(1);
    if (!withdrawR.success) {
      console.log(withdrawR);
      break;
    }
    const withdraw = withdrawR.returnValue;
    console.log(withdraw);
    const res = await signSendAndConfirm(withdrawR.txns, sk2);
    console.log(res);
  } while (0); // end withdraw
  // owner or funder can close
  do {
    break;
    console.log("close");
    ci.setFee(3000);
    ci.setOnComplete(5); // deleteApplicationOC
    const closeR = await ci.close();
    console.log(closeR);
    const res = await signSendAndConfirm(closeR.txns, sk);
    console.log(res);
  } while (0); // end close
} while (0); // end staking
