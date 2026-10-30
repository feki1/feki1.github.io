/**
 * ============================================================================
 * SmartGrid IoT: Industrial Environmental Automation Node Firmware
 * ============================================================================
 * Developer: Mohamed Seddik Feki <fekiseddik@gmail.com>
 * Academic Profile: Bachelor of Robotics and Automation Engineering (Honours)
 * Institution: Xiamen University Malaysia (XMUM)
 * License: MIT
 * 
 * Target Microcontroller: ESP32-WROOM-32D (Tensilica Xtensa LX6 Dual-Core)
 * Framework: ESP-IDF / Arduino-ESP32
 * 
 * Functional Architecture:
 * 1. Multi-Sensor Fusion Filter (1D Recursive Kalman & Variance-Weighted Fusion)
 * 2. Discrete Closed-Loop PID Controller with Anti-Windup & Low-Pass Filtered Derivative
 * 3. Ultra-Low-Power Deep-Sleep Scheduling with RTC Memory State Preservation
 * 4. Hardware Fail-Safe Relay Interlock and Instantaneous PWM Actuator Cutoff
 * ============================================================================
 */

#include <Arduino.h>
#include <esp_sleep.h>
#include <driver/ledc.h>
#include <math.h>

// ============================================================================
// HARDWARE PIN ASSIGNMENTS & ELECTRICAL SPECIFICATIONS
// ============================================================================
namespace HardwareConfig {
    // Actuator & Safety Interlock Pins
    constexpr uint8_t PIN_HEATER_PWM          = 18; // LEDC Ch 0 -> IRLZ44N Logic-Level Power MOSFET
    constexpr uint8_t PIN_FAILSAFE_RELAY      = 27; // SPDT Industrial Relay Interlock (Active HIGH)
    constexpr uint8_t PIN_STATUS_LED          = 2;  // Onboard Diagnostic LED (Active HIGH)

    // Redundant Analog Sensor ADC Channels (ESP32 ADC1: No WiFi Conflict)
    // Note: GPIO 34, 35, 36 are GPI input-only pins without internal pull-ups/pull-downs.
    constexpr uint8_t PIN_PRIMARY_TEMP_ADC    = 34; // ADC1_CH6: Primary Analog Temperature Sensor (TMP36)
    constexpr uint8_t PIN_SECONDARY_TEMP_ADC  = 35; // ADC1_CH7: Secondary Analog Temperature Sensor (Redundant)
    constexpr uint8_t PIN_BATTERY_SENSE       = 36; // ADC1_CH0: Battery Voltage Divider (100k / 100k)

    // Hardware PWM Configuration (ESP32 LEDC Driver)
    constexpr uint8_t  PWM_CHANNEL            = 0;
    constexpr uint32_t PWM_FREQ_HZ            = 5000; // 5 kHz PWM frequency for silent inductive switching
    constexpr uint8_t  PWM_RESOLUTION_BITS    = 8;    // 8-bit resolution (0 - 255)
    constexpr uint32_t PWM_MAX_DUTY           = 255;

    // ADC Electrical Parameters (12-bit ADC, 0 - 3.3V reference)
    constexpr float ADC_VREF_VOLTS            = 3.3f;
    constexpr float ADC_MAX_COUNTS            = 4095.0f;
    constexpr float VOLTAGE_DIVIDER_RATIO     = 2.0f; // 100k / 100k divider for Li-ion battery monitoring
}

// ============================================================================
// OPERATIONAL THRESHOLDS & CONTROL TUNING CONSTANTS
// ============================================================================
namespace SystemTuning {
    // Temperature Setpoint & Closed-Loop Precision Bounds
    constexpr float NOMINAL_SETPOINT_C        = 24.0f; // Nominal zone target: 24.0°C
    constexpr float TOLERANCE_PERCENT         = 1.5f;  // Precision requirement: +/- 1.5% of setpoint
    constexpr float CRITICAL_MAX_TEMP_C       = 75.0f; // High temperature emergency trip threshold
    constexpr float CRITICAL_MIN_TEMP_C       = 0.0f;  // Sub-zero freezing emergency trip threshold
    constexpr float MAX_SLEW_RATE_C_PER_SEC   = 4.0f;  // Maximum plausible thermal rate of change
    constexpr float SENSOR_DISCREPANCY_MAX_C  = 5.0f;  // Sensor divergence threshold between S1 and S2

