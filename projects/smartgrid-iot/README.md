# SmartGrid: AI-Driven Industrial IoT & Environmental Automation Control System

**Developer:** Mohamed Seddik Feki <fekiseddik@gmail.com>  
**Academic Degree:** Bachelor of Robotics and Automation Engineering (Honours), Xiamen University Malaysia (XMUM) (2025–2029)  
**Repository Path:** `projects/smartgrid-iot`  
**License:** MIT  

---

## 1. System Overview & Engineering Scope

The **SmartGrid IoT** platform is an industrial environmental automation and distributed energy management system. It bridges low-level embedded hardware control with high-level edge intelligence:

1. **ESP32 Edge Microcontroller Node Firmware (`firmware/esp32_smartgrid_node.cpp`)**:
   - Executes real-time discrete PID control with anti-windup clamping and low-pass filtered derivative action to hold chamber temperatures strictly within $\pm 1.5\%$ of setpoint.
   - Combines redundant analog sensors via 1D recursive Kalman filtering and variance-weighted sensor fusion ($w_1 = \sigma_2^2 / (\sigma_1^2 + \sigma_2^2)$).
   - Manages an ultra-low-power deep-sleep schedule with non-volatile RTC memory state retention, achieving 400+ days autonomy on a 3000 mAh Li-ion battery.
   - Operates a dedicated hardware fail-safe relay and PWM cutoff interlock logic.

2. **Python Edge Anomaly Inference & MQTT Broker Engine (`src/`)**:
   - `edge_anomaly_detector.py`: Analytical discrete PID controller ($\pm 1.5\%$ tolerance), multi-tier statistical anomaly inference (sliding-window Z-score, EWMA trend smoothing, and CUSUM calibration drift detection), and analytical battery autonomy estimator.
   - `mqtt_telemetry_broker.py`: Full hierarchical MQTT topic router supporting `+` (single-level) and `#` (multi-level) wildcards, QoS 0/1/2 packet validation, retained message store, and Last Will & Testament (LWT) automated offline alerts.

3. **Interactive SCADA Simulator & Dashboard (`demo/index.html`)**:
   - 60 FPS real-time oscilloscope canvas plotting Setpoint line, Process Variable (PV) line, PWM Control Effort % line, and dynamic $\pm 1.5\%$ tolerance band.
   - Disturbance & anomaly injection station triggering simulated Python fail-safe cutoff and hardware relay trip.
   - 4-Zone ESP32 MQTT Node Grid & live telemetry inspector streaming `smartgrid/zone/+/telemetry`.
   - Interactive 6-month battery autonomy calculator.

---

## 2. Hardware Architecture & Bill of Materials (BOM)

| Component | Part / IC | Interface | Function |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32-WROOM-32D (240 MHz Xtensa LX6) | Dual Core, 520 KB SRAM | Core control loop, Kalman filter, deep-sleep management |
| **Primary Temp Sensor** | Analog TMP36 / Calibrated NTC Thermistor | ADC1 Channel 6 (GPIO 34) | Primary zone temperature observation ($\sigma_1 = 0.20^\circ\text{C}$) |
| **Redundant Temp Sensor** | Secondary Analog Sensor | ADC1 Channel 7 (GPIO 35) | Redundant observation for variance-weighted fusion ($\sigma_2 = 0.35^\circ\text{C}$) |
| **Digital Environment** | Sensirion SHT31-D / BME280 | I2C (GPIO 21 SDA, 22 SCL) | Secondary digital temperature & relative humidity reference |
| **Heater Actuator** | IRLZ44N Logic-Level N-Channel MOSFET | LEDC Ch 0 PWM (GPIO 18) | 5 kHz hardware PWM drive controlling thermal load |
| **Safety Interlock** | 24V SPDT Industrial Relay Module | Digital Output (GPIO 27) | Active-HIGH mechanical relay cutting load bus upon fault |
| **Diagnostic Indicator** | Low-Current Surface Mount LED | Digital Output (GPIO 2) | Status beacon: Normal (OFF/Pulse), Alarm Trip (Blinking Red) |
| **Battery Power Cell** | 18650 Li-ion Rechargeable Cell (3000 mAh) | Analog Divider (GPIO 36) | 3.7V nominal power supply delivering 400+ days runtime |
| **LDO Voltage Regulator** | Microchip MCP1700-3302E/TO ($1.6\ \mu\text{A}\ I_q$) | Power Rail | Ultra-low-quiescent 3.3V linear regulation |

---

## 3. Mathematical Foundations & Control Algorithms

### 3.1 Variance-Weighted Multi-Sensor Kalman Fusion
Two redundant sensors observe true environmental temperature $T$:
$$z_1 \sim \mathcal{N}(T, \sigma_1^2), \quad z_2 \sim \mathcal{N}(T, \sigma_2^2)$$
With $\sigma_1^2 = 0.0400^\circ\text{C}^2$ and $\sigma_2^2 = 0.1225^\circ\text{C}^2$.

