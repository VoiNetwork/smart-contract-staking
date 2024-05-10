##############################################
# function: calculate_mab_pure (internal)
# arguments: 
# - now, timestamp
# - vesting_delay, how many periods in vesting
# - period_seconds, how many seconds in period
# - lockup delay, how many period in lockup
# - period, how many periods
# - funding, when funded
# - total, how much funded
# purpose: calculate minimum allowable balance
# returns' minimum allowable balance
##############################################
def calculate_mab_pure(
    now,
    vesting_delay,
    period_seconds,
    lockup_delay,
    period,
    funding,
    total,
):
    lockup_periods = lockup_delay * period
    lockup_seconds = lockup_periods * period_seconds
    vesting_seconds = vesting_delay * period_seconds
    locked_up = now < funding + lockup_seconds
    fully_vested = now >= funding + lockup_seconds + vesting_seconds
    if locked_up:
        return total
    elif fully_vested:
        return 0
    else:
        elapsed_periods = (now - (funding + lockup_seconds)) // period_seconds
        return (total * (vesting_delay - elapsed_periods)) // vesting_delay
    