import { Command } from "commander";
import axios from "axios";
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
import algosdk, { waitForConfirmation } from "algosdk";
import { CONTRACT, abi } from "ulujs";
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

// funder, upgrader
export const { addr, sk } = algosdk.mnemonicToSecretKey(mnemonic);
// owner
export const { addr: addr2, sk: sk2 } = algosdk.mnemonicToSecretKey(mnemonic2);
// delegate
export const { addr: addr3, sk: sk3 } = algosdk.mnemonicToSecretKey(mnemonic3);

export const addressses = {
  funder: addr,
  owner: addr2,
  delegate: addr3,
};

export const sks = {
  funder: sk,
  owner: sk2,
  delegate: sk3,
};

const ALGO_SERVER = "https://testnet-api.voi.nodly.io";
const ALGO_INDEXER_SERVER = "https://testnet-idx.voi.nodly.io";
// TODO add ARC72_INDEXER_SERVER

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

export const getBalance = async (addr: string) => {
  const account = await algodClient.accountInformation(addr).do();
  return account.amount;
}

export const getAvailableBalance = async (addr: string) => {
  const account = await algodClient.accountInformation(addr).do();
  const minBalance = account["min-balance"];
  const balance = account.amount;
  return balance - minBalance;
};

export const getApplicationAvailableBalance = async (apid: number) => {
  return await getAvailableBalance(algosdk.getApplicationAddress(apid));
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
  debug?: boolean;
}
export const deploy: any = async (options: DeployOptions) => {
  if(options.debug) {
    console.log(options);
  }
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
        PERIOD_LIMIT: options.periodLimit ? Number(options.periodLimit) : 0,
        VESTING_DELAY: options.vestingDelay ? Number(options.vestingDelay) : 0,
        LOCKUP_DELAY: options.lockupDelay ? Number(options.lockupDelay) : 0,
        MESSENGER_ID: options.messengerId ? Number(options.messengerId) : 0,
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
  .option("-s, --period-seconds <number>", "Specify period seconds")
  .option("-p, --period-limit <number>", "Specify period limit")
  .option("-v, --vesting-delay <number>", "Specify vesting delay")
  .option("-l, --lockup-delay <number>", "Specify lockup delay")
  .option("-m, --messenger-id <number>", "Specify messenger ID")
  .option(
    "-c, --distribution-count <number>",
    "Specify distribution count"
  )
  .option(
    "-d, --distribution-seconds <number>",
    "Specify distribution seconds"
  )
  .option("--debug", "Debug the deployment", false)
  .description("Deploy a specific contract type")
  .action(async (options: DeployOptions) => {
    const apid = await deploy(options);
    if (!apid) {
      console.log("Failed to deploy contract");
      return;
    }
    console.log(apid);
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

interface DeployCompensationOptions {
  apid: number;
  owner: string;
  amount: number;
  extraPayment?: number;
}
export const deployCompensation: any = async (
  options: DeployCompensationOptions
) => {
  const ctcInfo = Number(options?.apid || CTC_INFO_FACTORY_COMPENSATION);
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
      addr: options.owner || addr2,
      sk: new Uint8Array(0),
    }
  );
  const stakeAmount = Number(options.amount) * 1e6;
  const paymentAmount =
    stakeAmount + 1234500 + 1e5 + (options.extraPayment || 0);
  const owner = options.owner || addr2;
  ci.setFee(10000);
  ci.setPaymentAmount(paymentAmount);
  const createR = await ci.create(owner);
  if (createR.success) {
    const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk2);
    const apid = appCallTxn["inner-txns"][0]["application-index"];
    return apid;
  }
};
factory
  .command("deploy-compensation")
  .description("Create a compensation factory")
  .option("-a, --apid <number>", "Specify the application ID")
  .option("-o, --owner <string>", "Specify the owner address")
  .option("-b, --amount <number>", "Specify the amount for compensation")
  .action(async (options: DeployCompensationOptions) => {
    const apid = await deployCompensation(options);
    console.log(apid);
  });