The variance-weighted combined observation is:
$$w_1 = \frac{\sigma_2^2}{\sigma_1^2 + \sigma_2^2} \approx 0.7538, \quad w_2 = \frac{\sigma_1^2}{\sigma_1^2 + \sigma_2^2} \approx 0.2462$$
$$z_{\text{fused}} = w_1 z_1 + w_2 z_2$$
$$\sigma_{\text{fused}}^2 = \frac{\sigma_1^2 \sigma_2^2}{\sigma_1^2 + \sigma_2^2} \approx 0.03015^\circ\text{C}^2 \implies \sigma_{\text{fused}} \approx 0.1736^\circ\text{C}$$

In the recursive Kalman filter step:
$$\hat{x}_{k|k-1} = \hat{x}_{k-1|k-1}, \quad P_{k|k-1} = P_{k-1|k-1} + Q$$
$$K_k = \frac{P_{k|k-1}}{P_{k|k-1} + \sigma_{\text{fused}}^2}$$
$$\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k \left(z_{\text{fused}} - \hat{x}_{k|k-1}\right)$$
$$P_{k|k} = (1 - K_k) P_{k|k-1}$$

### 3.2 Discrete PID Control with Anti-Windup Clamping
To hold process temperature within $\pm 1.5\%$ of setpoint:
$$e_k = r_k - \hat{x}_{k|k}$$
- **Proportional:** $P_k = K_p \cdot e_k$
- **Integral with Anti-Windup:**
  $$I_{\text{candidate}} = I_{k-1} + e_k \cdot \Delta t$$
  $$I_k = \operatorname{clamp}(I_{\text{candidate}}, -I_{\max}, I_{\max}), \quad I_{\max} = 40.0\%$$
- **Low-Pass Filtered Derivative:**
  $$\alpha_d = 0.70$$
  $$D_k = \alpha_d D_{k-1} + (1 - \alpha_d) \left(\frac{e_k - e_{k-1}}{\Delta t}\right)$$
- **Clamped Actuator Effort:**
  $$u_k = \operatorname{clamp}(P_k + K_i I_k + K_d D_k, 0.0, 100.0)\%$$

### 3.3 Ultra-Low-Power Battery Autonomy Model
For a $3000\text{ mAh}$ Li-ion battery (derated to $90\%$ usable capacity = $2700\text{ mAh}$):
- Active current: $I_{\text{active}} = 80.0\text{ mA}$ for $T_{\text{active}} = 0.20\text{ s}$
- Sleep current: $I_{\text{sleep}} = 15.0\ \mu\text{A} = 0.015\text{ mA}$ for $T_{\text{sleep}} = 60.0\text{ s}$
- Total cycle period: $T_{\text{cycle}} = 60.20\text{ s}$

Average current consumption:
$$I_{\text{avg}} = \frac{(80.0 \times 0.20) + (0.015 \times 60.0)}{60.20} = \frac{16.0 + 0.90}{60.20} \approx 0.2807\text{ mA}$$
Daily consumption:
$$C_{\text{daily}} = 0.2807\text{ mA} \times 24\text{ h} \approx 6.737\text{ mAh/day}$$
Total autonomy:
$$\text{Days} = \frac{2700\text{ mAh}}{6.737\text{ mAh/day}} \approx 400.7\text{ days} \approx 13.16\text{ months}$$
Satisfies and exceeds the $6+\text{ months}$ ($185+\text{ days}$) mandate.

### 3.4 Multi-Tier Edge Anomaly Detection
1. **Sliding-Window Z-Score ($W=30$):**
   $$Z_t = \frac{|x_t - \mu_W|}{\sigma_W}$$
   Flagged if $Z_t > 3.0$; trips fail-safe if $Z_t \ge 5.0$.
2. **EWMA Smoothing ($\lambda = 0.20$):**
   $$S_t = \lambda x_t + (1 - \lambda) S_{t-1}$$
3. **CUSUM Calibration Drift Detection:**
   $$S_t^+ = \max(0, S_{t-1}^+ + (x_t - \mu_0 - k))$$
   $$S_t^- = \max(0, S_{t-1}^- - (x_t - \mu_0 + k))$$
   Where $k = 0.5 \sigma_0$ and alarm threshold $h = 4.5 \sigma_0$.

---

## 4. Source Code Structure

```
projects/smartgrid-iot/
├── firmware/
│   └── esp32_smartgrid_node.cpp      # ESP32 C++ closed-loop PID, Kalman fusion & deep-sleep
├── src/
│   ├── edge_anomaly_detector.py      # PID, Z-Score, EWMA, CUSUM & Battery Life Estimator
│   ├── mqtt_telemetry_broker.py      # MqttTopicRouter (+/# wildcards), SmartGridMqttBridge
│   └── requirements.txt              # Python requirements
├── demo/
│   └── index.html                    # 60 FPS SCADA simulator, canvas oscilloscope & telemetry
├── requirements.txt                  # Root project requirements
└── README.md                         # Architectural documentation
```

---

## 5. Verification & Testing

To execute automated validation across all 5 test suites:
```bash
# Verify new SmartGrid test suite
node --test test/smartgrid-project.test.js

# Verify E2E regression suite (120 tests)
node test/run-e2e.js

# Verify all project suites together
node --test test/omnitrack-project.test.js test/nexus-pulse-project.test.js test/robovision-project.test.js test/smartgrid-project.test.js
```