    // PID Controller Parameters
    constexpr float DEFAULT_KP                = 6.5f;  // Proportional gain
    constexpr float DEFAULT_KI                = 1.2f;  // Integral gain (1/s)
    constexpr float DEFAULT_KD                = 2.8f;  // Derivative gain (s)
    constexpr float INTEGRAL_ANTI_WINDUP_MAX  = 40.0f; // Clamped maximum integral contribution (%)
    constexpr float DERIVATIVE_FILTER_ALPHA   = 0.70f; // First-order low-pass filter smoothing coefficient

    // Multi-Sensor Variance & Kalman Noise Covariances
    constexpr float SENSOR_1_VARIANCE         = 0.0400f; // Primary sensor variance (sigma1 = 0.20°C)
    constexpr float SENSOR_2_VARIANCE         = 0.1225f; // Secondary sensor variance (sigma2 = 0.35°C)
    constexpr float KALMAN_PROCESS_NOISE_Q    = 0.0050f; // Discrete thermal process disturbance covariance

    // Ultra-Low-Power Sleep Timing Specifications
    constexpr uint64_t SLEEP_INTERVAL_SECONDS = 60ULL;   // 60-second deep-sleep interval
    constexpr uint64_t U_SEC_TO_SEC_FACTOR    = 1000000ULL;
}

// ============================================================================
// NON-VOLATILE RTC SLOW MEMORY VARIABLE ALLOCATION
// Variables survive ESP32 deep-sleep hardware resets
// ============================================================================
RTC_DATA_ATTR static uint32_t rtc_boot_count               = 0;
RTC_DATA_ATTR static float    rtc_last_process_variable    = SystemTuning::NOMINAL_SETPOINT_C;
RTC_DATA_ATTR static float    rtc_pid_integral             = 0.0f;
RTC_DATA_ATTR static float    rtc_kalman_state             = SystemTuning::NOMINAL_SETPOINT_C;
RTC_DATA_ATTR static float    rtc_kalman_covariance        = 1.0f;
RTC_DATA_ATTR static bool     rtc_failsafe_latched         = false;
RTC_DATA_ATTR static uint32_t rtc_consecutive_anomalies    = 0;
RTC_DATA_ATTR static uint32_t rtc_cumulative_active_ms     = 0;

// ============================================================================
// DATA STRUCTURES & ALGORITHMIC MODULES
// ============================================================================

/**
 * @brief 1D Recursive Discrete Kalman Filter with Variance-Weighted Sensor Fusion
 * Fuses redundant analog temperature sensor observations to produce minimum-variance estimate.
 */
struct MultiSensorKalmanFilter {
    float state_estimate;    // Current state temperature estimate x_hat (°C)
    float error_covariance;  // Current estimation error covariance P
    float process_noise_q;   // Process disturbance covariance Q
    float var_sensor_1;      // Primary sensor variance sigma_1^2
    float var_sensor_2;      // Secondary sensor variance sigma_2^2

    void init(float initial_temp, float initial_p, float q, float var1, float var2) {
        state_estimate   = initial_temp;
        error_covariance = initial_p;
        process_noise_q  = q;
        var_sensor_1     = var1;
        var_sensor_2     = var2;
    }

    /**
     * @brief Computes variance-weighted optimal linear observation combining S1 and S2
     * @param z1 Primary sensor reading (°C)
     * @param z2 Secondary redundant reading (°C)
     * @param out_fused_reading Pointer to store combined observation (°C)
     * @param out_fused_variance Pointer to store combined observation variance (°C^2)
     * @return true if sensors are consistent (discrepancy <= 5.0°C), false if anomaly detected
     */
    bool fuseObservations(float z1, float z2, float* out_fused_reading, float* out_fused_variance) {
        float discrepancy = fabsf(z1 - z2);
        bool consistent = (discrepancy <= SystemTuning::SENSOR_DISCREPANCY_MAX_C);

        // Optimal variance-weighted combination:
        // w1 = var2 / (var1 + var2), w2 = var1 / (var1 + var2)
        float total_variance = var_sensor_1 + var_sensor_2;
        float w1 = var_sensor_2 / total_variance;
        float w2 = var_sensor_1 / total_variance;

        *out_fused_reading = (w1 * z1) + (w2 * z2);
        *out_fused_variance = (var_sensor_1 * var_sensor_2) / total_variance;

        return consistent;
    }