interface DeployAirdropOptions {
  apid: number;
  initial: number;
  owner?: string;
  funder?: string;
  deadline?: number;
  extraPayment?: number;
  debug?: boolean;
}
export const deployAirdrop: any = async (options: DeployAirdropOptions) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid || CTC_INFO_FACTORY_AIRDROP);
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
  const paymentAmount = 1234500 + 1e5 + Number(options.extraPayment || 0);
  const owner = options.owner || addr2;
  const funder = options.funder || addr;
  const deadline = options.deadline
    ? Number(options.deadline)
    : moment().unix() + 60 * 60 * 24 * 7; // 7 days
  ci.setPaymentAmount(paymentAmount);
  ci.setFee(8000);
  const createR = await ci.create(owner, funder, deadline, initial);
  if (options.debug) {
    console.log(createR);
  }
  if (createR.success) {
    const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
    const apid = appCallTxn["inner-txns"][0]["application-index"];
    return apid;
  }
};
factory
  .command("deploy-airdrop")
  .description("Create an airdrop factory")
  .option("-a, --apid <number>", "Specify the application ID")
  .option("-o, --owner <string>", "Specify the owner address")
  .option("-f, --funder <string>", "Specify the funder address")
  .option("-d, --deadline <number>", "Specify the deadline")
  .option("--debug", "Debug the deployment", false)
  .requiredOption(
    "-i, --initial <number>",
    "Specify the initial airdrop amount"
  )
  .action(async (options: DeployAirdropOptions) => {
    const apid = await deployAirdrop(options);
    if (!apid) {
      console.log("Failed to deploy airdrop contract");
      return;
    }
    console.log(apid);
  });

// update all airdrop contracts

interface FactoryUpdateAirdropOptions {
  apid: number;
  delete: boolean;
  debug?: boolean;
}
factory
  .command("update-airdrop")
  .description("Update all airdrop contracts")
  .option("-a, --apid <number>", "Specify the application ID of factory")
  .option("-d --delete", "Delete the application")
  .option("--debug", "Debug the deployment", false)
  .action(async (options: FactoryUpdateAirdropOptions) => {
    if (options.debug) {
      console.log(options);
    }
    const parentId = options.apid || CTC_INFO_FACTORY_AIRDROP;
    const url = `https://arc72-idx.nautilus.sh/v1/scs/accounts?parentId=${parentId}&deleted=0`;
    const {
      data: { accounts },
    } = await axios.get(url);
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
        if (options.debug) {
          console.log(updateR);
        }
        if (updateR.success) {
          await signSendAndConfirm(updateR.txns, sk);
        }
      } catch (e) {
        console.log(e);
      }
    }
  });

interface DeployStakingOptions {
  apid: number;
  amount: number;
  owner?: string;
  funder?: string;
  delegate?: string;
  period?: number;
  extraPayment?: number;
  debug?: boolean;
}
export const deployStaking: any = async (options: DeployStakingOptions) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid || CTC_INFO_FACTORY_STAKING);
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
  const paymentAmount =
    stakingAmount + 1234500 + 1e5 + Number(options.extraPayment || 0);
  const owner = options.owner || addr2;
  const funder = options.funder || addr;
  const delegate = options.delegate || addr3;
  const period = Number(options.period || 0);
  ci.setPaymentAmount(paymentAmount);
  ci.setFee(10000);
  const createR = await ci.create(owner, funder, delegate, period);
  if (options.debug) {
    console.log(options);
    console.log(createR);
  }
  if (createR.success) {
    const [, appCallTxn] = await signSendAndConfirm(createR.txns, sk);
    const apid = appCallTxn["inner-txns"][0]["application-index"];
    return apid;
  }
};
factory
  .command("deploy-staking")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .requiredOption("-b, --amount <number>", "Specify the amount for staking")
  .requiredOption("-p, --period <number>", "Specify the lockup period")
  .option("--debug", "Debug the deployment", false)
  .description("Create a staking contract")
  .action(async (options: DeployStakingOptions) => {
    const apid = await deployStaking(options);
    if (!apid) { 
      return;
    }
    console.log(apid);
  });

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

