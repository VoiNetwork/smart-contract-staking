import { SmartContractStakingClient, APP_SPEC } from "./SmartContractStakingClient.js"

import algosdk from "algosdk";

import { CONTRACT } from "ulujs";

import moment from "moment";

import * as dotenv from "dotenv";
dotenv.config({ path: '.env' });

const { MN, MN2 } = process.env;

const mnemonic = MN || "";
const mnemonic2 = MN2 || "";

const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
const { addr: addr2, sk: sk2 } = algosdk.mnemonicToSecretKey(mnemonic2);

const address = addr
const key = sk

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
    stxns.map((res: any) => algosdk.waitForConfirmation(algodClient, res.txID, 4))
  );
};

const deployer = {
  addr: address,
  sk: key
}


const secondsCustom = 30;
const secondsInMinute = 60;
const secondsInHour = 3600;
const secondsInMonth = 31557600;
const periodSeconds = secondsCustom

// deploy contract with deploy time params
do {
  break;
  const appClient = new SmartContractStakingClient({
    resolveBy: "creatorAndName",
    findExistingUsing: indexerClient,
    creatorAddress: deployer.addr,
    name: "20",
    sender: deployer,
  }, algodClient);
  const app = await appClient.deploy({
    deployTimeParams: {
      PERIOD_SECONDS: periodSeconds,
      VESTING_DELAY: 12,
      LOCKUP_DELAY: 12
    }
  });
} while (0);

// create instance of existing contract

const ctcInfo = 43680506

const spec = {
  name: "",
  desc: "",
  methods: APP_SPEC.contract.methods,
  events: []
}

const makeCi = (ctcInfo: number, addr: string) => {
  return new CONTRACT(ctcInfo, algodClient, indexerClient, spec, {
    addr,
    sk: new Uint8Array(0)
  })
}

const ci = makeCi(ctcInfo, addr)

const ci2 = makeCi(ctcInfo, addr2)

const currentTimestamp = moment().unix();

// step 1: creator sets owner

do {
  break;
  ci.setPaymentAmount(0.1 * 1e6)
  const setupR = await ci.setup(
    "SU67PS6BFKHQBBBQQJZOWME6W6KNFUZLTHAC5FQLCGL6WPCTTSRTUOVFWI",
  )
  console.log(setupR);
  const res = await signSendAndConfirm(setupR.txns, sk)
  console.log(res)
} while (0);

// step 2: owner sets lockup period

do {
  break;
  const configureR = await ci2.configure(1);
  console.log(configureR);
  const res = await signSendAndConfirm(configureR.txns, sk2)
  console.log(res)
} while (0)

// step 3: creator fills contract

do {
  break;
  ci.setPaymentAmount(1e6)
  const fillR = await ci.fill( currentTimestamp);
  console.log(fillR);
  const res = await signSendAndConfirm(fillR.txns, key)
  console.log(res)
} while (0)

// step 4: owner registers online

do {
  break;
  console.log("participate online");
  ci2.setPaymentAmount(1000);
  const participateR = await ci2.participate(
    new Uint8Array(Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")),
    new Uint8Array(Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")),
    6558699,
    9558699,
    1733,
    new Uint8Array(Buffer.from("FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==", "base64"))
  );
  console.log(participateR);
  const res = await signSendAndConfirm(participateR.txns, sk2)
  console.log(res)
} while (0)

  // step 4: owner registers offline

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
  const res = await signSendAndConfirm(participateR.txns, sk2)
  console.log(res)
} while (0)

// step 4: owner withdraws (simulate for mab)

do {
  break;
  ci2.setFee(2000)
  const withdrawR = await ci2.withdraw(0)
  if (!withdrawR.success) {
    console.log(withdrawR)
    break
  }
  const withdraw = withdrawR.returnValue;
  console.log(withdraw)
} while (0)

// step 4: owner withdraws

do {
  break;
  ci2.setFee(2000)
  const withdrawR = await ci2.withdraw(1e6)
  if (!withdrawR.success) {
    console.log(withdrawR)
    break
  }
  const withdraw = withdrawR.returnValue;
  console.log(withdraw)
  const res = await signSendAndConfirm(withdrawR.txns, sk2)
  console.log(res)
} while (0)

// step 4: owner closes

do {
  break;
  ci2.setFee(2000)
  ci2.setOnComplete(5) // deleteApplicationOC
  const closeR = await ci2.close()
  console.log(closeR)
  const res = await signSendAndConfirm(closeR.txns, sk2)
  console.log(res)
} while (0)





