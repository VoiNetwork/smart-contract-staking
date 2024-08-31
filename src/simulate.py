from typing import Callable
import matplotlib.pyplot as plt
import csv
import math
from datetime import datetime, timedelta
from simulate_mab import calculate_mab_pure


def get_apr(period, period_limit):
    if period >= 0 and period <= period_limit:
        return int((period / period_limit) * 20) if period_limit > 0 else 20
    else:
        return None


def calculate_accumulated(principal, apr, time):
    if apr == None:
        return 0
    else:
        return int(principal * (1 + apr / 100) ** time)


def convert_point_to_tokens(points):
    return points * 3.75 // 100


def calculate_mab(
    now: int,
    vesting_delay: Callable[[int], int],
    period_seconds: int,
    lockup_delay: int,
    funding: int,
    total: int,
    distribution_count: Callable[[int], int],
    distribution_seconds: int,
    period_limit: int,
    scale: int = 1,
):
    return [
        calculate_mab_pure(
            now,
            vesting_delay(period),
            period_seconds,
            lockup_delay,
            period,
            funding,
            int(
                calculate_accumulated(total, get_apr(period, period_limit), period)
                * scale
            ),
            distribution_count(period),
            distribution_seconds,
        )
        for period in range(period_limit + 1)
    ]


###################################################

points = 6000000  # 6M

# Example usage
tokens = convert_point_to_tokens(points)  # Initial investment

# Get the current UTC timestamp
timestamp_utc = datetime.utcnow()

# Define the average number of days in a month
days_in_month = 30.44

# Convert days to seconds
seconds_in_month = days_in_month * 24 * 60 * 60

funding = 0


###################################################
# Incentivized Testnet Airdrop
###################################################


