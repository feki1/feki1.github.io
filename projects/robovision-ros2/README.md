# RoboVision: ROS2 & ESP32 Autonomous Mobile Robot (AMR) with 2D LiDAR SLAM & Telemetry Dashboard

**Author:** Mohamed Seddik Feki (<seddikfeki15@gmail.com>)  
**Affiliation:** Robotics & Automation Engineering, Xiamen University Malaysia (XMUM)  
**Package:** `robovision_ros2`  
**License:** Apache-2.0  

---

## 1. Executive Summary

RoboVision is an end-to-end autonomous mobile robotic navigation platform designed and engineered by Mohamed Seddik Feki. The system bridges low-level real-time embedded hardware control with high-level robotics middleware:
- **Low-Level Dual-Core ESP32 C++ Firmware:** Runs a 100 Hz discrete PID velocity controller with integral anti-windup, hardware interrupt quadrature encoder decoding (`IRAM_ATTR`), 20 kHz ultrasonic PWM generation, and hardware watchdog safety mechanisms.
- **High-Level ROS2 Humble Software Stack:** Implements an Extended Kalman Filter (EKF) sensor fusion engine integrating raw wheel odometry, IMU gyro heading, and 2D LiDAR planar scans to attain **$\pm 2\text{ cm}$ localization accuracy**, alongside Bresenham raycasting log-odds occupancy grid SLAM and dynamic obstacle A* path planning.
- **Real-Time WebSocket Telemetry Bridge:** Streams 60 Hz robot coordinates, point clouds, covariance ellipses, and motor diagnostics to an offline-capable HTML5/Canvas dashboard.

```
                          +-------------------------------------------------+
                          |               Browser Client                    |
                          |     (HTML5 Canvas SLAM & Teleop Dashboard)      |
                          +-------------------------------------------------+
                                                  ^
                                                  | 60 Hz JSON Telemetry / cmd_vel
                                                  v
                          +-------------------------------------------------+
                          |             WebSocket Bridge Node               |
                          |            (src/websocket_bridge.py)            |
                          +-------------------------------------------------+
                                                  ^
                                                  | ROS2 Topics (pub/sub)
                                                  v
   +------------------------------------------------------------------------------------------------+
   |                                     ROS2 Humble Compute Node                                   |
   |                                      (src/ekf_slam_node.py)                                    |
   |                                                                                                |
   |  +------------------------+  +-------------------------------+  +---------------------------+  |
   |  | Extended Kalman Filter |  | Bresenham Log-Odds SLAM Map   |  | A* Navigation Planner     |  |
   |  | (Wheel + IMU + LiDAR)  |  | (360-deg 0.05m grid update)   |  | (8-connected + collision) |  |
   |  +------------------------+  +-------------------------------+  +---------------------------+  |
   +------------------------------------------------------------------------------------------------+
                                                  ^
                                                  | UART Serial 115200 Baud (Binary Telemetry)
                                                  v
   +------------------------------------------------------------------------------------------------+
   |                                ESP32 Dual-Core Microcontroller                                 |
   |                             (firmware/esp32_motor_firmware.cpp)                                |
   |                                                                                                |
   |     [Core 0: 100 Hz Task]                                     [Core 1: 50 Hz Task]             |
   |   - Hardware Interrupt ISRs (IRAM_ATTR)                     - Serial JSON Telemetry Stream    |
   |   - Discrete PID Velocity Control                           - Inbound cmd_vel Parser          |
   |   - 20 kHz Ultrasonic PWM (LEDC)                            - Watchdog Emergency Cutoff       |
   +------------------------------------------------------------------------------------------------+
             |                                                                      |
             v                                                                      v
   +-------------------+                                                  +-------------------+
   | 2x DC Gearmotors  |                                                  | RPLiDAR A1M8 360  |
   | 1440 Ticks/Rev    |                                                  | & MPU-6050 6-DOF  |
   +-------------------+                                                  +-------------------+
```

---

## 2. Hardware Bill of Materials (BOM)