const airdrop = new Command("airdrop").description("Manage airdrop operations");

interface AirdropApproveUpdateOptions {
  apid: number;
  approval: boolean;
  simulate?: boolean;
  sender?: string;
}
export const airdropApproveUpdate: any = async (
  options: AirdropApproveUpdateOptions
) => {
  const ci = makeCi(options.apid, options.sender || addr2);
  const approveR = await ci.approve_update(options.approval);
  if (approveR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(approveR.txns, sk2);
    }
    return true;
  }
  return false;
};

interface AirdropGrantFunderOptions {
  apid: number;
  receiver: string;
  sender?: string;
  sk?: any;
  simulate?: boolean;
}
export const airdropGrantFunder: any = async (
  options: AirdropGrantFunderOptions
) => {
  const ci = makeCi(options.apid, options.sender || addr);
  const grantR = await ci.grant_funder(options.receiver || addr2);
  if (grantR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(grantR.txns, options.sk || sk);
    }
    return true;
  }
  return false;
};

interface AirdropTransferOptions {
  apid: number;
  receiver: number;
  sender?: string;
  sk?: any;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropTransfer: any = async (options: AirdropTransferOptions) => {
  if(options.debug) {
    console.log(options);
  }
  const ci = makeCi(options.apid, options.sender || addr2);
  const transferR = await ci.transfer(options.receiver || addr);
  if(options.debug) {
    console.log(transferR);
  }
  if (transferR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(transferR.txns, options.sk || sk2);
    }
    return true;
  }
  return false;
};

interface AirdropSetDelegateOptions {
  apid: number;
  delegate: string;
  simulate?: boolean;
  sender?: string;
}
export const airdropSetDelegate = async (
  options: AirdropSetDelegateOptions
) => {
  const ci = makeCi(options.apid, options.sender || addr2);
  const setDelegateR = await ci.set_delegate(options.delegate || addr);
  if (setDelegateR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(setDelegateR.txns, sk2);
    }
    return true;
  }
  return false;
};

interface AirdropSetVersionOptions {
  apid: number;
  contractVersion: number;
  deploymentVersion: number;
  sender?: string;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropSetVersion = async (options: AirdropSetVersionOptions) => {
  const ci = makeCi(options.apid, options?.sender || addr);
  const setVersionR = await ci.set_version(
    options.contractVersion,
    options.deploymentVersion
  );
  if (options.debug) {
    console.log(options);
    console.log(setVersionR);
  }
  if (setVersionR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(setVersionR.txns, sk);
    }
    return true;
  }
  return false;
};

