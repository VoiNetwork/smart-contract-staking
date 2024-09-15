const period_limit = 18;

// Function to compute lockupMultiplier based on B2 (the current iteration number)
function computeLockupMultiplier(B2: number, R1: number) {
  if (B2 <= 12) {
    return 0.45 * Math.pow(B2 / R1, 2);
  } else {
    return Math.pow(B2 / R1, 2);
  }
}

function computeTimingMultiplier(week: number) {
  switch (week) {
    case 1:
      return 1;
    case 2:
      return 0.8;
    case 3:
      return 0.6;
    case 4:
      return 0.4;
    default:
      return 0;
  }
}

function computeRate(week: number, period: number) {
	const lockupMultiplier = computeLockupMultiplier(period, period_limit);
	const timingMultiplier = computeTimingMultiplier(week);
	return lockupMultiplier * timingMultiplier;
}

// Loop from 1 to 18 to compute lockupMultiplier for each value of B2
// for (let period = 1; period <= period_limit; period++) {
//   const lockupMultiplier = computeLockupMultiplier(period, period_limit);
//   //console.log(`period: ${period}, lockupMultiplier: ${lockupMultiplier}`);
// }

// Loop from 1 to 4 to compute timingMultiplier for each value of week
// for (let week = 1; week <= 4; week++) {
//   const timingMultiplier = computeTimingMultiplier(week);
//   //console.log(`week: ${week}, timingMultiplier: ${timingMultiplier}`);
// }

// Loop from 1 to 4 to compute timingMultiplier for each value of week
// with nested loop from 1 to 18 to compute lockupMultiplier for each value of B2

for (let week = 1; week <= 4; week++) {
  const timingMultiplier = computeTimingMultiplier(week);
  for (let period = 1; period <= period_limit; period++) {
    const lockupMultiplier = computeLockupMultiplier(period, period_limit);
    // compute rate by multiplying lockupMultiplier and timingMultiplier
    const rate = computeRate(week, period);
    // csv output
    console.log(
      `${week},${period},${timingMultiplier},${lockupMultiplier},${rate}`
    );
  }
}