| Component | Part / Model | Purpose / Specification |
|:---|:---|:---|
| **Microcontroller** | ESP32-WROOM-32D | Dual-Core Tensilica Xtensa LX6 @ 240 MHz, 520 KB SRAM, FreeRTOS |
| **Compute SBC** | Raspberry Pi 4 Model B (4GB) | Runs Ubuntu 22.04 LTS & ROS2 Humble, hosts SLAM and WebSocket bridge |
| **2D Laser Scanner** | Slamtec RPLiDAR A1M8 | 360° Planar Laser Scanner, 12-meter range, 5.5–10 Hz scan rate, 8000 samples/s |
| **IMU Sensor** | InvenSense MPU-6050 | 6-DOF Accelerometer + Gyroscope, I2C 400 kHz, onboard DMP filtering |
| **Actuators** | 2x 12V DC Metal Gearmotors | 34:1 Planetary Gearbox, 320 RPM rated, integrated optical quadrature encoders |
| **Motor Driver** | Toshiba TB6612FNG | Dual H-Bridge, 1.2A continuous / 3.2A peak per channel, low RDS(on) MOSFETs |
| **Power System** | 3S LiPo 11.1V 2200mAh | 35C discharge rate, LM2596 5V 3A buck converter for SBC & logic rails |
| **Chassis** | 4mm Acrylic / Aluminum | Differential-drive platform, 160 mm track width ($W$), 66 mm wheel diameter ($2R$) |

---

## 3. Mathematical Formulations

### 3.1 Differential Drive Kinematics

Given chassis linear speed $v$ (m/s) and angular speed $\omega$ (rad/s), the wheel track $W = 0.160\text{ m}$, and wheel radius $R = 0.033\text{ m}$:

**Inverse Kinematics (Twist to Wheel Velocities):**
$$v_L = v - \frac{\omega \cdot W}{2}, \quad v_R = v + \frac{\omega \cdot W}{2}$$
$$\omega_L = \frac{v_L}{R}, \quad \omega_R = \frac{v_R}{R}, \quad \text{RPM} = \frac{\omega \cdot 60}{2\pi}$$

**Forward Kinematics (Wheel Ticks to Odometry Step):**
$$\Delta d_L = \frac{2\pi R \cdot \Delta \text{ticks}_L}{N_{\text{rev}}}, \quad \Delta d_R = \frac{2\pi R \cdot \Delta \text{ticks}_R}{N_{\text{rev}}}$$
$$\Delta d = \frac{\Delta d_R + \Delta d_L}{2}, \quad \Delta \theta = \frac{\Delta d_R - \Delta d_L}{W}$$
$$x_{k} = x_{k-1} + \Delta d \cos\left(\theta_{k-1} + \frac{\Delta \theta}{2}\right)$$
$$y_{k} = y_{k-1} + \Delta d \sin\left(\theta_{k-1} + \frac{\Delta \theta}{2}\right)$$
$$\theta_{k} = \theta_{k-1} + \Delta \theta$$

### 3.2 Extended Kalman Filter (EKF) Formulation

The EKF estimates state $\mathbf{x} = [x, y, \theta]^T$ and covariance $\mathbf{P} \in \mathbb{R}^{3 \times 3}$.

**Prediction Step:**
$$\mathbf{x}_{k|k-1} = \mathbf{x}_{k-1} + \begin{bmatrix} v_k \cos\left(\theta_{k-1} + \frac{\omega_k \Delta t}{2}\right) \Delta t \\ v_k \sin\left(\theta_{k-1} + \frac{\omega_k \Delta t}{2}\right) \Delta t \\ \omega_k \Delta t \end{bmatrix}$$

**State Transition Jacobian $\mathbf{F}_k = \left.\frac{\partial f}{\partial \mathbf{x}}\right|_{\mathbf{x}_{k-1}}$:**
$$\mathbf{F}_k = \begin{bmatrix} 1 & 0 & -v_k \sin\left(\theta_{k-1} + \frac{\omega_k \Delta t}{2}\right) \Delta t \\ 0 & 1 & v_k \cos\left(\theta_{k-1} + \frac{\omega_k \Delta t}{2}\right) \Delta t \\ 0 & 0 & 1 \end{bmatrix}$$
$$\mathbf{P}_{k|k-1} = \mathbf{F}_k \mathbf{P}_{k-1} \mathbf{F}_k^T + \mathbf{Q}$$

**Measurement Update (LiDAR Scan-Matching & IMU):**
$$\mathbf{y}_k = \mathbf{z}_k - \mathbf{H}_k \mathbf{x}_{k|k-1}$$
$$\mathbf{S}_k = \mathbf{H}_k \mathbf{P}_{k|k-1} \mathbf{H}_k^T + \mathbf{R}_k$$
$$\mathbf{K}_k = \mathbf{P}_{k|k-1} \mathbf{H}_k^T \mathbf{S}_k^{-1}$$
$$\mathbf{x}_k = \mathbf{x}_{k|k-1} + \mathbf{K}_k \mathbf{y}_k$$
$$\mathbf{P}_k = (\mathbf{I} - \mathbf{K}_k \mathbf{H}_k) \mathbf{P}_{k|k-1}$$

