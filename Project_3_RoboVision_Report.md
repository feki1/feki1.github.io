# Project 3 Technical & Interview Guide: RoboVision
**Full Title:** RoboVision: ROS/ROS2 & ESP32 Autonomous Mobile Robot & Telemetry Dashboard  
**Author:** Mohamed Seddik Feki  
**Tech Stack:** ROS / ROS2 (Humble), C++ (ESP32 / FreeRTOS / Arduino), Python 3, Extended Kalman Filter (EKF), 2D LiDAR SLAM, A* Path Planning, WebSockets, HTML5 Canvas  
**Project Folder:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\robovision-ros2\`  
**Live Interactive Simulator:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\robovision-ros2\demo\index.html`

---

## 1. The 30-Second Elevator Pitch (What to Say in Interviews)
> *"RoboVision is an autonomous differential-drive mobile robot stack I engineered using ROS2 Humble in Python and bare-metal dual-core ESP32 C++ firmware, paired with a real-time 60 FPS WebSocket telemetry and SLAM visualization dashboard. On the embedded side, Core 0 of the ESP32 runs a hard real-time 100 Hz discrete PID velocity controller with integral anti-windup and hardware-interrupt (`IRAM_ATTR`) quadrature encoder decoding, while Core 1 streams 50 Hz odometry and IMU frames over UART. On the ROS2 navigation side, I implemented an Extended Kalman Filter (EKF) that fuses wheel odometry, IMU yaw, and 360-degree 2D LiDAR scan matching to bound localization drift within $\pm 2\text{ cm}$, alongside a Bresenham log-odds occupancy grid mapper and an 8-connected A* path planner with dynamic obstacle inflation."*

---

## 2. Core Engineering Problems Solved

### Problem A: Eliminating Wheel Slip Drift with Extended Kalman Filter (EKF) Sensor Fusion ($\pm 2\text{ cm}$ Accuracy)
* **The Challenge:** Relying on wheel encoders alone (dead reckoning) fails on real floors because wheels slip during acceleration and turns, causing position error to grow unbounded over time.
* **Your Solution (`src/ekf_slam_node.py`):**
  1. **State Vector & Motion Prediction (2nd-Order Runge-Kutta):** Tracks $\mathbf{x} = [x, y, \theta]^T$ using exact midpoint integration:
     $$\theta_{\text{mid}} = \theta + \frac{\omega \Delta t}{2}, \quad x' = x + v \Delta t \cos(\theta_{\text{mid}}), \quad y' = y + v \Delta t \sin(\theta_{\text{mid}})$$
  2. **Analytical Jacobian Linearization ($F_k$):** Propagates the $3 \times 3$ state covariance matrix $P_{k|k-1} = F_k P_{k-1} F_k^T + Q_k$, where:
     $$F_k = \begin{bmatrix} 1 & 0 & -v \Delta t \sin(\theta_{\text{mid}}) \\ 0 & 1 & v \Delta t \cos(\theta_{\text{mid}}) \\ 0 & 0 & 1 \end{bmatrix}$$
  3. **Multi-Rate Measurement Updates (IMU + 2D LiDAR Scan Matching):** Fuses high-rate IMU yaw ($z_{\text{imu}} = \theta_{\text{imu}}$) and 2D LiDAR global scan-matched poses with covariance symmetrization $P \leftarrow \frac{1}{2}(P + P^T)$, bounding the $1\sigma$ localization uncertainty $\sqrt{P_{xx} + P_{yy}}$ strictly within **$\pm 2\text{ cm}$**.

### Problem B: Hard Real-Time Motor Control Without Missing Encoder Ticks on ESP32
* **The Challenge:** At 3,000 RPM with a 1,320-tick-per-revolution quadrature encoder, pulses arrive every few microseconds. Polling encoders in `loop()` or blocking on serial prints drops ticks and destabilizes the velocity PID loop.
* **Your Solution (`firmware/esp32_motor_firmware.cpp`):**
  1. **`IRAM_ATTR` Hardware Interrupt Service Routines (ISRs):** Placed `leftEncoderISR` and `rightEncoderISR` directly in ESP32 Internal SRAM (`IRAM_ATTR`) with critical-section spinlocks (`portMUX_TYPE`) so flash cache misses never delay encoder edge counting.
  2. **FreeRTOS Dual-Core Task Pinning:**
     - **Core 0 (`TaskControlLoop`, Priority 2, 100 Hz):** Deterministic `vTaskDelayUntil` loop executing differential-drive inverse kinematics ($v_L = v - \frac{\omega L}{2}, \; v_R = v + \frac{\omega L}{2}$), discrete PID with integral anti-windup clamping, stiction deadband compensation, and 20 kHz ultrasonic hardware PWM via the ESP32 `LEDC` peripheral.
     - **Core 1 (`TaskTelemetry`, Priority 1, 50 Hz):** Parses incoming ROS2 `$CMD,v,w*` frames, monitors a 500 ms watchdog safety timer (auto-braking motors if serial link drops), and streams `$ODOM*` JSON frames.

