import numpy as np
import matplotlib.pyplot as plt
import math

# Update y to range from 1 to 18
y = np.linspace(1, 18, 100)
x = (2 * (y + 1)) // 3
x = np.floor(x) 

# Plot the updated result
plt.plot(y, x)
plt.title('Plot of lockup configuration versus total lockup')
plt.xlabel('Lockup configuration')
plt.ylabel('Total Lockup')
plt.grid(True)
plt.show()

