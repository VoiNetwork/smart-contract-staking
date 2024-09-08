import { expect } from "chai";
import {
  addressses,
  airdropAbortFunding,
  airdropConfigure,
  airdropDeposit,
  airdropFill,
  airdropGetMb,
  airdropGetState,
  airdropGrantFunder,
  airdropParticipate,
  airdropReduceTotal,
  airdropSetDelegate,
  airdropSetFunding,
  airdropSetVersion,
  airdropTransfer,
  airdropWithdraw,
  deploy,
  deployAirdrop,
  getApplicationAvailableBalance,
  updateApp,
} from "../command.js";
import moment from "moment";

const baseFixtureData = {
  apps: {
    airdropFactory: 1,
    airdrop: 1,
    airdrop2: 1,
  },
  context: {
    deadline: 1,
  },
};

// Path : Ownable

describe("Ownable Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodSeconds: seconds,
      periodLimit: 5,
      vestingDelay: 1,
      lockupDelay: 12,
      messengerId: 1,
      distributionCount: 12,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(20, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
    };
  });
  after(async function () {
    // we use update to delete the app in this case
    // since it is not closed in the following tests
    await updateApp({
      apid: fixtureData.apps.airdrop,
      delete: true,
    });
    console.log("Happily ever after");
  });

  // anyone should not be able to transfer ownership

  it("ownable only owner should be able to transfer ownership", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropTransfer({
      apid: fixtureData.apps.airdrop,
      receiver: funder,
      sender: funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to transfer ownership

  it("ownable owner should be able to transfer ownership", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropTransfer({
      apid: fixtureData.apps.airdrop,
      receiver: funder,
    });
    const { owner } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(owner).to.be.a("string");
    expect(owner).to.be.eq(funder);
    //   emits OwnershipTransferred event
  });
});

// Path : Fundable