This sensor fusion bounds cumulative slippage and achieves $\pm 2\text{ cm}$ localization accuracy relative to ground truth.

### 3.3 Log-Odds Occupancy Grid SLAM

The environment is modeled as a 2D discrete grid where each cell $m_i$ stores log-odds $L(m_i) = \log\frac{p(m_i)}{1 - p(m_i)}$.
- **Free Ray Cells:** $L(m_i) \leftarrow \max(L_{\min}, L(m_i) - l_{\text{free}})$ with $l_{\text{free}} = 0.40$.
- **Terminus Obstacle Hit:** $L(m_i) \leftarrow \min(L_{\max}, L(m_i) + l_{\text{occ}})$ with $l_{\text{occ}} = 0.85$.
- Rapid rasterization is executed via the integer **Bresenham line algorithm**.

### 3.4 Discrete PID Velocity Control with Anti-Windup

Each wheel motor is controlled by a discrete PID loop:
$$e[k] = v_{\text{target}}[k] - v_{\text{measured}}[k]$$
$$I[k] = \text{clamp}\left(I[k-1] + e[k] \Delta t, -I_{\max}, I_{\max}\right)$$
$$D[k] = \frac{e[k] - e[k-1]}{\Delta t}$$
$$u[k] = \text{clamp}\left(K_p e[k] + K_i I[k] + K_d D[k], -u_{\max}, u_{\max}\right)$$

---

## 4. ROS2 Topics & Interfaces

| Topic Name | Message Type | Direction | Rate | Description |
|:---|:---|:---|:---|:---|
| `/odom_raw` | `nav_msgs/msg/Odometry` | Inbound (from ESP32) | 50 Hz | Unfiltered wheel odometry dead-reckoning |
| `/imu/data` | `sensor_msgs/msg/Imu` | Inbound | 100 Hz | Filtered angular yaw rate and quaternion orientation |
| `/scan` | `sensor_msgs/msg/LaserScan` | Inbound | 10 Hz | 360° 2D LiDAR range scan array |
| `/ekf_pose` | `geometry_msgs/msg/PoseWithCovarianceStamped` | Outbound | 50 Hz | Fused robot pose with $3 \times 3$ covariance |
| `/map` | `nav_msgs/msg/OccupancyGrid` | Outbound | 5 Hz | Dynamically generated SLAM 2D occupancy grid |
| `/plan` | `nav_msgs/msg/Path` | Outbound | Event | A* optimal obstacle-free navigation path |
| `/goal_pose` | `geometry_msgs/msg/PoseStamped` | Inbound | Event | User-commanded waypoint destination |
| `/cmd_vel` | `geometry_msgs/msg/Twist` | Outbound | 50 Hz | Velocity setpoint for low-level motor controller |

---

## 5. Build & Launch Instructions

### 5.1 ESP32 Firmware Compilation & Flashing
```bash
# Using PlatformIO CLI
cd projects/robovision-ros2/firmware
pio run -e esp32dev --target upload
```

### 5.2 ROS2 Humble Workspace Build
```bash
cd ~/ros2_ws/src
ln -s /path/to/projects/robovision-ros2 .
cd ~/ros2_ws
colcon build --packages-select robovision_ros2 --symlink-install
source install/setup.bash
```

### 5.3 Launch Nodes & Telemetry Bridge
```bash
# Terminal 1: Launch EKF SLAM Node
ros2 run robovision_ros2 ekf_slam_node

# Terminal 2: Launch WebSocket Telemetry Bridge (port 9090)
ros2 run robovision_ros2 websocket_bridge
```

---

## 6. Interactive Browser Dashboard (`demo/index.html`)

For demonstration without hardware or ROS2, launch `projects/robovision-ros2/demo/index.html` in any modern browser. It runs a zero-dependency HTML5 Canvas robotics simulator at 60 FPS featuring:
- Raycasting 2D LiDAR SLAM engine updating log-odds occupancy grid cells.
- A* path planning with dynamic obstacle addition and real-time path replanning.
- Fused EKF trajectory vs. drifted raw wheel odometry visual comparison.
- Virtual teleoperation controls (`cmd_vel`) and live ESP32 hardware telemetry gauges.
- Full-fidelity embedded C++ firmware and ROS2 Python source code explorer.
