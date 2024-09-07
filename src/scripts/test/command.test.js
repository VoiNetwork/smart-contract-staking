import { expect } from "chai";
import {
  airdropConfigure,
  airdropFill,
  airdropGetState,
  airdropReduceTotal,
  airdropSetFunding,
  deploy,
  deployAirdrop,
  updateApp,
} from "../command.js";
import moment from "moment";

const baseFixtureData = {
  apps: {
    airdropFactory: 1,
    airdrop: 1,
  },
  context: {
    deadline: 1,
  },
};

// Path 1: Airdrop Program : Happy Path

describe("Test Suite with External Fixtures", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;

  // creator should be able to call template before setup (only callable by factory)

  // creator should be able to setup airdrop (only callable once by factory)

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
    const deadline = moment().add(15, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      extraPayment: 1e5, // pay min balance once
      deadline,
    });
    // TODO add global state to fixture data
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
    };
  });

  // cleanup after tests esp airdrop

  // upgrader should be able to update app

  after(async function () {
    console.log("Cleaning apps...");
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
    expect(state.owner).not.to.be.a(state.funder);
  });

  // upgrader should be able to set version

  it("airdrop upgrader should be able to set version", async function () {
    // not yet implemented
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
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    const { period } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(period).to.be.a("number");
    expect(period).to.be.eq(1);
  });

  // confure should emit Configured event

  it("airdrop should emit Configured event", async function () {
    // not yet implemented
  });

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
    // expect period to be 1
  });

  // owner should be able to withdraw

  // owner should be able to deposit

  // owner should be able to participate

  // owner should be able to participate (non-participation)

  // owner should be able to set delegate

  // funder should be able to fill

  it("airdrop funder should be able to fill", async function () {
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

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

  // funder should be able to set funding and fill

  it("airdrop should be fundable", async function () {
    // not yet implemented
  });

  // funder may extend funding if not in past

  // funder may fill additional amount

  // owner should not be able to configure after funding

  // owner should be able to withdraw unlocked tokens during vesting

  // owner should be able to withdraw all tokens after vesting

  // owner should be able to transfer ownership

  // funder should be able to grant new funder

  // [Note] no longer have ownership of contract

  // [Note] no longer have funder role
});

// Path 2(A): Abort funding

// owner should be able to abort funding

// Path 2(B): Abort funding

// funder should be able to abort funding

// Path 3(A): Close contract as owner

// owner should be able to close contract after vesting

// Path 3(B): Close contract as funder

// funder should be able to close contract after vesting