describe("Fundable Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodSeconds: seconds,
      periodLimit: 5,
      vestingDelay: 1,
      lockupDelay: 12,
      messengerId: 1,
      distributionCount: 12,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(20, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });
    const airdrop2 = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });

    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
      airdrop2,
    };
  });
  after(async function () {
    // we use update to delete the app in this case
    // since it is not closed in the following tests
    await updateApp({
      apid: fixtureData.apps.airdrop,
      delete: true,
    });
    await updateApp({
      apid: fixtureData.apps.airdrop2,
      delete: true,
    });
    console.log("Happily ever after");
  });

  // fill
  //   only funder
  //   require payment
  //   emits Filled event
  //   sets total

  it("fundable anyone should not be able to fill", async function () {
    const { owner } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      sender: owner,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable funder should be able to fill", async function () {
    // require payment
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits Filled event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(total).to.be.a("string");
    expect(total).to.be.eq(String(1e6));
  });

  // funder may fill additional amount

  it("fundable funder may fill additional amount", async function () {
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // set funding
  //   only funder
  //   must be uninitialized or in future
  //   emits FundingSet event
  //   sets funding

  // funder should be able to set funding and fill

  it("fundable funder should be able to set funding and fill", async function () {
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      timestamp: moment().add(10, "seconds").unix(),
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // reduce total
  //   only funder
  //   must be initialized
  //   emits TotalReduced event
  //   sets total

  it("fundable anyone should not be able to reduce total", async function () {
    const success = await airdropReduceTotal({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable funder should not be able to reduce total over", async function () {
    const { total: totalBefore } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropReduceTotal({
      apid: fixtureData.apps.airdrop,
      amount: Number(totalBefore) / 1e6 + 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable funder should be able to reduce total", async function () {
    const { total: totalBefore } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropReduceTotal({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    const { total: totalAfter } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits TotalReduced event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(totalAfter).to.be.a("string");
    expect(totalAfter).to.be.eq(String(Number(totalBefore) - 1e6));
  });

  // grant funder
  //   only funder
  //   emits FunderGranted event
  //   sets funder

  it("fundable anyone should not be able to grant funder", async function () {
    const { owner } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropGrantFunder({
      apid: fixtureData.apps.airdrop,
      receiver: owner,
      sender: owner,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable funder should be able to grant funder", async function () {
    const { owner } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropGrantFunder({
      apid: fixtureData.apps.airdrop,
      receiver: owner,
    });
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits FunderGranted event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(funder).to.be.a("string");
    expect(funder).to.be.eq(owner);
  });

  // abort funding
  //  only funder
  //  must be uninitialized
  //  emits Closed event

  it("fundable anyone should not be able to abort funding", async function () {
    const success = await airdropAbortFunding({
      apid: fixtureData.apps.airdrop2,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable funder should be able to abort funding", async function () {
    const success = await airdropAbortFunding({
      apid: fixtureData.apps.airdrop2,
    });
    // emits Closed event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });
});

// Path : Lockable

describe("Lockable Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodSeconds: seconds,
      periodLimit: 5,
      vestingDelay: 1,
      lockupDelay: 12,
      messengerId: 1,
      distributionCount: 12,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(20, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
    };
  });
  after(async function () {
    // we use update to delete the app in this case
    // since it is not closed in the following tests
    await updateApp({
      apid: fixtureData.apps.airdrop,
      delete: true,
    });
    console.log("Happily ever after");
  });
});

// Path : AirDrop

describe("Airdrop Test Suite", function () {
  // airdrop may not be launched without factory
});

// Path : Airdrop Factory

describe("Airdrop Factory Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodSeconds: seconds,
      periodLimit: 5,
      vestingDelay: 1,
      lockupDelay: 12,
      messengerId: 1,
      distributionCount: 12,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(20, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
    };
  });
  // cleanup after tests esp airdrop
  // upgrader should be able to update app
  after(async function () {
    // we use update to delete the app in this case
    // since it is not closed in the following tests
    await updateApp({
      apid: fixtureData.apps.airdrop,
      delete: true,
    });
    console.log("Happily ever after");
  });

  // should have apps available

  it("airdrop and factory apps should be available", function () {
    expect(fixtureData.apps.airdrop).to.be.a("number");
    expect(fixtureData.apps.airdropFactory).to.be.a("number");
  });

  // should be initialized with correct values

  it("airdrop should be initialized with correct values", async function () {
    const state = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(state).to.be.an("object");
    expect(state.total).to.be.a("string");
    expect(state.total).to.be.eq("0");
    expect(state.funding).to.be.a("number");
    expect(state.funding).to.be.eq(0);
    expect(state.vestingDelay).to.be.a("number");
    expect(state.vestingDelay).to.be.eq(0);
    expect(state.lockupDelay).to.be.a("number");
    expect(state.lockupDelay).to.be.eq(12);
    expect(state.deadline).to.be.a("number");
    expect(state.deadline).to.be.eq(fixtureData.context.deadline);
    expect(state.period).to.be.a("number");
    expect(state.period).to.be.eq(0);
    expect(state.periodSeconds).to.be.a("number");
    expect(state.periodSeconds).to.be.eq(1);
    expect(state.periodLimit).to.be.a("number");
    expect(state.periodLimit).to.be.eq(5);
    expect(state.messengerId).to.be.a("number");
    expect(state.messengerId).to.be.eq(1);
    expect(state.distributionCount).to.be.a("number");
    expect(state.distributionCount).to.be.eq(12);
    expect(state.distributionSeconds).to.be.a("number");
    expect(state.distributionSeconds).to.be.eq(1);
    expect(state.contractVersion).to.be.a("number");
    expect(state.contractVersion).to.be.eq(0);
    expect(state.deploymentVersion).to.be.a("number");
    expect(state.deploymentVersion).to.be.eq(0);
    expect(state.owner).not.to.be.a(state.funder);
  });

  // upgrader should be able to set version

  it("airdrop upgrader should be able to set version", async function () {
    const success = await airdropSetVersion({
      apid: fixtureData.apps.airdrop,
      contractVersion: 999,
      deploymentVersion: 1,
    });
    const state = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(state.contractVersion).to.be.a("number");
    expect(state.contractVersion).to.be.eq(999);
    expect(state.deploymentVersion).to.be.a("number");
    expect(state.deploymentVersion).to.be.eq(1);
  });

  // anyone should not be able to configure airdrop

  it("airdrop should only be configurable by owner", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should not be able to configure airdrop beyond limit

  it("airdrop should not be configurable beyond limit", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 6,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to configure airdrop before deadline

  it("airdrop should be configurable before deadline", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
    });
    const { period } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(period).to.be.a("number");
    expect(period).to.be.eq(1);
  });

  // confure should emit Configured event

  it("airdrop should emit Configured event", async function () {});

  // owner should not be able to configure airdrop after deadline

  it("airdrop should not be configurable after deadline", async function () {
    while (moment().unix() < fixtureData.context.deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    try {
      await airdropConfigure({
        apid: fixtureData.apps.airdrop,
        period: 1,
      });
    } catch (err) {
      const regex =
        /transaction [^:]*. logic eval error: assert failed pc=[0-9]+\. Details: app=[0-9]+, pc=[0-9]+, opcodes=.*LatestTimestamp.*assert/;
      expect(err.message).to.match(regex);
    }
  });

  // owner mb should be equal to available balance (0)

  it("airdrop owner mb should be equal to available balance (0)", async function () {
    const mb = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    expect(mb).to.be.a("string");
    expect(mb).to.be.eq("0");
  });

  // owner should be able to withdraw (0)

  it("airdrop owner should be able to withdraw (0)", async function () {
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 0,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner mb should be equal to total

  it("airdrop owner mb should be equal to total before funding", async function () {
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const mb = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    expect(mb).to.be.a("string");
    expect(mb).to.be.eq(total);
  });

  // owner should be able to deposit

  it("airdrop owner should be able to deposit", async function () {
    const success = await airdropDeposit({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should not be able to withdraw over

  it("airdrop owner should not be able to withdraw over", async function () {
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 2,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to withdraw (1)

  it("airdrop owner should be able to withdraw", async function () {
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should be able to participate

  it("airdrop owner should be able to participate", async function () {
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      vote_k: new Uint8Array(
        Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")
      ),
      sel_k: new Uint8Array(
        Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")
      ),
      vote_fst: 9_777_253,
      vote_lst: 9_777_253 + 1e6,
      vote_kd: 1733,
      sp_key: new Uint8Array(
        Buffer.from(
          "FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==",
          "base64"
        )
      ),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should be able to participate (non-participation)

  it("airdrop owner should be able to participate (non-participation)", async function () {
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      amount: 0,
      vote_k: new Uint8Array(32),
      sel_k: new Uint8Array(32),
      vote_fst: 0,
      vote_lst: 0,
      vote_kd: 0,
      sp_key: new Uint8Array(64),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // anyone should not be able to participate

  it("airdrop anyone should not be able to participate", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      vote_k: new Uint8Array(
        Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")
      ),
      sel_k: new Uint8Array(
        Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")
      ),
      vote_fst: 9_777_253,
      vote_lst: 9_777_253 + 1e6,
      vote_kd: 1733,
      sp_key: new Uint8Array(
        Buffer.from(
          "FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==",
          "base64"
        )
      ),
      sender: funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // anyone should not be able to set delegate

  it("airdrop only owner should be able to set delegate", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropSetDelegate({
      apid: fixtureData.apps.airdrop,
      sender: funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to set delegate

  it("airdrop owner should be able to set delegate", async function () {
    const success = await airdropSetDelegate({
      apid: fixtureData.apps.airdrop,
    });
    const { funder, delegate } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(delegate).to.be.a("string");
    expect(delegate).to.be.eq(funder);
  });

  // set delegate should emit DelegateUpdated event

  it("airdrop should emit DelegateUpdated event", async function () {});

  // delegate should be able to participate

  it("airdrop delegate should be able to participate", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      vote_k: new Uint8Array(
        Buffer.from("rqzFOfwFPvMCkVxk/NKgj8idbwrsEGwxDbQwmHwtACE=", "base64")
      ),
      sel_k: new Uint8Array(
        Buffer.from("oxigRtYVOHpCD/qldT814sPYeQGzgUfjBOpbD3NHv0Y=", "base64")
      ),
      vote_fst: 9_777_253,
      vote_lst: 9_777_253 + 1e6,
      vote_kd: 1733,
      sp_key: new Uint8Array(
        Buffer.from(
          "FxHMlnefM+QUzFEi9jF4moujCSs9iFYPyUX0+yvJgoMmXxTZfFd5Wus2InMW/FAP+mXSeZqBrezUdx88q0VTpw==",
          "base64"
        )
      ),
      sender: funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should be able to abort funding
  //   closed offline to owner
  //   emits Closed event

  it("airdrop owner should be able to abort funding", async function () {});

  // funder should be able to reduce total

  it("airdrop funder should be able to reduce total (simulate)", async function () {
    const success = await airdropReduceTotal({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // funder should be able to set funding

  it("airdrop funder should be able to set funding (simulate)", async function () {
    const success = await airdropSetFunding({
      apid: fixtureData.apps.airdrop,
      timestamp: moment().add(10, "seconds").unix(),
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner mb should be equal to total after funding

  it("airdrop owner mb should be equal to total after funding", async function () {
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const mb = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    expect(mb).to.be.a("string");
    expect(mb).to.be.eq(total);
  });

  // funder may extend funding if not in past

  it("airdrop funder may extend funding if not in past", async function () {
    const success = await airdropSetFunding({
      apid: fixtureData.apps.airdrop,
      timestamp: moment().add(10, "seconds").unix(),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner mb while vesting should be between 0 and total

  it("airdrop owner mb while vesting should be between 0 and total", async function () {
    const { total, funding, lockupDelay, periodSeconds } =
      await airdropGetState({
        apid: fixtureData.apps.airdrop,
      });
    while (moment().unix() < funding + lockupDelay * periodSeconds) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const mab = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    expect(mab).to.be.a("string");
    expect(Number(mab)).to.be.greaterThanOrEqual(0);
    expect(Number(mab)).to.be.lessThanOrEqual(Number(total));
  });

  // funder may not extend funding if not in past

  it("airdrop funder may not extend funding if not in past", async function () {
    const success = await airdropSetFunding({
      apid: fixtureData.apps.airdrop,
      timestamp: moment().add(-10, "seconds").unix(),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to withdraw unlocked tokens during vesting

  it("airdrop owner should be able to withdraw unlocked tokens during vesting", async function () {
    const { total, funding, lockupDelay, periodSeconds } =
      await airdropGetState({
        apid: fixtureData.apps.airdrop,
      });
    const mab = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    const unlockedTokenAmount = Number(total) - Number(mab);
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: unlockedTokenAmount / 1e6,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner mb should be equal to 0 after vesting

  it("airdrop owner mb should be equal to 0 after vesting", async function () {
    const {
      funding,
      lockupDelay,
      periodSeconds,
      distributionCount,
      distributionSeconds,
    } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    while (
      moment().unix() <
      funding +
        lockupDelay * periodSeconds +
        distributionCount * distributionSeconds
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const mb = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    expect(mb).to.be.a("string");
    expect(mb).to.be.eq("0");
  });

  // owner should be able to withdraw all tokens after vesting:0

  it("airdrop owner should be able to withdraw all tokens after vesting", async function () {
    const availableBalance = await getApplicationAvailableBalance(
      fixtureData.apps.airdrop
    );
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: Number(availableBalance) / 1e6,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // anyone should not be able to close contract

  // owner should be able to close contract after vesting

  // funder should be able to close contract after vesting
});

// Path : Staking Factory

describe("Staking Factory Test Suite", function () {});

// Path : Compensation Factory

describe("Compensation Factory Test Suite", function () {});
