# Project 4 Technical & Interview Guide: SmartGrid
**Full Title:** SmartGrid: AI-Driven Industrial IoT & Environmental Automation Control System  
**Author:** Mohamed Seddik Feki  
**Tech Stack:** Python 3 (Edge Anomaly Inference), C / C++ (ESP32 / Arduino), MQTT (QoS 0/1/2 + LWT), Closed-Loop PID Control ($\pm 1.5\%$), 1D Kalman Sensor Fusion, HTML5 Canvas SCADA Simulator  
**Project Folder:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\smartgrid-iot\`  
**Live Interactive Simulator:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\smartgrid-iot\demo\index.html`

---

## 1. The 30-Second Elevator Pitch (What to Say in Interviews)
> *"SmartGrid is a distributed industrial IoT and automated environmental control system I engineered using ESP32/Arduino C++ field nodes, an MQTT telemetry broker, and a Python edge anomaly detection engine. It solves three critical industrial automation problems: first, it maintains target environmental variables strictly within $\pm 1.5\%$ of setpoints using a discrete closed-loop PID controller with integral anti-windup and a low-pass filtered derivative term; second, it runs lightweight Python edge inference combining sliding-window Z-score, EWMA, and CUSUM drift detection alongside variance-weighted 1D Kalman sensor fusion to automatically trip a fail-safe hardware relay cutoff upon sensor drift or thermal runaway; and third, it implements an ultra-low-power ESP32 RTC deep-sleep duty cycle that achieves over 400 days (6+ months) of battery life on a single 3,000 mAh cell."*

---

## 2. Core Engineering Problems Solved

### Problem A: Maintaining Environmental Variables Within $\pm 1.5\%$ Under Thermal Disturbances
* **The Challenge:** Industrial chambers and microgrid cooling zones experience sudden thermal load disturbances and noisy sensor readings. A naive PID controller suffers from **integral windup** during large step changes (causing massive overshoot) and **derivative kick / high-frequency noise amplification** from raw thermistor jitter.
* **Your Solution (`firmware/esp32_smartgrid_node.cpp` & `src/edge_anomaly_detector.py`):**
  1. **Discrete PID with Integral Anti-Windup Clamping:**
     $$u_k = K_p e_k + K_i \cdot \text{clamp}\left(\sum e_k \Delta t, -I_{\max}, +I_{\max}\right) + K_d D_k$$
     Clamping the integral accumulator to $\pm 40\%$ prevents actuator saturation lag and allows immediate unwinding the instant the error reverses sign.
  2. **First-Order Low-Pass Filtered Derivative ($\alpha_d = 0.70$):**
     $$D_k = \alpha_d D_{k-1} + (1 - \alpha_d)\left(\frac{e_k - e_{k-1}}{\Delta t}\right)$$
     This attenuates high-frequency white sensor noise variance by **$> 82\%$** and reduces setpoint step derivative kick by **$70\%$**, settling steady-state temperature within **$0.02\%$** of the target setpoint (well inside the **$\pm 1.5\%$** specification).

### Problem B: Detecting Gradual Sensor Drift vs. Sudden Spikes & Triggering Fail-Safe Cutoffs
* **The Challenge:** If a field temperature sensor slowly drifts out of calibration or detaches from a reactor wall, a standard PID controller will blindly drive the heater to $100\%$ PWM, causing thermal runaway.
* **Your Solution (`src/edge_anomaly_detector.py` & `firmware/esp32_smartgrid_node.cpp`):**
  1. **Redundant Multi-Sensor Variance-Weighted & 1D Kalman Fusion:** Combines primary digital (`SHT31`, $\sigma_1^2 = 0.04^\circ\text{C}^2$) and secondary analog (`NTC`, $\sigma_2^2 = 0.1225^\circ\text{C}^2$) sensors using optimal inverse-variance weights ($w_1 = 0.754, w_2 = 0.246$), reducing measurement variance below the best single sensor ($\sigma_{\text{fused}}^2 = 0.0301^\circ\text{C}^2$) and flagging hardware divergence whenever $|z_1 - z_2| > 5.0^\circ\text{C}$.
  2. **3-Tier Python Edge Anomaly Detector:**
     - **Sliding-Window Z-Score ($|Z| > 3.0$):** Catches instantaneous electromagnetic interference or spike faults.
     - **EWMA & Two-Sided Page-Hinkley CUSUM ($S_k^+, S_k^- > 4.5\sigma_0$):** Accumulates small persistent deviations to detect slow calibration drift long before it breaches hard limits.
  3. **Latched Fail-Safe Hardware Interlock (`PIN_FAILSAFE_RELAY`):** Immediately forces PWM duty cycle to `0.0%` and opens the hardware contactor relay until an operator clears the interlock.

