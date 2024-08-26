import math
from contract_mab import calculate_mab_pure


def test_calculate_mab_pure():
    """
    Test the calculate_mab_pure function
    """
    period_seconds = 60
    vesting_delay = 12
    lockup_delay = 12
    period = 5
    funding = 1
    total = 100
    now = 0
    distribution_count = 0
    distribution_seconds = 60  # must be positive
    # Case: locked up
    result = calculate_mab_pure(
        now,
        vesting_delay,
        period_seconds,
        lockup_delay,
        period,
        funding,
        total,
        distribution_count,
        distribution_seconds,
    )
    assert result == total
    # Case: fully vested
    now = 12341234123412341234124
    result = calculate_mab_pure(
        now,
        vesting_delay,
        period_seconds,
        lockup_delay,
        period,
        funding,
        total,
        distribution_count,
        distribution_seconds,
    )
    assert result == 0
    # Case: fully vested installments
    for i in range(distribution_count):
        now = (
            funding
            + (vesting_delay + vesting_delay * period) * period_seconds
            + i * distribution_seconds
        )
        result = calculate_mab_pure(
            now,
            vesting_delay,
            period_seconds,
            lockup_delay,
            period,
            funding,
            total,
            distribution_count,
            distribution_seconds,
        )
        assert result <= total and result > 0