### Problem C: Real-Time 2D Occupancy Grid Mapping & Obstacle-Safe A* Replanning
* **The Challenge:** Turning noisy 360-degree laser range scans into a navigable map and computing collision-free paths around newly dropped obstacles in real time.
* **Your Solution (`src/ekf_slam_node.py` & `demo/index.html`):**
  - **Bresenham Integer Raycasting & Log-Odds Mapping:** Traces each LiDAR beam from the robot origin $(x_0, y_0)$ to hit point $(x_1, y_1)$ using integer Bresenham line stepping, updating cell log-odds $L(m_i) \leftarrow \text{clamp}(L(m_i) + l_{\text{occ/free}}, -4.0, +4.0)$ so transient sensor noise doesn't create permanent phantom walls.
  - **8-Connected A* Planner with C-Space Inflation & Corner-Cutting Prevention:** Inflates obstacles by the robot's physical chassis radius ($r = 0.12\text{ m}$) and forbids diagonal moves from squeezing between adjacent obstacle corners.

---

## 3. Key Files in Your Repository
| File Path | What It Does |
|-----------|--------------|
| `projects/robovision-ros2/firmware/esp32_motor_firmware.cpp` | Dual-core FreeRTOS ESP32 C++ firmware with `IRAM_ATTR` quadrature encoder ISRs, discrete PID + anti-windup, 20 kHz LEDC PWM, and watchdog safety cutoff. |
| `projects/robovision-ros2/src/ekf_slam_node.py` | ROS2 Humble Python node implementing the 3-DOF Extended Kalman Filter ($\pm 2\text{ cm}$), Bresenham log-odds occupancy grid mapper, and 8-connected A* planner. |
| `projects/robovision-ros2/src/websocket_bridge.py` | High-frequency 60 Hz `asyncio` WebSocket telemetry streamer and bidirectional browser teleop/waypoint command bridge. |
| `projects/robovision-ros2/package.xml` & `setup.py` | Standard ROS2 `ament_python` package manifest and `colcon` entry-point configuration. |
| `projects/robovision-ros2/demo/index.html` | Standalone 60 FPS 2D LiDAR SLAM & Telemetry Dashboard (`file:///`) with click-to-navigate A*, dynamic obstacle spawner, virtual D-Pad/WASD teleop, live EKF covariance matrix, and embedded C++/Python source inspector. |
| `test/robovision-project.test.js` | 43 automated unit, mathematical, and adversarial verification tests. |

---

## 4. Common Technical Interview Questions & Your Answers

**Q1: "Why did you place your ESP32 encoder interrupt handlers in `IRAM_ATTR` and split tasks across Core 0 and Core 1?"**  
> **Your Answer:** *"On the ESP32, normal code executes from external SPI flash through a cache. If a flash read/write or cache miss happens when a quadrature encoder edge arrives, an ISR stored in flash gets delayed or crashes. Marking the ISR with `IRAM_ATTR` places the machine code directly into internal SRAM for sub-microsecond latency. Furthermore, by pinning the 100 Hz PID loop to Core 0 at priority 2 and isolating serial UART parsing and JSON telemetry on Core 1 at priority 1, serial I/O jitter never affects the 10 ms PID sample period `dt`."*

**Q2: "Why use Log-Odds for the Occupancy Grid Map instead of storing probabilities $p \in [0, 1]$ directly?"**  
> **Your Answer:** *"Updating raw probabilities using Bayes' rule requires floating-point multiplications and divisions on every cell along 360 laser rays at 60 Hz, and values near 0 or 1 suffer from floating-point underflow. By transforming probability $p$ into log-odds $L = \ln\left(\frac{p}{1 - p}\right)$, each Bayesian raycast update simplifies to a fast addition ($L_t = L_{t-1} + l_{\text{meas}}$), clamped between $[-4.0, +4.0]$ so the map stays responsive when dynamic obstacles move."*

**Q3: "How does your PID controller handle integral windup when a wheel is physically stalled?"**  
> **Your Answer:** *"If a wheel hits an obstacle or is held still, the velocity error stays large and a naive integral term $\sum e \cdot \Delta t$ winds up to a massive number, causing violent overshoot once freed. In `PIDController::compute`, I clamp the integral accumulator symmetrically inside `[-max_integral, +max_integral]` before multiplying by $K_i$, and reset the integral state immediately if the safety watchdog triggers."*