interface AirdropGetStateOptions {
  apid: number;
  name?: string;
  lazy?: boolean;
}
export const airdropGetState: any = async (options: AirdropGetStateOptions) => {
  const globalState = await new AirdropClient(
    { resolveBy: "id", id: Number(options.apid) },
    algodClient
  ).getGlobalState();
  if (options.lazy) {
    return { globalState };
  }
  const state = {
    contractVersion: globalState.contractVersion?.asNumber(),
    deadline: globalState.deadline?.asNumber(),
    delegate: algosdk.encodeAddress(
      globalState.delegate?.asByteArray() || new Uint8Array()
    ),
    deployer: algosdk.encodeAddress(
      globalState.deployer?.asByteArray() || new Uint8Array()
    ),
    deploymentVersion: globalState.deploymentVersion?.asNumber(),
    distributionCount: globalState.distributionCount?.asNumber(),
    distributionSeconds: globalState.distributionSeconds?.asNumber(),
    funder: algosdk.encodeAddress(
      globalState.funder?.asByteArray() || new Uint8Array()
    ),
    funding: globalState.funding?.asNumber(),
    initial: globalState.initial?.asBigInt().toString(),
    lockupDelay: globalState.lockupDelay?.asNumber(),
    messengerId: globalState.messengerId?.asNumber(),
    owner: algosdk.encodeAddress(
      globalState.owner?.asByteArray() || new Uint8Array()
    ),
    parentId: globalState.parentId?.asNumber(),
    period: globalState.period?.asNumber(),
    periodLimit: globalState.periodLimit?.asNumber(),
    periodSeconds: globalState.periodSeconds?.asNumber(),
    stakeable: globalState.stakeable?.asNumber(),
    total: globalState.total?.asBigInt().toString(),
    updatable: globalState.updatable?.asNumber(),
    upgrader: algosdk.encodeAddress(
      globalState.upgrader?.asByteArray() || new Uint8Array()
    ),
    vestingDelay: globalState.vestingDelay?.asNumber(),
  };
  return state;
};
airdrop
  .command("get")
  .description("Get the state of the airdrop contract")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .action(airdropGetState);

airdrop
  .command("list")
  .description("List all airdrop contracts")
  .action(async () => {
    const {
      data: { accounts },
    } = await axios.get(
      `https://arc72-idx.nautilus.sh/v1/scs/accounts?parentId=${CTC_INFO_FACTORY_AIRDROP}&deleted=0`
    );
    for await (const account of accounts) {
      console.log(account);
    }
  });

interface AirdropReduceTotalOptions {
  apid: number;
  amount: number;
  simulate?: boolean;
  sender?: string;
}
export const airdropReduceTotal: any = async (
  options: AirdropReduceTotalOptions
) => {
  const ci = makeCi(Number(options.apid), options.sender || addr);
  const reduceR = await ci.reduce_total(Number(options.amount) * 1e6);
  if (reduceR.success) {
    await signSendAndConfirm(reduceR.txns, sk);
    return true;
  }
  return false;
};
airdrop
  .command("reduce-total <amount>")
  .requiredOption("-a, --amount <number>", "Specify the amount to reduce")
  .action(airdropReduceTotal);

interface AirdropAbortFundingOptions {
  apid: number;
  simulate?: boolean;
  sender?: string;
  debug?: boolean;
}
export const airdropAbortFunding: any = async (
  options: AirdropAbortFundingOptions
) => {
  const ci = makeCi(Number(options.apid), options.sender || addr);
  ci.setFee(3000);
  ci.setOnComplete(5); // deleteApplicationOC
  const abortR = await ci.abort_funding();
  if (options.debug) {
    console.log(options);
    console.log(abortR);
  }
  if (abortR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(abortR.txns, sk);
    }
    return true;
  }
  return false;
};
airdrop
  .command("abort-funding")
  .description("Abort funding for the airdrop")
  .option("-a, --apid <number>", "Specify the application ID")
  .action(airdropAbortFunding);

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
interface AirdropConfigureOptions {
  apid: number;
  period: number;
  sender?: string;
  sk?: any;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropConfigure: any = async (
  options: AirdropConfigureOptions
) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid);
  const period = Number(options.period || 0);
  const ci = makeCi(ctcInfo, options.sender || addr2);
  const configureR = await ci.configure(period);
  if (options.debug) {
    console.log(configureR);
  }
  if (configureR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(configureR.txns, options.sk || sk2);
    }
    return true;
  }
  return false;
};
airdrop
  .command("configure")
  .description("Configure the lockup period")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .option("-p, --period <number>", "Specify the lockup period")
  .option("--debug", "Debug the deployment", false)
  .action(airdropConfigure);