### Problem C: Achieving 6+ Months Battery Autonomy on Remote Field Nodes
* **The Challenge:** Continuous Wi-Fi and MCU operation draws $\sim 80 - 110\text{ mA}$, draining a $3,000\text{ mAh}$ battery in **33 hours** ($1.4\text{ days}$).
* **Your Solution (`firmware/esp32_smartgrid_node.cpp` — RTC Deep-Sleep Scheduling):**
  - Retains Kalman covariance, PID state, and boot counters in `RTC_DATA_ATTR` SRAM across deep-sleep cycles.
  - Wakes for $T_{\text{active}} = 200\text{ ms}$ ($I_{\text{active}} = 80\text{ mA}$) to sample sensors and burst MQTT telemetry, then enters `esp_deep_sleep_start()` for $T_{\text{sleep}} = 60\text{ s}$ ($I_{\text{sleep}} = 15\ \mu\text{A}$):
    $$I_{\text{avg}} = \frac{80\text{ mA} \times 0.2\text{ s} + 0.015\text{ mA} \times 60\text{ s}}{60.2\text{ s}} = 0.2807\text{ mA} \implies \frac{2700\text{ mAh}}{0.2807\text{ mA} \times 24\text{ h}} \approx \mathbf{400.7\text{ days}\ (13.2\text{ months})}$$
    comfortably exceeding the **6-month (185-day)** target by more than $2.1\times$.

---

## 3. Key Files in Your Repository
| File Path | What It Does |
|-----------|--------------|
| `projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp` | ESP32 C++ firmware implementing discrete PID with anti-windup, 1D Kalman + inverse-variance sensor fusion, `RTC_DATA_ATTR` deep-sleep scheduler, and fail-safe relay cutoff. |
| `projects/smartgrid-iot/src/edge_anomaly_detector.py` | Python edge inference engine with `ClosedLoopPIDController` ($\pm 1.5\%$), `EdgeAnomalyDetector` (Z-score, EWMA, CUSUM), and `BatteryLifeEstimator`. |
| `projects/smartgrid-iot/src/mqtt_telemetry_broker.py` | Specification-compliant `MqttTopicRouter` (`+` and `#` wildcards) and `SmartGridMqttBridge` with QoS 0/1/2 handshakes, retained messages, and Last Will & Testament (LWT) timeout monitor. |
| `projects/smartgrid-iot/demo/index.html` | Standalone 60 FPS browser Industrial IoT & SCADA Simulator (`file:///`) with live PID oscilloscope, thermal disturbance & anomaly fault injector, 4-zone MQTT node grid, deep-sleep battery calculator, and source code viewer. |
| `test/smartgrid-project.test.js` & `test/smartgrid-empirical-stress.test.js` | 61 automated verification & Monte Carlo stress tests (34 project tests + 27 empirical challenger stress tests). |

---

## 4. Common Technical Interview Questions & Your Answers

**Q1: "Why did you combine Z-Score with CUSUM in your Python edge anomaly detector instead of just using a Z-Score threshold?"**  
> **Your Answer:** *"A sliding-window Z-score is great at catching sudden spikes ($|Z| > 3\sigma$), but if a sensor slowly drifts by $+0.1^\circ\text{C}$ every minute due to aging or fouling, the rolling mean and standard deviation shift right along with the drift, so the Z-score never triggers! By pairing Z-score with a two-sided Cumulative Sum (CUSUM) chart referenced against the calibrated baseline $\mu_0$, even a small persistent $0.5\sigma$ drift accumulates every tick until $S_k^+$ crosses the decision threshold $h = 4.5\sigma_0$, tripping the fail-safe cutoff before thermal runaway can occur."*

**Q2: "How do you fuse two temperature sensors of different accuracies, and why is the fused reading better than just using the more accurate sensor?"**  
> **Your Answer:** *"Using inverse-variance weighting, if Sensor 1 has variance $\sigma_1^2 = 0.04$ and Sensor 2 has $\sigma_2^2 = 0.1225$, we weight them by $w_1 = \frac{\sigma_2^2}{\sigma_1^2 + \sigma_2^2} \approx 0.754$ and $w_2 \approx 0.246$. Mathematically, the resulting fused variance is $\sigma_{\text{fused}}^2 = \frac{\sigma_1^2 \sigma_2^2}{\sigma_1^2 + \sigma_2^2} \approx 0.0301^\circ\text{C}^2$, which is strictly lower than the best single sensor's $0.04^\circ\text{C}^2$. Plus, having two independent physical sensors lets us check $|z_1 - z_2| > 5.0^\circ\text{C}$ to detect if one sensor physically fails or detaches."*

**Q3: "When the ESP32 wakes up from deep sleep, doesn't it reboot from `setup()` and lose its PID integral and Kalman filter memory?"**  
> **Your Answer:** *"Normally yes, because standard SRAM is powered down during deep sleep. To solve that, I stored the Kalman covariance $P$, state estimate $\hat{x}$, PID integral accumulator, and packet sequence counter in RTC Slow Memory using the `RTC_DATA_ATTR` macro. The RTC domain stays powered on just $15\ \mu\text{A}$ during deep sleep, so when `esp_sleep_enable_timer_wakeup` wakes the CPU, the control loop resumes seamlessly without cold-start transients."*
