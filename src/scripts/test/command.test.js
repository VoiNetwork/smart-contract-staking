import { expect } from "chai";
import {
  addressses,
  airdropAbortFunding,
  airdropApproveUpdate,
  airdropClose,
  airdropConfigure,
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
  deployStaking,
  deployCompensation,
  getApplicationAvailableBalance,
  getBalance,
  updateApp,
  sks,
  getAvailableBalance,
} from "../command.js";
import moment from "moment";
import algosdk from "algosdk";

const baseFixtureData = {
  apps: {
    airdropFactory: 1,
    airdropFactory2: 1,
    airdrop: 1,
    airdrop2: 1,
    airdrop3: 1,
    appSeries: [],
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
    const deadline = moment().add(60, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
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

  it("ownable creator should not be able to transfer ownership", async function () {
    const creator = algosdk.getApplicationAddress(
      fixtureData.apps.airdropFactory
    );
    const success = await airdropTransfer({
      apid: fixtureData.apps.airdrop,
      receiver: creator,
      sender: creator,
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
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
    const { funder, owner: ownerBefore } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const success = await airdropTransfer({
      apid: fixtureData.apps.airdrop,
      receiver: funder,
      sender: ownerBefore,
    });
    const { owner } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(owner).to.be.a("string");
    expect(owner).to.be.eq(funder);
    //   emits OwnershipTransferred event

    const success2 = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: funder,
      sk: sks.funder,
    });
    expect(success2).to.be.a("boolean");
    expect(success2).to.be.eq(true);

    const success3 = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: ownerBefore,
      sk: sks.owner,
    });
    expect(success3).to.be.a("boolean");
    expect(success3).to.be.eq(false);

    // transfer from funder to creator

    const success4 = await airdropTransfer({
      apid: fixtureData.apps.airdrop,
      receiver: algosdk.getApplicationAddress(fixtureData.apps.airdropFactory),
      sender: funder,
      sk: sks.funder,
    });
    expect(success4).to.be.a("boolean");
    expect(success4).to.be.eq(true);

    const success5 = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: algosdk.getApplicationAddress(fixtureData.apps.airdropFactory),
      simulate: true,
      debug: true,
    });
    expect(success5).to.be.a("boolean");
    expect(success5).to.be.eq(true);
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
      periodLimit: 2,
      vestingDelay: 1,
      lockupDelay: 2,
      messengerId: 1,
      distributionCount: 2,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(20, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });
    const airdrop2 = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });
    const airdrop3 = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });

    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
      airdrop2,
      airdrop3,
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

  it("fundable creator should not be able to fill", async function () {
    const creator = algosdk.getApplicationAddress(
      fixtureData.apps.airdropFactory
    );
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      sender: creator,
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  it("fundable owner should not be able to fill", async function () {
    const { owner, funder, delegate } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    console.log({ owner, funder, delegate });
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      sender: owner,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // guarded by overspend
  it("fundable account should not be able to fill over", async function () {
    const { funder } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    const availableBalance = await getAvailableBalance(funder);
    const success2 = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: availableBalance / 1e6 + 1,
      sender: addressses.funder,
      sk: sks.funder,
    });
    expect(success2).to.be.a("boolean");
    expect(success2).to.be.eq(false);
  });

  it("fundable funder should be able to fill", async function () {
    // require payment
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 2,
    });
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits Filled event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(total).to.be.a("string");
    expect(total).to.be.eq(String(2e6));
    const success2 = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: total / 1e6 + 1,
    });
    expect(success2).to.be.a("boolean");
    expect(success2).to.be.eq(false);
  });

  // funder may fill additional amount

  it("fundable funder may fill additional amount", async function () {
    const success = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 1,
      simulate: true,
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
      timestamp: moment().add(1, "seconds").unix(),
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

  it("fundable only funder should be able to reduce total", async function () {
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

  // funder may extend funding if not past

  it("fundable funder may extend funding if not past", async function () {
    const success = await airdropSetFunding({
      apid: fixtureData.apps.airdrop,
      timestamp: moment().add(1, "seconds").unix(),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // funder may not extend funding if in past

  it("fundable funder may not extend funding if in past", async function () {
    const { funding } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    while (moment().unix() < funding) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    try {
      await airdropSetFunding({
        apid: fixtureData.apps.airdrop,
        timestamp: moment().add(10, "seconds").unix(),
      });
    } catch (err) {
      //   assert failed pc=[0-9]+. Details: app=[0-9]+, pc=[0-9]+, opcodes=.*LatestTimestamp.*assert/;
      const regex =
        /transaction [^:]*. logic eval error: assert failed pc=[0-9]+\. Details: app=[0-9]+, pc=[0-9]+, opcodes=.*b label.*assert/;
      expect(err.message).to.match(regex);
    }
  });

  // grant funder
  //   only funder
  //   emits FunderGranted event
  //   sets funder

  it("fundable only funder should be able to grant funder", async function () {
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

  it("fundable only funder or owner should be able to abort funding", async function () {
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

  // grant funder to creator
  // call fill

  it("fundable creator should be able to grant funder and fill", async function () {
    // make creator funder
    const success = await airdropGrantFunder({
      apid: fixtureData.apps.airdrop3,
      receiver: algosdk.getApplicationAddress(fixtureData.apps.airdropFactory),
      sender: addressses.funder,
      sk: sks.funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    // fill
    const success2 = await airdropFill({
      apid: fixtureData.apps.airdrop3,
      amount: 1,
      sender: algosdk.getApplicationAddress(fixtureData.apps.airdropFactory),
      simulate: true,
    });
    expect(success2).to.be.a("boolean");
    expect(success2).to.be.eq(true);
  });
});

// Path : Lockable

describe("Lockable Test Suite", function () {
  this.timeout(120_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodSeconds: seconds,
      periodLimit: 2,
      vestingDelay: 1,
      lockupDelay: 2,
      messengerId: 1,
      distributionCount: 2,
      distributionSeconds: seconds,
    });
    const deadline = moment().add(25, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });
    const airdrop2 = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });
    const airdrop3 = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      //extraPayment: 1e5, // pay min balance once
      deadline,
    });
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdrop,
      airdrop2,
      airdrop3,
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

  // configure
  //   only owner
  //   must not be funded
  //   emits Configured event
  //   sets period

  it("lockable creator should not be able to configure", async function () {
    const creator = algosdk.getApplicationAddress(
      fixtureData.apps.airdropFactory
    );
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: creator,
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // anyone should not be able to configure

  it("lockable only owner should be able to configure", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      sender: addressses.delegate, // not owner
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to configure over

  it("lockable owner should not be able to configure over", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 6, // 6 > 2
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to configure

  it("lockable owner should be able to configure", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
      simulate: true,
    });
    // emits Configured event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should be able to configure more than once

  it("lockable owner should be able to configure more than once", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 2,
    });
    const { period } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(period).to.be.a("number");
    expect(period).to.be.eq(2);
  });

  // withdraw
  //  only owner
  //  emits Withdrawn event

  // owner should be able to withdraw before funding

  // owner should be able to withdraw after funding

  it("lockable owner should be able to withdraw after funding (0)", async function () {
    // increase total to test withdraw
    const fillSuccess = await airdropFill({
      apid: fixtureData.apps.airdrop,
      amount: 3,
      timestamp: moment().add(1, "seconds").unix(),
    });
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 0,
    });
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits Withdrawn event
    expect(fillSuccess).to.be.a("boolean");
    expect(fillSuccess).to.be.eq(true);
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(total).to.be.a("string");
    expect(total).to.be.eq(String(3e6));
  });

  // owner should not be able to withdraw over

  it("lockable owner should not be able to withdraw over", async function () {
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 4,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to withdraw while vesting

  it("lockable owner should be able to withdraw while vesting", async function () {
    const { total } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    while (true) {
      const mab = await airdropGetMb({
        apid: fixtureData.apps.airdrop,
      });
      if (mab !== total) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const mab = await airdropGetMb({
      apid: fixtureData.apps.airdrop,
    });
    const withdrawAmount = Number(total) - Number(mab);
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: withdrawAmount / 1e6,
    });
    const remainingBalance = await getApplicationAvailableBalance(
      fixtureData.apps.airdrop
    );
    // emits Withdrawn event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(remainingBalance).to.be.eq(Number(mab));
  });

  // owner should be able to withdraw all after vesting

  it("lockable owner should be able to withdraw all after vesting", async function () {
    while (true) {
      const mab = await airdropGetMb({
        apid: fixtureData.apps.airdrop,
      });
      if (mab === "0") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const availableBalance = await getApplicationAvailableBalance(
      fixtureData.apps.airdrop
    );
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: availableBalance / 1e6,
    });
    const remainingBalance = await getApplicationAvailableBalance(
      fixtureData.apps.airdrop
    );
    expect(success, "withdraw success").to.be.a("boolean");
    expect(success, "withdraw success").to.be.eq(true);
    expect(remainingBalance, "remaining balance").to.be.eq(0);
  });

  // anyone should not be able to withdraw

  it("lockable only owner should be able to withdraw", async function () {
    const success = await airdropWithdraw({
      apid: fixtureData.apps.airdrop,
      amount: 0,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // close
  //  only funder
  //  must be funded
  //  must be fully vested
  //  emits Closed event

  // anyone should not be able to close

  it("lockable anyone should not be able to close", async function () {
    const success = await airdropAbortFunding({
      apid: fixtureData.apps.airdrop,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // funder should be able to close

  it("lockable funder should be able to close", async function () {
    const success = await airdropClose({
      apid: fixtureData.apps.airdrop,
      simulate: true,
    });
    // emits Closed event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // owner should not be able to configure after deadline

  it("lockable owner should not be able to configure after deadline", async function () {
    while (moment().unix() < fixtureData.context.deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    try {
      await airdropConfigure({
        apid: fixtureData.apps.airdrop,
        period: 1,
      });
    } catch (err) {
      //   assert failed pc=[0-9]+. Details: app=[0-9]+, pc=[0-9]+, opcodes=.*LatestTimestamp.*assert/;
      const regex =
        /transaction [^:]*. logic eval error: assert failed pc=[0-9]+\. Details: app=[0-9]+, pc=[0-9]+, opcodes=.*LatestTimestamp.*assert/;
      expect(err.message).to.match(regex);
    }
  });

  // TODO recover tests

  // owner should be able to close

  // it("lockable owner should be able to close", async function () {
  //   await airdropConfigure({
  //     apid: fixtureData.apps.airdrop2,
  //     period: 1,
  //   });
  //   await airdropFill({
  //     apid: fixtureData.apps.airdrop2,
  //     amount: 1,
  //     timestamp: moment().add(1, "seconds").unix(),
  //   });
  //   while (true) {
  //     const mab = await airdropGetMb({
  //       apid: fixtureData.apps.airdrop2,
  //     });
  //     if (mab === 0) {
  //       break;
  //     }
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //   }

  //   // ---

  //   const { owner } = await airdropGetState({
  //     apid: fixtureData.apps.airdrop2,
  //   });

  //   const contractBalance = await getAvailableBalance(
  //     algosdk.getApplicationAddress(fixtureData.apps.airdrop2)
  //   );
  //   const ownerBalance = await getBalance(owner);

  //   const expectedBalance = contractBalance + ownerBalance;

  //   const success = await airdropClose({
  //     apid: fixtureData.apps.airdrop2,
  //     sender: owner,
  //     sk: sks.owner,
  //     debug: true,
  //   });
  //   // emits Closed event
  //   expect(success).to.be.a("boolean");
  //   expect(success).to.be.eq(true);

  //   const ownerBalanceAfter = await getBalance(owner);

  //   expect(ownerBalanceAfter).to.be.eq(expectedBalance);
  // });

  // it("lockable funder should be able to close", async function () {
  //   await airdropConfigure({
  //     apid: fixtureData.apps.airdrop3,
  //     period: 1,
  //   });

  //   await airdropFill({
  //     apid: fixtureData.apps.airdrop3,
  //     amount: 1,
  //     timestamp: moment().add(1, "seconds").unix(),
  //   });

  //   while (true) {
  //     const mab = await airdropGetMb({
  //       apid: fixtureData.apps.airdrop3,
  //     });
  //     if (mab === 0) {
  //       break;
  //     }
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //   }

  //   // ---

  //   const { owner, funder } = await airdropGetState({
  //     apid: fixtureData.apps.airdrop3,
  //   });

  //   const contractBalance = await getAvailableBalance(
  //     algosdk.getApplicationAddress(fixtureData.apps.airdrop3)
  //   );
  //   const ownerBalance = await getBalance(owner);

  //   const expectedBalance = contractBalance + ownerBalance;

  //   const success = await airdropClose({
  //     apid: fixtureData.apps.airdrop3,
  //     sender: funder,
  //     sk: sks.funder,
  //     debug: true,
  //   });
  //   // emits Closed event
  //   expect(success).to.be.a("boolean");
  //   expect(success).to.be.eq(true);

  //   const ownerBalanceAfter = await getBalance(owner);

  //   expect(ownerBalanceAfter).to.be.eq(expectedBalance);
  // });
});

// Path : Stakeable

describe("Stakable Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    // | -------------------- | -------- |
    // | Variable Name        | Value    |
    // | -------------------- | -------- |
    // | PERIOD_LIMIT         | 2        |
    // | VESTING_DELAY        | 1        |
    // | LOCKUP_DELAY         | 1        |
    // | PERIOD_SECONDS       | 1        |
    // | MESSENGER_ID         | 1        |
    // | DISTRIBUTION_COUNT   | 2        |
    // | DISTRIBUTION_SECONDS | 1        |
    // | -------------------- | -------- |
    const seconds = 1;
    const airdropFactory = await deploy({
      name: "mocha",
      type: "airdrop-factory",
      periodLimit: 2,
      vestingDelay: 1,
      lockupDelay: 2,
      periodSeconds: seconds,
      messengerId: 1,
      distributionCount: 2,
      distributionSeconds: seconds,
    });
    // | -------------------- | -------- |
    // | Variable Name        | Value    |
    // | -------------------- | -------- |
    // | PERIOD_LIMIT         | 17       |
    // | VESTING_DELAY        | 1        |
    // | LOCKUP_DELAY         | 1        |
    // | PERIOD_SECONDS       | 2630000  |
    // | MESSENGER_ID         | 73060985 |
    // | DISTRIBUTION_COUNT   | 0        |
    // | DISTRIBUTION_SECONDS | 2630000  |
    // | -------------------- | -------- |
    const seconds2 = 2630000; // 1mo seconds
    const airdropFactory2 = await deploy({
      name: "mocha3",
      type: "airdrop-factory",
      periodLimit: 17,
      vestingDelay: 1,
      lockupDelay: 1,
      periodSeconds: seconds2,
      messengerId: 73060985,
      distributionCount: 0, // variable
      distributionSeconds: seconds2,
    });
    const deadline = moment().add(15, "seconds").unix();
    const airdrop = await deployAirdrop({
      apid: airdropFactory,
      initial: 1e6,
      deadline,
    });
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      airdropFactory2,
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
    await updateApp({
      apid: fixtureData.apps.airdrop2,
      delete: true,
    });
    console.log("Happily ever after");
  });
  // set_delegate
  //  only owner or creator
  //  emits DelegateUpdated event
  //  sets delegate

  // anyone should not be able to set delegate

  it("stakeable anyone should not be able to set delegate", async function () {
    const success = await airdropSetDelegate({
      apid: fixtureData.apps.airdrop,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to set delegate

  it("stakeable owner should be able to set delegate", async function () {
    const success = await airdropSetDelegate({
      apid: fixtureData.apps.airdrop,
      delegate: addressses.delegate,
    });
    const { delegate } = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    // emits DelegateUpdated event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
    expect(delegate).to.be.a("string");
    expect(delegate).to.be.eq(addressses.delegate);
  });

  // participate
  //  only owner or delegate
  //  emits Participated event

  // anyone should not be able to participate

  it("stakeable anyone should not be able to participate", async function () {
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      vote_k: new Uint8Array(32),
      sel_k: new Uint8Array(32),
      vote_fst: 0,
      vote_lst: 0,
      vote_kd: 0,
      sp_key: new Uint8Array(64),
      sender: addressses.funder,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to participate

  it("stakeable owner should be able to participate", async function () {
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
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
    // emits Participated event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // delegate should be able to participate

  it("stakeable delegate should be able to participate (non-participation)", async function () {
    const success = await airdropParticipate({
      apid: fixtureData.apps.airdrop,
      vote_k: new Uint8Array(32),
      sel_k: new Uint8Array(32),
      vote_fst: 0,
      vote_lst: 0,
      vote_kd: 0,
      sp_key: new Uint8Array(64),
      sender: addressses.delegate,
      simulate: true,
    });
    // emits Participated event
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // distribution count should be lockup period and at most 12

  it("stakeable distribution count should be lockup period and at most 12", async function () {
    const factory = fixtureData.apps.airdropFactory2;
    for await (const configPeriod of [...Array(18).keys()]) {
      const airdrop = await deployAirdrop({
        apid: factory,
        initial: 1e6,
        period: configPeriod,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { distributionCount, vestingDelay, lockupDelay, period } =
        await airdropGetState({
          apid: airdrop,
        });
      console.log({ distributionCount, vestingDelay, lockupDelay, period });
      /*
      expect(distributionCount).to.be.a("number");
      expect(distributionCount).to.be.eq(Math.min(12, period));
      expect(vestingDelay).to.be.a("number");
      expect(vestingDelay).to.be.eq(0);
      expect(period).to.be.a("number");
      expect(period).to.be.eq(configPeriod);
      */
    }
  });
});

// Path : Upgradeable

describe("Upgradeable Test Suite", function () {
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
      //extraPayment: 1e5, // pay min balance once
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

  // anyone should not be able to set version

  it("upgradeable anyone should not be able to set version", async function () {
    const success = await airdropSetVersion({
      apid: fixtureData.apps.airdrop,
      contractVersion: 999,
      deploymentVersion: 1,
      sender: addressses.delegate,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // upgrader should be able to set version

  it("upgradeable upgrader should be able to set version", async function () {
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

  // owner should be able to approve update (false)

  it("upgradeable owner should be able to approve update (false)", async function () {
    const success = await airdropApproveUpdate({
      apid: fixtureData.apps.airdrop,
      approval: false,
      debug: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });

  // upgrader may not update if not approved

  it("upgradeable upgrader may not update if not approved", async function () {
    const success = await updateApp({
      apid: fixtureData.apps.airdrop,
      update: true,
      simulate: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner should be able to approve update (true)

  it("upgradeable owner should be able to approve update (true)", async function () {
    const success = await airdropApproveUpdate({
      apid: fixtureData.apps.airdrop,
      approval: true,
      debug: true,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
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
      //extraPayment: 1e5, // pay min balance once
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
});

// Path : Staking Factory

describe("Staking Test Suite", function () {
  this.timeout(120_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    // | -------------------- | -------- |
    // | Variable Name        | Value    |
    // | -------------------- | -------- |
    // | PERIOD_LIMIT         | 17       |
    // | VESTING_DELAY        | 1        |
    // | LOCKUP_DELAY         | 1        |
    // | PERIOD_SECONDS       | 2630000  |
    // | MESSENGER_ID         | 73060985 |
    // | DISTRIBUTION_COUNT   | 0        |
    // | DISTRIBUTION_SECONDS | 2630000  |
    // | -------------------- | -------- |
    console.log("There was a factory...");
    const seconds = 2630000; // 1mo seconds
    const airdropFactory = await deploy({
      name: "mocha",
      type: "staking-factory",
      periodLimit: 17,
      vestingDelay: 1,
      lockupDelay: 1,
      periodSeconds: seconds,
      messengerId: 73060985,
      distributionCount: 0, // variable
      distributionSeconds: seconds,
    });
    process.stdout.write("There was an app series");
    const appSeries = [];
    for await (const configPeriod of [...Array(18).keys()]) {
      process.stdout.write(".");
      const airdrop = await deployStaking({
        apid: airdropFactory,
        amount: 1,
        period: configPeriod,
      });
      appSeries.push(airdrop);
    }
    console.log("");
    const deadline = moment().add(15, "seconds").unix();
    fixtureData.context.deadline = deadline;
    fixtureData.apps = {
      airdropFactory,
      appSeries,
    };
  });
  after(async function () {
    // we use update to delete the app in this case
    // since it is not closed in the following tests
    for await (const app of fixtureData.apps.appSeries) {
      console.log("Deleting app", app);
      await updateApp({
        apid: app,
        delete: true,
      });
    }
    console.log("Happily ever after");
  });

  // distribution count should be lockup period and at most 12

  it("staking distribution count should be lockup period and at most 12", async function () {
    for await (const app of fixtureData.apps.appSeries) {
      const { distributionCount, vestingDelay, lockupDelay, period } =
        await airdropGetState({
          apid: app,
        });
      expect(distributionCount).to.be.a("number");
      expect(distributionCount).to.be.eq(Math.min(12, period + 1));
      expect(vestingDelay).to.be.a("number");
      expect(vestingDelay).to.be.eq(1);
      expect(lockupDelay).to.be.a("number");
      expect(lockupDelay).to.be.eq(1);
      expect(period).to.be.a("number");
    }
  });
});

describe("Staking Factory Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    console.log("There was a factory...");
    const seconds = 1;
    const factory = await deploy({
      name: "mocha",
      type: "staking-factory",
      periodSeconds: seconds,
      periodLimit: 17,
      vestingDelay: 0,
      lockupDelay: 1,
      messengerId: 1,
      distributionCount: 1,
      distributionSeconds: seconds,
    });
    console.log("There was a staking contract...");
    const airdrop = await deployStaking({
      apid: factory,
      amount: 1,
      period: 17,
      delegate: addressses.delegate,
    });
    fixtureData.apps = {
      airdropFactory: factory,
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

  it("staking and factory apps should be available", function () {
    expect(fixtureData.apps.airdrop).to.be.a("number");
    expect(fixtureData.apps.airdropFactory).to.be.a("number");
  });

  // should be initialized with correct values

  it("staking should be initialized with correct values", async function () {
    const state = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(state).to.be.an("object");
    expect(state.total).to.be.a("string");
    expect(state.total).to.be.eq("1000000");
    expect(state.initial).to.be.a("string");
    expect(state.initial).to.be.eq("1000000");
    expect(state.funding).to.be.a("number");
    expect(state.funding).to.be.eq(0);
    expect(state.vestingDelay).to.be.a("number");
    expect(state.vestingDelay).to.be.eq(1);
    expect(state.lockupDelay).to.be.a("number");
    expect(state.lockupDelay).to.be.eq(1);
    expect(state.deadline).to.be.a("number");
    expect(state.deadline).to.be.greaterThan(1);
    expect(state.period).to.be.a("number");
    expect(state.period).to.be.eq(17);
    expect(state.periodSeconds).to.be.a("number");
    expect(state.periodSeconds).to.be.eq(1);
    expect(state.periodLimit).to.be.a("number");
    expect(state.periodLimit).to.be.eq(17);
    expect(state.messengerId).to.be.a("number");
    expect(state.messengerId).to.be.eq(1);
    expect(state.distributionCount).to.be.a("number");
    expect(state.distributionCount).to.be.eq(12); // variable
    expect(state.distributionSeconds).to.be.a("number");
    expect(state.distributionSeconds).to.be.eq(1);
    expect(state.contractVersion).to.be.a("number");
    expect(state.contractVersion).to.be.eq(0);
    expect(state.deploymentVersion).to.be.a("number");
    expect(state.deploymentVersion).to.be.eq(0);
    expect(state.owner).not.to.be.a(state.funder);
    expect(state.delegate).to.be.a("string");
    expect(state.delegate).to.be.eq(addressses.delegate);
  });

  // should not be able to configure

  it("staking should not be able to configure", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // owner is locked in and can either abort or wait for funding
  // to be begin the lockup and vesting process
});

// Path : Compensation Factory

describe("Compensation Factory Test Suite", function () {
  this.timeout(60_000);
  let fixtureData = baseFixtureData;
  before(async function () {
    console.log("Once upon a time...");
    const seconds = 1;
    const factory = await deploy({
      name: "mocha",
      type: "compensation-factory",
      periodSeconds: seconds,
      periodLimit: 0,
      vestingDelay: 0,
      lockupDelay: 0,
      messengerId: 1,
      distributionCount: 2,
      distributionSeconds: seconds,
    });
    const airdrop = await deployCompensation({
      apid: factory,
      amount: 1,
      //extraPayment: 1e5, // pay min balance once
      delegate: addressses.delegate,
    });
    fixtureData.apps = {
      airdropFactory: factory,
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

  it("compensation and factory apps should be available", function () {
    expect(fixtureData.apps.airdrop).to.be.a("number");
    expect(fixtureData.apps.airdropFactory).to.be.a("number");
  });

  // should be initialized with correct values

  it("compensation should be initialized with correct values", async function () {
    const state = await airdropGetState({
      apid: fixtureData.apps.airdrop,
    });
    expect(state).to.be.an("object");
    expect(state.total).to.be.a("string");
    expect(state.total).to.be.eq("1000000");
    expect(state.initial).to.be.a("string");
    expect(state.initial).to.be.eq("1000000");
    expect(state.funding).to.be.a("number");
    expect(state.funding).to.be.greaterThan(0);
    expect(state.vestingDelay).to.be.a("number");
    expect(state.vestingDelay).to.be.eq(0);
    expect(state.lockupDelay).to.be.a("number");
    expect(state.lockupDelay).to.be.eq(0);
    expect(state.deadline).to.be.a("number");
    expect(state.deadline).to.be.greaterThan(1);
    expect(state.period).to.be.a("number");
    expect(state.period).to.be.eq(0);
    expect(state.periodSeconds).to.be.a("number");
    expect(state.periodSeconds).to.be.eq(1);
    expect(state.periodLimit).to.be.a("number");
    expect(state.periodLimit).to.be.eq(0);
    expect(state.messengerId).to.be.a("number");
    expect(state.messengerId).to.be.eq(1);
    expect(state.distributionCount).to.be.a("number");
    expect(state.distributionCount).to.be.eq(2);
    expect(state.distributionSeconds).to.be.a("number");
    expect(state.distributionSeconds).to.be.eq(1);
    expect(state.contractVersion).to.be.a("number");
    expect(state.contractVersion).to.be.eq(0);
    expect(state.deploymentVersion).to.be.a("number");
    expect(state.deploymentVersion).to.be.eq(0);
    expect(state.owner).not.to.be.a(state.funder);
    expect(state.delegate).to.be.a("string");
    expect(state.delegate).to.be.eq(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ"
    );
  });

  // should not be able to configure

  it("compensation should not be able to configure", async function () {
    const success = await airdropConfigure({
      apid: fixtureData.apps.airdrop,
      period: 1,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // should not be able to set funding

  it("compensation should not be able to set funding", async function () {
    const success = await airdropSetFunding({
      apid: fixtureData.apps.airdrop,
      timestamp: moment().add(10, "seconds").unix(),
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(false);
  });

  // should be able to close after vested

  it("compensation should be able to close after vested", async function () {
    while (true) {
      const mab = await airdropGetMb({
        apid: fixtureData.apps.airdrop,
      });
      if (mab === "0") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const success = await airdropClose({
      apid: fixtureData.apps.airdrop,
      simulate: true,
      sender: addressses.owner,
    });
    expect(success).to.be.a("boolean");
    expect(success).to.be.eq(true);
  });
});
