import math
import random


# STEP 1: Define our landscape
def f(x):
    return x ** 2 + 10 * math.sin(x)


# STEP 2: Set up algorithm parameters
T_start = 1000  # Start energetic (high exploration)
T_end = 1e-8  # End calm (low exploration)
alpha = 0.95  # Cooling speed
step_size = 1.0  # Neighborhood search radius

# STEP 3: Start our search
x_current = 0.0  # Start position
f_current = f(x_current)  # Cost at start
x_best = x_current  # Remember best position
f_best = f_current  # Remember best cost
T = T_start  # Initial energy level

iteration = 0
print("Starting simulated annealing...")
print(f"Initial: x = {x_current:.3f}, f(x) = {f_current:.3f}")

# STEP 4: Main search loop
while T > T_end:
    iteration += 1

    # Look at a random neighbor
    x_new = x_current + random.uniform(-step_size, step_size)
    f_new = f(x_new)

    # Calculate how much better/worse this new spot is
    delta_f = f_new - f_current

    # DECISION: Should we move there?
    if delta_f < 0:
        # Better spot - definitely move!
        x_current = x_new
        f_current = f_new
        move_type = "BETTER"
    else:
        # Worse spot - maybe move (with probability)
        acceptance_prob = math.exp(-delta_f / T)
        if random.random() < acceptance_prob:
            x_current = x_new
            f_current = f_new
            move_type = "WORSE (accepted)"
        else:
            move_type = "WORSE (rejected)"

        # Always remember the absolute best we've found
    if f_new < f_best:
        x_best = x_new
        f_best = f_new
        improvement = "NEW BEST!"
    else:
        improvement = ""

        # Optional: Print progress occasionally
    if iteration % 100 == 0:
        print(f"Iter {iteration}: T={T:.2f}, Current x={x_current:.3f}, "
              f"Best x={x_best:.3f}, Move: {move_type} {improvement}")

        # Cool down - become less exploratory over time
    T *= alpha

# STEP 5: Final results
print("\n" + "=" * 50)
print("FINAL RESULTS:")
print(f"Best x found: {x_best:.6f}")
print(f"Minimum f(x): {f_best:.6f}")
print(f"Total iterations: {iteration}")