def plot_mab_airdrop():
    def vesting_delay(period):
        return 0

    def distribution_count(period):
        return 12

    period_limit = 5
    # Calcualte delays
    for i in range(0, period_limit + 1):
        print(
            f"vesting_delay({i}): {vesting_delay(i)}  lockup_delay: {i}  total_delay: {vesting_delay(i) + i}"
        )
    # Calculate Airdop + Bonus
    for i in range(0, period_limit + 1):
        print(
            f"Airdrop + Bonus {i}: {calculate_accumulated(tokens, get_apr(i, period_limit), i)}"
        )
    lockup_delay = 12
    distribution_seconds = seconds_in_month
    x_value_range = 90

    # Generate x values and initialize an empty list for y values
    x_values = list(
        range(0, int(seconds_in_month * x_value_range), int(seconds_in_month // 10))
    )
    y_values = []

    # Generate y values in a loop
    for x in x_values:
        y = calculate_mab(
            x,
            vesting_delay,
            seconds_in_month,
            lockup_delay,
            funding,
            tokens,
            distribution_count,
            distribution_seconds,
            period_limit,
        )
        y_values.append(y)

    # TODO - Add CSV output

    plt.plot(
        [timestamp_utc + timedelta(seconds=s) for s in x_values],
        y_values,
    )


###################################################
# Staking Lockup
###################################################


def plot_mab_staking():
    def vesting_delay(period):
        return 0

    def distribution_count(period):
        count = int(2 * (period + 1) // 3)
        if count == 0:
            return 1
        else:
            return count

    period_limit = 18
    for i in range(1, period_limit + 1):
        print(
            f"vesting_delay({i}): {vesting_delay(i)}  lockup_delay: {i}  total_delay: {vesting_delay(i) + i}   distribution_count: {distribution_count(i)}"
        )
    # Calculate Airdop + Bonus
    for i in range(0, period_limit + 1):
        print(
            f"Airdrop + Bonus {i}: {calculate_accumulated(tokens, get_apr(i, period_limit), i)}"
        )
    lockup_delay = 1
    period_seconds = seconds_in_month
    distribution_seconds = seconds_in_month
    x_value_range = 32

    # Generate x values and initialize an empty list for y values
    x_values = list(
        range(0, int(seconds_in_month * x_value_range), int(seconds_in_month // 10))
    )
    y_values = []

    # Generate y values in a loop
    for x in x_values:
        y = calculate_mab(
            x,
            vesting_delay,
            period_seconds,
            lockup_delay,
            funding,
            tokens,
            distribution_count,
            distribution_seconds,
            period_limit,
            scale=0.075,
        )
        y_values.append(y)

    # TODO - Add CSV output

    plt.plot(
        [timestamp_utc + timedelta(seconds=s) for s in x_values],
        y_values,
    )


###################################################
# Ambassador Program
###################################################


def plot_mab_compensation():

    def vesting_delay(period):
        return 0

    def distribution_count(period):
        return 12

    period_limit = 0
    for i in range(0, period_limit + 1):
        print(
            f"vesting_delay({i}): {vesting_delay(i)}  lockup_delay: {i}  total_delay: {vesting_delay(i) + i}"
        )
    # Calculate Airdop + Bonus
    for i in range(0, period_limit + 1):
        print(
            f"Airdrop + Bonus {i}: {calculate_accumulated(tokens, get_apr(i, period_limit), i)}"
        )
    lockup_delay = 0
    distribution_seconds = seconds_in_month
    x_value_range = 12

    # Generate x values and initialize an empty list for y values
    x_values = list(
        range(0, int(seconds_in_month * x_value_range), int(seconds_in_month // 10))
    )
    y_values = []

    # Generate y values in a loop
    for x in x_values:
        y = calculate_mab(
            x,
            vesting_delay,
            seconds_in_month,
            lockup_delay,
            funding,
            tokens,
            distribution_count,
            distribution_seconds,
            period_limit,
        )
        y_values.append(y)

    # TODO - Add CSV output

    plt.plot(
        [timestamp_utc + timedelta(seconds=s) for s in x_values],
        y_values,
    )


###################################################


# # Generate x values and initialize an empty list for y values
# x_values = list(
#     range(0, int(seconds_in_month * x_value_range), int(seconds_in_month // 10))
# )
# y_values = []

# # Generate y values in a loop
# for x in x_values:
#     y = calculate_mab(
#         x,
#         vesting_delay,
#         seconds_in_month,
#         lockup_delay,
#         funding,
#         tokens,
#         distribution_count,
#         distribution_seconds,
#         period_limit,
#     )
#     y_values.append(y)


# # CSV

# y0 = [inner_array[0] for inner_array in y_values] if period_limit > 0 else []
# y1 = [inner_array[1] for inner_array in y_values] if period_limit > 1 else []
# y2 = [inner_array[2] for inner_array in y_values] if period_limit > 2 else []
# y3 = [inner_array[3] for inner_array in y_values] if period_limit > 3 else []
# y4 = [inner_array[4] for inner_array in y_values] if period_limit > 4 else []
# y5 = [inner_array[5] for inner_array in y_values] if period_limit > 5 else []
# y6 = [inner_array[6] for inner_array in y_values] if period_limit > 6 else []
# y7 = [inner_array[7] for inner_array in y_values] if period_limit > 7 else []
# y8 = [inner_array[8] for inner_array in y_values] if period_limit > 8 else []
# y9 = [inner_array[9] for inner_array in y_values] if period_limit > 9 else []
# y10 = [inner_array[10] for inner_array in y_values] if period_limit > 10 else []
# y11 = [inner_array[11] for inner_array in y_values] if period_limit > 11 else []
# y12 = [inner_array[12] for inner_array in y_values] if period_limit > 12 else []
# y13 = [inner_array[13] for inner_array in y_values] if period_limit > 13 else []
# y14 = [inner_array[14] for inner_array in y_values] if period_limit > 14 else []
# y15 = [inner_array[15] for inner_array in y_values] if period_limit > 15 else []
# y16 = [inner_array[16] for inner_array in y_values] if period_limit > 16 else []
# y17 = [inner_array[17] for inner_array in y_values] if period_limit > 17 else []

# data = zip(
#     x_values,
#     y0,
#     y1,
#     y2,
#     y3,
#     y4,
#     y5,
#     y6,
#     y7,
#     y8,
#     y9,
#     y10,
#     y11,
#     y12,
#     y13,
#     y14,
#     y15,
#     y16,
#     y17,
# )
# csv_file_path = "simulate.csv"
# with open(csv_file_path, "w", newline="") as csv_file:
#     writer = csv.writer(csv_file)
#     writer.writerow(
#         [
#             "X",
#             "Y0",
#             "Y1",
#             "Y2",
#             "Y3",
#             "Y4",
#             "Y5",
#             "Y6",
#             "Y7",
#             "Y8",
#             "Y9",
#             "Y10",
#             "Y11",
#             "Y12",
#             "Y13",
#             "Y14",
#             "Y15",
#             "Y16",
#             "Y17",
#         ]
#     )
#     writer.writerows(data)

# TOD - generate plot from args

plot_mab_airdrop()
#plot_mab_staking()
#plot_mab_compensation()

plt.ylabel("MB")
plt.xlabel("t")
plt.title("MB over time by lockup period")
plt.legend()
plt.show()