    /**
     * @brief Executes discrete Kalman Predict and Update cycle
     * @param z_fused Fused observation (°C)
     * @param r_fused Observation variance (°C^2)
     * @return Updated state estimate x_hat_k (°C)
     */
    float step(float z_fused, float r_fused) {
        // 1. Time Update (Predict)
        // x_hat_priori = x_hat_posteriori (assumes constant thermal state across micro-step)
        float p_priori = error_covariance + process_noise_q;

        // 2. Measurement Update (Correct)
        // Kalman Gain: K = P_priori / (P_priori + R_fused)
        float kalman_gain = p_priori / (p_priori + r_fused);

        // State update: x_hat = x_hat_priori + K * (z_fused - x_hat_priori)
        state_estimate = state_estimate + kalman_gain * (z_fused - state_estimate);

        // Covariance update: P = (1 - K) * P_priori
        error_covariance = (1.0f - kalman_gain) * p_priori;

        return state_estimate;
    }
};

/**
 * @brief Discrete Closed-Loop PID Controller with Anti-Windup Clamping & Low-Pass Filtered Derivative
 * Maintains environmental process variable within +/- 1.5% of target setpoint.
 */
struct PIDController {
    float kp;
    float ki;
    float kd;
    float setpoint;
    float integral;
    float max_integral;
    float prev_error;
    float filtered_derivative;
    float derivative_alpha;
    float min_output;
    float max_output;

    void init(float p, float i, float d, float sp, float max_i, float alpha, float out_min, float out_max) {
        kp                  = p;
        ki                  = i;
        kd                  = d;
        setpoint            = sp;
        integral            = 0.0f;
        max_integral        = max_i;
        prev_error          = 0.0f;
        filtered_derivative = 0.0f;
        derivative_alpha    = alpha;
        min_output          = out_min;
        max_output          = out_max;
    }

    void reset() {
        integral            = 0.0f;
        prev_error          = 0.0f;
        filtered_derivative = 0.0f;
    }

    /**
     * @brief Computes control effort with anti-windup clamping and filtered derivative
     * @param measured Current process variable (°C)
     * @param dt Time delta (seconds)
     * @return Clamped control effort [min_output, max_output] in percent (%)
     */
    float compute(float target, float measured, float dt) {
        if (!isfinite(target) || !isfinite(measured) || dt <= 0.0f) {
            return 0.0f;
        }

        setpoint = target;
        float error = setpoint - measured;

        // 1. Proportional Term
        float p_term = kp * error;

        // 2. Integral Term with Clamping Anti-Windup
        integral += error * dt;
        if (integral > max_integral) {
            integral = max_integral;
        } else if (integral < -max_integral) {
            integral = -max_integral;
        }
        float i_term = ki * integral;

        // 3. Low-Pass Filtered Derivative Action
        // Prevents derivative kick and attenuates high-frequency sensor noise
        float raw_derivative = (error - prev_error) / dt;
        filtered_derivative = (derivative_alpha * filtered_derivative) + ((1.0f - derivative_alpha) * raw_derivative);
        prev_error = error;
        float d_term = kd * filtered_derivative;

        // 4. Summation and Output Clamping
        float output = p_term + i_term + d_term;
        if (output > max_output) {
            output = max_output;
        } else if (output < min_output) {
            output = min_output;
        }

        return output;
    }

    /**
     * @brief Evaluates whether process variable is within +/- 1.5% tolerance of setpoint
     * @param measured Current process variable
     * @return true if within tolerance, false otherwise
     */
    bool isWithinTolerance(float measured) const {
        if (fabsf(setpoint) < 0.0001f) {
            return fabsf(measured - setpoint) <= 0.05f;
        }
        float deviation_percent = (fabsf(measured - setpoint) / fabsf(setpoint)) * 100.0f;
        return (deviation_percent <= SystemTuning::TOLERANCE_PERCENT);
    }
};