interface AirdropFillOptions {
  apid: number;
  amount: number;
  simulate?: boolean;
  timestamp?: number;
  sender?: string;
  sk?: any;
  debug?: boolean;
}
export const airdropFill: any = async (options: AirdropFillOptions) => {
  if (options.debug) {
    console.log(options);
  }
  const timestamp = Number(options.timestamp || 0);
  if (timestamp <= 0) {
    const ci = makeCi(Number(options.apid), options.sender || addr);
    const paymentAmount = Number(options.amount) * 1e6;
    ci.setPaymentAmount(paymentAmount);
    const fillR = await ci.fill();
    if (options.debug) {
      console.log(fillR);
    }
    if (fillR.success) {
      if (!options.simulate) {
        await signSendAndConfirm(fillR.txns, options.sk || sk);
      }
      return true;
    }
    return false;
  } else {
    const ci = new CONTRACT(
      Number(options.apid),
      algodClient,
      indexerClient,
      abi.custom,
      {
        addr,
        sk: new Uint8Array(0),
      }
    );
    const builder = new CONTRACT(
      Number(options.apid),
      algodClient,
      indexerClient,
      makeSpec(AirdropSpec.contract.methods),
      {
        addr,
        sk: new Uint8Array(0),
      },
      true,
      false,
      true
    );
    const buildN = [];
    buildN.push({
      ...(await builder.fill()).obj,
      payment: Number(options.amount) * 1e6,
    });
    buildN.push({
      ...(await builder.set_funding(timestamp)).obj,
    });
    ci.setFee(1000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);
    const customR = await ci.custom();
    if (options.debug) {
      console.log(customR);
    }
    if (customR.success) {
      if (!options.simulate) {
        await signSendAndConfirm(customR.txns, sk);
      }
      return true;
    }
    return false;
  }
};
airdrop
  .command("fill")
  .description("Fill the staking contract")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .requiredOption("-f, --amount <number>", "Specify the amount to fill")
  .option("-s, --simulate", "Simulate the fill", false)
  .option("-g --timestamp <number>", "Funding timestamp")
  .option("--debug", "Debug the deployment", false)
  .action(airdropFill);

interface AirdropSetFundingOptions {
  apid: number;
  timestamp: number;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropSetFunding: any = async (
  options: AirdropSetFundingOptions
) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid);
  const timestamp = Number(options.timestamp || 0);
  const ci = makeCi(ctcInfo, addr);
  const set_fundingR = await ci.set_funding(timestamp);
  if (options.debug) {
    console.log(set_fundingR);
  }
  if (set_fundingR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(set_fundingR.txns, sk);
    }
    return true;
  }
  return false;
};
airdrop
  .command("set-funding")
  .description("Set the funding timestamp")
  .requiredOption("-a, --apid <number>", "Specify the application ID")
  .requiredOption("-t, --timestamp <number>", "Specify the timestamp")
  .option("--debug", "Debug the deployment", false)
  .action(airdropSetFunding);

interface AirdropParticipateOptions {
  apid: number;
  vote_k: Uint8Array[];
  sel_k: Uint8Array[];
  vote_fst: number;
  vote_lst: number;
  vote_kd: number;
  sp_key: Uint8Array[];
  sender?: string;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropParticipate: any = async (
  options: AirdropParticipateOptions
) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid);
  const ci = makeCi(ctcInfo, options.sender || addr2);
  ci.setPaymentAmount(1000);
  const participateR = await ci.participate(
    options.vote_k,
    options.sel_k,
    options.vote_fst,
    options.vote_lst,
    options.vote_kd,
    options.sp_key
  );
  if (options.debug) {
    console.log(options);
    console.log(participateR);
  }
  if (participateR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(participateR.txns, sk2);
    }
    return true;
  }
  return false;
};
airdrop
  .command("participate")
  .description("Participate in the airdrop")
  .option("-a, --apid <number>", "Specify the application ID")
  .option("-k, --vote-k <string>", "Specify the vote key")
  .option("-s, --sel-k <string>", "Specify the selection key")
  .option("-f, --vote-fst <number>", "Specify the vote first")
  .option("-l, --vote-lst <number>", "Specify the vote last")
  .option("-d, --vote-kd <number>", "Specify the vote key duration")
  .action(airdropParticipate);

