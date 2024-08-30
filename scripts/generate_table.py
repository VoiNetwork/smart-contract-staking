import pandas as pd
import matplotlib.pyplot as plt


# Data for the new table
data_new = {
    "Template Variable": [
        "PERIOD_LIMIT",
        "VESTING_DELAY",
        "LOCKUP_DELAY",
        "PERIOD_SECONDS",
        "MESSENGER_ID",
        "DISTRIBUTION_COUNT",
        "DISTRIBUTION_SECONDS",
    ],
    "Value": [
        1,
        1,
        1,
        1,
        73060985,
        12,
        2628288,
    ],
}

# Create a DataFrame
df_new = pd.DataFrame(data_new)

# Plotting the new table
fig, ax = plt.subplots(figsize=(6, 2))  # set size frame
ax.axis("tight")
ax.axis("off")
table = ax.table(
    cellText=df_new.values, colLabels=df_new.columns, cellLoc="center", loc="center"
)

# Save as PNG
# plt.savefig('/mnt/data/template_variables_new_table.png', dpi=300, bbox_inches='tight')
plt.show()
