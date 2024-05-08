import matplotlib.pyplot as plt
import csv
from datetime import datetime, timedelta

def get_apr(period):
    if period >= 0 and period <= 5:
        return [0, 10, 12, 15, 18, 20][period]
    else:
        return None
        
def calculate_accumulated(principal, apr, time):
    if apr == None:
        return 0
    else: 
        return int(principal * (1 + apr / 100) ** time)

def convert_point_to_tokens(points):
    return points * 3.75 // 100

# def calculate_mab(self) -> UInt64:
#     now = Global.latest_timestamp
#     y = TemplateVar[UInt64]("VESTING_DELAY") # vesting delay
#     seconds_in_period = TemplateVar[UInt64]("PERIOD_SECONDS") 
#     p = TemplateVar[UInt64]("LOCKUP_DELAY") * self.period # lockup period
#     locked_up = now < self.funding + p * seconds_in_period
#     fully_vested = now >= self.funding + (y + p) * seconds_in_period
#     lockup_seconds = p * seconds_in_period
#     # if locked up then total
#     # elif fully vested then zero
#     # else calculate mab using elapsed periods
#     if locked_up: #  if locked up then total
#         return self.total 
#     elif fully_vested: #  elif fully vested then zero
#         return UInt64(0) 
#     else: #  else calculate mab using elapsed periods
#         m =  (now - (self.funding + lockup_seconds)) // seconds_in_period # elapsed period after lockup
#         return (self.total * (y - m)) // y

def calculate_mab_util(now, y, ps, lockup_delay, period, funding, total):
    p = lockup_delay * period
    locked_up = now < funding + p * ps
    fully_vested = now >= funding + (p + y) * ps
    lockup_seconds = p * ps
    if locked_up:
        return total
    elif fully_vested:
        return 0
    else:
        m = (now - (funding + lockup_seconds)) // ps
        return (total * (y - m)) // y
    
def calculate_mab(now, y, ps, lockup_delay, funding, total):
    return [calculate_mab_util(now, y, ps, lockup_delay, i, funding,
        calculate_accumulated(total, get_apr(i), i)) for i in [0,1,2,3,4,5]]

###################################################

points = 6000000 # 6M

# Example usage
tokens = convert_point_to_tokens(points)  # Initial investment

# Calculate Airdop + Bonus
print("Airdrop + Bonus 0:", calculate_accumulated(tokens, get_apr(0), 0))
print("Airdrop + Bonus 1:", calculate_accumulated(tokens, get_apr(1), 1))
print("Airdrop + Bonus 2:", calculate_accumulated(tokens, get_apr(2), 2))
print("Airdrop + Bonus 3:", calculate_accumulated(tokens, get_apr(3), 3))
print("Airdrop + Bonus 4:", calculate_accumulated(tokens, get_apr(4), 4))
print("Airdrop + Bonus 5:", calculate_accumulated(tokens, get_apr(5), 5))

# Get the current UTC timestamp
timestamp_utc = datetime.utcnow()

# Define the average number of days in a month
days_in_month = 30.44

# Convert days to seconds
seconds_in_month = days_in_month * 24 * 60 * 60

funding = 0

vesting_delay = 12

lockup_delay = 12

# Generate x values and initialize an empty list for y values
x_values = list(range(0, int(seconds_in_month * 80), int(seconds_in_month // 10)))
y_values = []

# Generate y values in a loop
for x in x_values:
    y = calculate_mab(x, vesting_delay, seconds_in_month, lockup_delay, funding, tokens)  # You need to provide appropriate arguments here
    y_values.append(y)


# CSV

y0 = [inner_array[0] for inner_array in y_values]
y1 = [inner_array[1] for inner_array in y_values]
y2 = [inner_array[2] for inner_array in y_values]
y3 = [inner_array[3] for inner_array in y_values]
y4 = [inner_array[4] for inner_array in y_values]
y5 = [inner_array[5] for inner_array in y_values]

data = zip(x_values, y0, y1, y2, y3, y4, y5)
csv_file_path = 'simulate.csv'
with open(csv_file_path, 'w', newline='') as csv_file:
    writer = csv.writer(csv_file)
    writer.writerow(['X', 'Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5'])  # Write header
    writer.writerows(data)


# Plot
plt.plot(
    #x_values, 
    [timestamp_utc + timedelta(seconds=s) for s in x_values],
    y_values)

plt.ylabel('MAB')
plt.xlabel('t')
plt.title('MAB over time by lockup period')
plt.legend()
plt.show()
