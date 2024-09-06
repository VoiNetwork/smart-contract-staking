import { expect } from "chai";
import {
  airdropConfigure,
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
    const deadline = moment().add(10, "seconds").unix();
    const airdrop = await deployAirdrop({
      initial: 1e6,
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

  it("apps should be available", function () {
    expect(fixtureData.apps.airdrop).to.be.a("number");
    expect(fixtureData.apps.airdropFactory).to.be.a("number");
  });

  // upgrader should be able to set version

  // owner should be able to configure airdrop before deadline

  it("airdrop should be configurable before deadline", async function () {
    // expect it to fail if not called by owner
    // expect period to be 0
    // expect it to succeed
    const success = await airdropConfigure(fixtureData.apps.airdrop, 1);
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    // expect period to be 1
  });

  // owner should not be able to configure airdrop after deadline

  it("airdrop should not be configurable after deadline", async function () {
    // expect period to be 1
    while (moment().unix() <= fixtureData.context.deadline) {
      console.log(`${moment().unix()} <= ${fixtureData.context.deadline}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // expect it to fail
    try {
      await airdropConfigure(fixtureData.apps.airdrop, 1);
    } catch (err) {
      expect(err.message).to.match(/Transaction Rejected/);
    }
    // expect period to be 1
  });

  // owner should be able to withdraw

  // owner should be able to deposit

  // owner should be able to participate

  // owner should be able to participate (non-participation)

  // owner should be able to set delegate 

  // funder should be able to fill 

  // funder should be able to reduce total

  // funder should be able to set funding and fill

  it("airdrop should be fundable", async function () {
    // not yet implemented
  });

  // funder may extend funding if not in past

  // funder may fill additional amount

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