interface AirdropDepositOptions {
  apid: number;
  amount: number;
  address?: string;
}
export const airdropDeposit = async (options: AirdropDepositOptions) => {
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: options.address || addr2,
    to: algosdk.getApplicationAddress(options.apid),
    amount: Number(options.amount) * 1e6,
    suggestedParams: await algodClient.getTransactionParams().do(),
  });
  const signedTxn = txn.signTxn(sk2);
  const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
  const result = await waitForConfirmation(algodClient, txId, 3);
  return !result["pool-error"];
};

interface AirdropWithdrawOptions {
  apid: number;
  amount: number;
  sender?: string;
  simulate?: boolean;
  debug?: boolean;
}
export const airdropWithdraw: any = async (options: AirdropWithdrawOptions) => {
  const ci = makeCi(Number(options.apid), options.sender || addr2);
  const withdrawAmount = Number(options.amount) * 1e6;
  ci.setFee(2000);
  const withdrawR = await ci.withdraw(withdrawAmount);
  if (options.debug) {
    console.log(options);
    console.log(withdrawR);
  }
  if (withdrawR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(withdrawR.txns, sk2);
    }
    return true;
  } else {
    return false;
  }
};

interface AirdropGetMbOptions {
  apid: number;
  address: string;
  debug?: boolean;
}
export const airdropGetMb: any = async (options: AirdropGetMbOptions) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid);
  const ci = makeCi(ctcInfo, options.address || addr2);
  ci.setFee(2000);
  const withdrawR = await ci.withdraw(0);
  if (options.debug) {
    console.log(withdrawR);
  }
  if (withdrawR.success) {
    const withdraw = withdrawR.returnValue;
    return withdraw.toString();
  } else {
    return "0";
  }
};
airdrop
  .command("get-mb")
  .description("Simulate owner's withdrawal and log 'mab' value")
  .option("-a, --apid <number>", "Specify the application ID")
  .option("-d, --address <string>", "Specify the address")
  .option("--debug", "Debug the deployment", false)
  .action(async (options: AirdropGetMbOptions) => {
    const mab = await airdropGetMb(options);
    console.log(mab);
  });

interface AirdropCloseOptions {
  apid: number;
  simulate?: boolean;
  sender?: string;
  debug?: boolean;
}
export const airdropClose: any = async (options: AirdropCloseOptions) => {
  if (options.debug) {
    console.log(options);
  }
  const ctcInfo = Number(options.apid);
  const ci = makeCi(ctcInfo, options.sender || addr);
  ci.setFee(3000);
  ci.setOnComplete(5); // deleteApplicationOC
  const closeR = await ci.close();
  if (options.debug) {
    console.log(closeR);
  }
  if (closeR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(closeR.txns, sk);
    }
    return true;
  }
  return false;
};
airdrop
  .command("close")
  .description("Close the airdrop contract")
  .option("-a, --apid <number>", "Specify the application ID")
  .option("-s, --simulate", "Simulate the close", false)
  .option("-d --debug", "Debug the close")
  .option("t --sender <string>", "Specify the sender")
  .action(airdropClose);

const app = new Command("app").description("Manage app operations");

interface AppUpdateOptions {
  apid: number;
  delete: boolean;
  simulate?: boolean;
  sender?: string;
}
export const updateApp: any = async (options: AppUpdateOptions) => {
  const apid = Number(options.apid);
  const ci = makeCi(apid, options.sender || addr);
  ci.setFee(3000);
  if (options.delete) {
    ci.setOnComplete(5); // deleteApplicationOC
  }
  const updateR = await ci.update();
  if (updateR.success) {
    if (!options.simulate) {
      await signSendAndConfirm(updateR.txns, sk);
    }
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