/**
 * @brief Hardware Fail-Safe Interlock and Cutoff State Machine
 * De-energizes mechanical relay and clamps PWM to 0% upon anomaly or thermal runaway.
 */
struct HardwareFailSafeInterlock {
    bool is_latched;
    uint32_t consecutive_discrepancies;

    void init(bool previously_latched, uint32_t prior_anomalies) {
        is_latched = previously_latched;
        consecutive_discrepancies = prior_anomalies;
    }

    /**
     * @brief Evaluates safety conditions and enforces cutoff if tripped
     * @param process_var Current fused temperature (°C)
     * @param temp_s1 Raw sensor 1 temperature (°C)
     * @param temp_s2 Raw sensor 2 temperature (°C)
     * @param dt Time delta (seconds)
     * @param prev_temp Previous temperature for slew rate check (°C)
     * @return true if safe to operate, false if fail-safe interlock is triggered/latched
     */
    bool evaluate(float process_var, float temp_s1, float temp_s2, float dt, float prev_temp) {
        if (is_latched) {
            enforceHardwareCutoff();
            return false;
        }

        // Check 1: Critical High / Low Temperature Exceeded
        if (process_var > SystemTuning::CRITICAL_MAX_TEMP_C || process_var < SystemTuning::CRITICAL_MIN_TEMP_C) {
            tripInterlock();
            return false;
        }

        // Check 2: Thermal Runaway Rate of Change (|dT/dt| > 4.0°C/s)
        if (dt > 0.0f) {
            float slew_rate = fabsf(process_var - prev_temp) / dt;
            if (slew_rate > SystemTuning::MAX_SLEW_RATE_C_PER_SEC) {
                tripInterlock();
                return false;
            }
        }

        // Check 3: Sensor Discrepancy (|S1 - S2| > 5.0°C for >= 3 consecutive cycles)
        float sensor_diff = fabsf(temp_s1 - temp_s2);
        if (sensor_diff > SystemTuning::SENSOR_DISCREPANCY_MAX_C) {
            consecutive_discrepancies++;
            if (consecutive_discrepancies >= 3) {
                tripInterlock();
                return false;
            }
        } else {
            consecutive_discrepancies = 0;
        }

        // System safe: Energize safety relay, enable normal PWM operation
        armInterlock();
        return true;
    }

    void tripInterlock() {
        is_latched = true;
        enforceHardwareCutoff();
    }

    void resetInterlock() {
        is_latched = false;
        consecutive_discrepancies = 0;
        armInterlock();
    }

    void enforceHardwareCutoff() {
        // Immediate Cutoff: De-energize safety relay (interlock open)
        digitalWrite(HardwareConfig::PIN_FAILSAFE_RELAY, LOW);

        // Clamp hardware PWM to 0% duty
        ledcWrite(HardwareConfig::PWM_CHANNEL, 0);

        // Turn on Alarm LED
        digitalWrite(HardwareConfig::PIN_STATUS_LED, HIGH);
    }

    void armInterlock() {
        // Energize safety relay (interlock closed)
        digitalWrite(HardwareConfig::PIN_FAILSAFE_RELAY, HIGH);

        // Turn off Alarm LED
        digitalWrite(HardwareConfig::PIN_STATUS_LED, LOW);
    }
};

// ============================================================================
// SYSTEM INSTANCES
// ============================================================================
static MultiSensorKalmanFilter   g_kalman_filter;
static PIDController             g_pid_controller;
static HardwareFailSafeInterlock g_failsafe;

// ============================================================================
// HELPER FUNCTIONS: SENSOR READING & CONVERSION
// ============================================================================

/**
 * @brief Reads analog temperature from TMP36 or calibrated analog sensor
 * Conversion: V_out = (ADC_count / 4095.0) * 3.3V
 * Temp = (V_out - 0.5V) * 100.0 °C/V (TMP36 standard transfer function)
 */
float readAnalogTemperature(uint8_t pin) {
    uint32_t raw_adc = analogRead(pin);
    float voltage = (static_cast<float>(raw_adc) / HardwareConfig::ADC_MAX_COUNTS) * HardwareConfig::ADC_VREF_VOLTS;
    float temperature = (voltage - 0.5f) * 100.0f;
    return temperature;
}

/**
 * @brief Reads Li-ion battery voltage via resistor divider
 * Range: 3.0V (0% empty) to 4.2V (100% full nominal Li-ion cell)
 */
float readBatteryVoltage() {
    uint32_t raw_adc = analogRead(HardwareConfig::PIN_BATTERY_SENSE);
    float sensed_voltage = (static_cast<float>(raw_adc) / HardwareConfig::ADC_MAX_COUNTS) * HardwareConfig::ADC_VREF_VOLTS;
    return sensed_voltage * HardwareConfig::VOLTAGE_DIVIDER_RATIO;
}

/**
 * @brief Ultra-Low-Power Deep-Sleep Entry Routine
 * Configures timer wakeup for 60 seconds and enters deep sleep.
 * Battery Autonomy Calculation:
 * - C_battery: 3000 mAh Li-ion (90% usable = 2700 mAh)
 * - I_active:  80.0 mA for T_active = 0.20 s
 * - I_sleep:   0.015 mA (15 uA) for T_sleep = 60.0 s
 * - I_avg = (80.0 * 0.20 + 0.015 * 60.0) / 60.20 = 0.2807 mA
 * - Autonomy = 2700 / (0.2807 * 24) = 400.7 days (> 185 days / > 6 months requirement)
 */
void enterDeepSleep() {
    // Preserve persistent states in RTC memory
    rtc_boot_count++;
    rtc_last_process_variable = g_kalman_filter.state_estimate;
    rtc_pid_integral          = g_pid_controller.integral;
    rtc_kalman_state          = g_kalman_filter.state_estimate;
    rtc_kalman_covariance     = g_kalman_filter.error_covariance;
    rtc_failsafe_latched      = g_failsafe.is_latched;
    rtc_consecutive_anomalies = g_failsafe.consecutive_discrepancies;

    // Flush serial outputs prior to sleep
    Serial.flush();

    // Configure deep-sleep timer wakeup (60 seconds)
    esp_sleep_enable_timer_wakeup(SystemTuning::SLEEP_INTERVAL_SECONDS * SystemTuning::U_SEC_TO_SEC_FACTOR);

    // Enter ultra-low-power deep sleep
    esp_deep_sleep_start();
}

// ============================================================================
// ARDUINO SETUP & CONTROL CYCLE EXECUTION
// ============================================================================
void setup() {
    uint32_t start_wake_time = millis();
    Serial.begin(115200);

    // 1. Initialize GPIO Hardware Direction & Initial Safe States
    pinMode(HardwareConfig::PIN_FAILSAFE_RELAY, OUTPUT);
    digitalWrite(HardwareConfig::PIN_FAILSAFE_RELAY, LOW); // Safe default: Relay de-energized

    pinMode(HardwareConfig::PIN_STATUS_LED, OUTPUT);
    digitalWrite(HardwareConfig::PIN_STATUS_LED, LOW);

    // Configure ADC precision (12-bit, 11dB attenuation for full 0-3.3V range)
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);

    // 2. Configure Hardware PWM Timer (LEDC Peripheral)
    ledcSetup(HardwareConfig::PWM_CHANNEL, HardwareConfig::PWM_FREQ_HZ, HardwareConfig::PWM_RESOLUTION_BITS);
    ledcAttachPin(HardwareConfig::PIN_HEATER_PWM, HardwareConfig::PWM_CHANNEL);
    ledcWrite(HardwareConfig::PWM_CHANNEL, 0); // Safe default: 0% duty

    // 3. Inspect Deep-Sleep Wakeup Cause
    esp_sleep_wakeup_cause_t wakeup_cause = esp_sleep_get_wakeup_cause();

    // 4. Initialize Subsystem States (Restoring from RTC memory if waking from sleep)
    float initial_temp = (wakeup_cause == ESP_SLEEP_WAKEUP_TIMER) ? rtc_kalman_state : SystemTuning::NOMINAL_SETPOINT_C;
    float initial_cov  = (wakeup_cause == ESP_SLEEP_WAKEUP_TIMER) ? rtc_kalman_covariance : 1.0f;

    g_kalman_filter.init(
        initial_temp,
        initial_cov,
        SystemTuning::KALMAN_PROCESS_NOISE_Q,
        SystemTuning::SENSOR_1_VARIANCE,
        SystemTuning::SENSOR_2_VARIANCE
    );

    g_pid_controller.init(
        SystemTuning::DEFAULT_KP,
        SystemTuning::DEFAULT_KI,
        SystemTuning::DEFAULT_KD,
        SystemTuning::NOMINAL_SETPOINT_C,
        SystemTuning::INTEGRAL_ANTI_WINDUP_MAX,
        SystemTuning::DERIVATIVE_FILTER_ALPHA,
        0.0f,
        100.0f
    );

    if (wakeup_cause == ESP_SLEEP_WAKEUP_TIMER) {
        g_pid_controller.integral = rtc_pid_integral;
    }

    g_failsafe.init(rtc_failsafe_latched, rtc_consecutive_anomalies);

    // 5. Read Redundant Temperature Sensors
    float raw_temp_s1 = readAnalogTemperature(HardwareConfig::PIN_PRIMARY_TEMP_ADC);
    float raw_temp_s2 = readAnalogTemperature(HardwareConfig::PIN_SECONDARY_TEMP_ADC);
    float battery_v   = readBatteryVoltage();

    // 6. Perform Variance-Weighted Multi-Sensor Fusion
    float fused_reading  = 0.0f;
    float fused_variance = 0.0f;
    bool sensors_consistent = g_kalman_filter.fuseObservations(raw_temp_s1, raw_temp_s2, &fused_reading, &fused_variance);

    // 7. Execute Discrete 1D Kalman Filter Step
    float process_variable = g_kalman_filter.step(fused_reading, fused_variance);

    // 8. Evaluate Hardware Safety Interlock
    float dt = (wakeup_cause == ESP_SLEEP_WAKEUP_TIMER) ? static_cast<float>(SystemTuning::SLEEP_INTERVAL_SECONDS) : 1.0f;
    bool is_safe = g_failsafe.evaluate(process_variable, raw_temp_s1, raw_temp_s2, dt, rtc_last_process_variable);

    // 9. Compute Closed-Loop PID Control Effort
    float control_effort_pct = 0.0f;
    uint32_t pwm_register_value = 0;

    if (is_safe) {
        control_effort_pct = g_pid_controller.compute(SystemTuning::NOMINAL_SETPOINT_C, process_variable, dt);
        pwm_register_value = static_cast<uint32_t>(roundf((control_effort_pct / 100.0f) * HardwareConfig::PWM_MAX_DUTY));
        ledcWrite(HardwareConfig::PWM_CHANNEL, pwm_register_value);
    } else {
        g_failsafe.enforceHardwareCutoff();
    }

    bool within_tolerance = g_pid_controller.isWithinTolerance(process_variable);

    // 10. Transmit Industrial Telemetry Packet via UART / MQTT Bridge
    uint32_t wake_duration_ms = millis() - start_wake_time;
    rtc_cumulative_active_ms += wake_duration_ms;

    Serial.printf(
        "{\"boot\":%u,\"s1\":%.2f,\"s2\":%.2f,\"pv\":%.2f,\"sp\":%.2f,\"pwm_pct\":%.1f,"
        "\"pwm_reg\":%u,\"tol_ok\":%s,\"safe\":%s,\"v_bat\":%.2f,\"wake_ms\":%u}\n",
        rtc_boot_count,
        raw_temp_s1,
        raw_temp_s2,
        process_variable,
        SystemTuning::NOMINAL_SETPOINT_C,
        control_effort_pct,
        pwm_register_value,
        within_tolerance ? "true" : "false",
        is_safe ? "true" : "false",
        battery_v,
        wake_duration_ms
    );

    // 11. Schedule Deep Sleep if in remote autonomous mode
    // (Under testbench loop mode, delay and continue; in production battery node, enter deep sleep)
    #ifndef CONTINUOUS_TEST_BENCH_MODE
    enterDeepSleep();
    #endif
}

void loop() {
    // In continuous testbench mode (if defined), execute periodic control loop
    delay(1000);
}
