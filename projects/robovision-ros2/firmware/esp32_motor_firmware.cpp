/**
 * ============================================================================
 * RoboVision: Dual-Core ESP32 Motor Controller & Odometry Firmware
 * Author: Mohamed Seddik Feki <seddikfeki15@gmail.com>
 * Target: ESP32-WROOM-32D (240 MHz Dual Core)
 * Framework: Arduino / ESP-IDF with FreeRTOS
 * License: Apache-2.0
 * ============================================================================
 * Features:
 *   - Hardware interrupt quadrature encoder decoding (IRAM_ATTR)
 *   - Dual discrete PID velocity controllers with integral anti-windup
 *   - Differential-drive forward and inverse kinematics (v, omega <-> v_L, v_R)
 *   - 20 kHz ultrasonic hardware PWM generation via ESP32 LEDC peripheral
 *   - FreeRTOS dual-core task separation: Core 0 PID loop (100 Hz), Core 1 Serial/IMU (50 Hz)
 *   - Watchdog safety timer for automatic emergency motor shutdown upon loss of ROS2 comms
 * ============================================================================
 */

#include <Arduino.h>
#include <esp_attr.h>
#include <driver/ledc.h>
#include <math.h>

// ============================================================================
// 1. Hardware Pinout Definitions
// ============================================================================

// Left Motor (LEDC Channel 0, TB6612FNG Driver)
constexpr int PIN_LEFT_PWM      = 18;
constexpr int PIN_LEFT_IN1      = 19;
constexpr int PIN_LEFT_IN2      = 21;
constexpr int PIN_LEFT_ENC_A    = 34; // Dedicated input-only GPIO
constexpr int PIN_LEFT_ENC_B    = 35; // Dedicated input-only GPIO

// Right Motor (LEDC Channel 1, TB6612FNG Driver)
constexpr int PIN_RIGHT_PWM     = 22;
constexpr int PIN_RIGHT_IN1     = 23;
constexpr int PIN_RIGHT_IN2     = 25;
constexpr int PIN_RIGHT_ENC_A   = 32;
constexpr int PIN_RIGHT_ENC_B   = 33;

// System Diagnostics & Battery Sense
constexpr int PIN_BATTERY_SENSE = 36; // ADC1_CH0 (100k / 20k resistor divider)
constexpr int PIN_STATUS_LED    = 2;  // Onboard blue LED

// ============================================================================
// 2. Robot Physical Parameters & Constants
// ============================================================================

constexpr float WHEEL_RADIUS_M          = 0.0330f; // 66 mm wheel diameter
constexpr float TRACK_WIDTH_M           = 0.1600f; // 160 mm wheelbase track
constexpr float TICKS_PER_REVOLUTION    = 1440.0f; // 11 PPR * 32.7:1 gear ratio * 4x decoding
constexpr float METERS_PER_TICK         = (2.0f * M_PI * WHEEL_RADIUS_M) / TICKS_PER_REVOLUTION;

// PWM Configuration
constexpr int PWM_FREQ_HZ               = 20000; // 20 kHz ultrasonic frequency (eliminates audible motor whine)
constexpr int PWM_RESOLUTION_BITS       = 8;     // 8-bit resolution: 0 - 255
constexpr int PWM_CHANNEL_LEFT          = 0;
constexpr int PWM_CHANNEL_RIGHT         = 1;
constexpr int PWM_MAX_DUTY              = 255;
constexpr int PWM_DEADBAND              = 18;    // Minimum PWM to overcome motor stiction

// Timing Configuration
constexpr uint32_t CONTROL_PERIOD_MS    = 10;    // 100 Hz discrete PID control frequency
constexpr uint32_t TELEMETRY_PERIOD_MS  = 20;    // 50 Hz ROS2 telemetry broadcast rate
constexpr uint32_t WATCHDOG_TIMEOUT_MS  = 500;   // Auto-stop motors if no cmd_vel received in 500ms

// ============================================================================
// 3. Volatile Encoder Counters (Protected by ISR)
// ============================================================================

volatile int64_t g_left_encoder_ticks  = 0;
volatile int64_t g_right_encoder_ticks = 0;
portMUX_TYPE g_encoder_spinlock = portMUX_INITIALIZER_UNLOCKED;

// High-speed Quadrature Decoding ISR for Left Wheel (placed in IRAM)
void IRAM_ATTR leftEncoderISR() {
  portENTER_CRITICAL_ISR(&g_encoder_spinlock);
  int b_val = digitalRead(PIN_LEFT_ENC_B);
  if (b_val > 0) {
    g_left_encoder_ticks++;
  } else {
    g_left_encoder_ticks--;
  }
  portEXIT_CRITICAL_ISR(&g_encoder_spinlock);
}

// High-speed Quadrature Decoding ISR for Right Wheel (placed in IRAM)
void IRAM_ATTR rightEncoderISR() {
  portENTER_CRITICAL_ISR(&g_encoder_spinlock);
  int b_val = digitalRead(PIN_RIGHT_ENC_B);
  if (b_val > 0) {
    g_right_encoder_ticks--; // Inverted due to mirrored motor mounting
  } else {
    g_right_encoder_ticks++;
  }
  portEXIT_CRITICAL_ISR(&g_encoder_spinlock);
}

// ============================================================================
// 4. Discrete PID Velocity Controller Struct & Implementation
// ============================================================================

struct PIDController {
  float kp;
  float ki;
  float kd;
  float integral;
  float prev_error;
  float max_integral;
  float min_output;
  float max_output;

  void init(float p, float i, float d, float max_i, float min_out, float max_out) {
    kp = p;
    ki = i;
    kd = d;
    integral = 0.0f;
    prev_error = 0.0f;
    max_integral = max_i;
    min_output = min_out;
    max_output = max_out;
  }

  void reset() {
    integral = 0.0f;
    prev_error = 0.0f;
  }

  float compute(float target, float measured, float dt) {
    if (!isfinite(target) || !isfinite(measured) || dt <= 0.0f) {
      return 0.0f;
    }
    float error = target - measured;

    // Numerical integration with anti-windup clamping
    integral += error * dt;
    if (integral > max_integral) integral = max_integral;
    else if (integral < -max_integral) integral = -max_integral;

    // Filtered derivative
    float derivative = (dt > 1e-4f) ? ((error - prev_error) / dt) : 0.0f;
    prev_error = error;

    float output = (kp * error) + (ki * integral) + (kd * derivative);

    // Output clamping
    if (output > max_output) output = max_output;
    else if (output < min_output) output = min_output;

    return output;
  }
};

// ============================================================================
// 5. System State & Global Controllers
// ============================================================================

PIDController g_pid_left;
PIDController g_pid_right;

// Desired velocities from ROS2 /cmd_vel
float g_target_linear_vel  = 0.0f; // m/s
float g_target_angular_vel = 0.0f; // rad/s
float g_target_left_speed  = 0.0f; // m/s
float g_target_right_speed = 0.0f; // m/s

// Measured velocities from encoder feedback
float g_measured_left_speed  = 0.0f; // m/s
float g_measured_right_speed = 0.0f; // m/s
float g_measured_left_rpm    = 0.0f; // RPM
float g_measured_right_rpm   = 0.0f; // RPM

// Dead-reckoning robot pose
float g_robot_x   = 0.0f; // m
float g_robot_y   = 0.0f; // m
float g_robot_yaw = 0.0f; // rad

uint32_t g_last_cmd_timestamp = 0;
bool g_emergency_stop_active  = false;

// FreeRTOS Task Handles
TaskHandle_t g_task_control_handle   = nullptr;
TaskHandle_t g_task_telemetry_handle = nullptr;

// ============================================================================
// 6. Kinematics & Motor Actuation Functions
// ============================================================================

/**
 * Computes individual left/right wheel linear target speeds from a chassis Twist (v, omega).
 * Differential Drive Inverse Kinematics:
 *   v_L = v - (omega * TRACK_WIDTH / 2)
 *   v_R = v + (omega * TRACK_WIDTH / 2)
 */
void computeWheelVelocitiesFromTwist(float linear_x, float angular_z, float &out_left, float &out_right) {
  out_left  = linear_x - (angular_z * TRACK_WIDTH_M * 0.5f);
  out_right = linear_x + (angular_z * TRACK_WIDTH_M * 0.5f);
}

/**
 * Updates dead reckoning odometry from incremental encoder tick readings.
 */
void updateOdometryFromTicks(int64_t delta_left, int64_t delta_right) {
  float dist_left  = static_cast<float>(delta_left) * METERS_PER_TICK;
  float dist_right = static_cast<float>(delta_right) * METERS_PER_TICK;
  float delta_dist = (dist_right + dist_left) * 0.5f;
  float delta_yaw  = (dist_right - dist_left) / TRACK_WIDTH_M;

  // 2nd-order Runge-Kutta pose integration
  float mid_yaw = g_robot_yaw + (delta_yaw * 0.5f);
  g_robot_x += delta_dist * cosf(mid_yaw);
  g_robot_y += delta_dist * sinf(mid_yaw);
  g_robot_yaw += delta_yaw;

  // Normalize yaw to [-PI, PI]
  if (!isfinite(g_robot_yaw)) g_robot_yaw = 0.0f;
  while (g_robot_yaw > static_cast<float>(M_PI))  g_robot_yaw -= static_cast<float>(2.0 * M_PI);
  while (g_robot_yaw < -static_cast<float>(M_PI)) g_robot_yaw += static_cast<float>(2.0 * M_PI);
}

/**
 * Drives hardware H-Bridge with direction GPIOs and LEDC PWM channel.
 */
void setMotorPwm(int pwm_channel, int pin_in1, int pin_in2, float control_effort) {
  int duty = static_cast<int>(fabsf(control_effort));
  if (duty > PWM_MAX_DUTY) duty = PWM_MAX_DUTY;

  // Overcome stiction deadband if non-zero effort demanded
  if (duty > 0 && duty < PWM_DEADBAND) {
    duty = PWM_DEADBAND;
  }

  if (control_effort > 0.01f) {
    digitalWrite(pin_in1, HIGH);
    digitalWrite(pin_in2, LOW);
    ledcWrite(pwm_channel, duty);
  } else if (control_effort < -0.01f) {
    digitalWrite(pin_in1, LOW);
    digitalWrite(pin_in2, HIGH);
    ledcWrite(pwm_channel, duty);
  } else {
    // Active brake / coast
    digitalWrite(pin_in1, LOW);
    digitalWrite(pin_in2, LOW);
    ledcWrite(pwm_channel, 0);
  }
}

/**
 * Reads battery voltage via ADC with calibration scaling.
 */
float readBatteryVoltage() {
  uint32_t raw = analogRead(PIN_BATTERY_SENSE);
  // ADC reference: 3.3V, 12-bit (4095), voltage divider ratio: (100k + 20k) / 20k = 6.0
  float pin_voltage = (static_cast<float>(raw) / 4095.0f) * 3.3f;
  return pin_voltage * 6.0f;
}

// ============================================================================
// 7. FreeRTOS Tasks
// ============================================================================

/**
 * High-Priority Task 1: 100 Hz Discrete PID Velocity Control Loop (Pinned to Core 0)
 */
void TaskControlLoop(void *pvParameters) {
  TickType_t last_wake_time = xTaskGetTickCount();
  const TickType_t period_ticks = pdMS_TO_TICKS(CONTROL_PERIOD_MS);

  int64_t prev_ticks_left  = 0;
  int64_t prev_ticks_right = 0;
  float dt = static_cast<float>(CONTROL_PERIOD_MS) / 1000.0f;

  for (;;) {
    vTaskDelayUntil(&last_wake_time, period_ticks);

    // 1. Snapshot encoder ticks under spinlock protection
    int64_t cur_ticks_left, cur_ticks_right;
    portENTER_CRITICAL(&g_encoder_spinlock);
    cur_ticks_left  = g_left_encoder_ticks;
    cur_ticks_right = g_right_encoder_ticks;
    portEXIT_CRITICAL(&g_encoder_spinlock);

    int64_t delta_ticks_left  = cur_ticks_left - prev_ticks_left;
    int64_t delta_ticks_right = cur_ticks_right - prev_ticks_right;
    prev_ticks_left  = cur_ticks_left;
    prev_ticks_right = cur_ticks_right;

    // 2. Compute measured velocities (m/s) & RPM
    g_measured_left_speed  = (static_cast<float>(delta_ticks_left) * METERS_PER_TICK) / dt;
    g_measured_right_speed = (static_cast<float>(delta_ticks_right) * METERS_PER_TICK) / dt;
    g_measured_left_rpm    = (g_measured_left_speed / (2.0f * M_PI * WHEEL_RADIUS_M)) * 60.0f;
    g_measured_right_rpm   = (g_measured_right_speed / (2.0f * M_PI * WHEEL_RADIUS_M)) * 60.0f;

    // 3. Accumulate dead-reckoning odometry
    updateOdometryFromTicks(delta_ticks_left, delta_ticks_right);

    // 4. Watchdog Check: Shut down motors if ROS2 cmd_vel stream drops
    uint32_t now = millis();
    if (now - g_last_cmd_timestamp > WATCHDOG_TIMEOUT_MS) {
      g_target_linear_vel  = 0.0f;
      g_target_angular_vel = 0.0f;
      g_target_left_speed  = 0.0f;
      g_target_right_speed = 0.0f;
      g_emergency_stop_active = true;
    } else {
      g_emergency_stop_active = false;
    }

    // 5. Compute PID control effort
    float effort_left  = g_pid_left.compute(g_target_left_speed, g_measured_left_speed, dt);
    float effort_right = g_pid_right.compute(g_target_right_speed, g_measured_right_speed, dt);

    // If zero target speed commanded, hard stop motors and clear integral accumulators
    if (fabsf(g_target_left_speed) < 1e-4f) {
      effort_left = 0.0f;
      g_pid_left.reset();
    }
    if (fabsf(g_target_right_speed) < 1e-4f) {
      effort_right = 0.0f;
      g_pid_right.reset();
    }

    // 6. Actuate H-Bridge PWM
    setMotorPwm(PWM_CHANNEL_LEFT, PIN_LEFT_IN1, PIN_LEFT_IN2, effort_left);
    setMotorPwm(PWM_CHANNEL_RIGHT, PIN_RIGHT_IN1, PIN_RIGHT_IN2, effort_right);
  }
}

/**
 * Task 2: 50 Hz ROS2 Telemetry Streaming & Serial Command Parser (Pinned to Core 1)
 */
void TaskTelemetry(void *pvParameters) {
  TickType_t last_wake_time = xTaskGetTickCount();
  const TickType_t period_ticks = pdMS_TO_TICKS(TELEMETRY_PERIOD_MS);

  char serial_buffer[128];
  int buf_idx = 0;

  for (;;) {
    vTaskDelayUntil(&last_wake_time, period_ticks);

    // 1. Inbound Serial Command Parser (format: "CMD,linear_x,angular_z\n")
    while (Serial.available() > 0) {
      char c = static_cast<char>(Serial.read());
      if (c == '\n' || c == '\r') {
        if (buf_idx > 0) {
          serial_buffer[buf_idx] = '\0';
          if (strncmp(serial_buffer, "CMD,", 4) == 0) {
            float v = 0.0f, w = 0.0f;
            if (sscanf(serial_buffer + 4, "%f,%f", &v, &w) == 2) {
              g_target_linear_vel  = v;
              g_target_angular_vel = w;
              computeWheelVelocitiesFromTwist(v, w, g_target_left_speed, g_target_right_speed);
              g_last_cmd_timestamp = millis();
            }
          } else if (strcmp(serial_buffer, "STOP") == 0) {
            g_target_linear_vel  = 0.0f;
            g_target_angular_vel = 0.0f;
            g_target_left_speed  = 0.0f;
            g_target_right_speed = 0.0f;
            g_last_cmd_timestamp = 0;
          }
          buf_idx = 0;
        }
      } else if (buf_idx < static_cast<int>(sizeof(serial_buffer) - 1)) {
        serial_buffer[buf_idx++] = c;
      }
    }

    // 2. Outbound Telemetry JSON Packet
    float battery_voltage = readBatteryVoltage();
    int64_t ticks_l, ticks_r;
    portENTER_CRITICAL(&g_encoder_spinlock);
    ticks_l = g_left_encoder_ticks;
    ticks_r = g_right_encoder_ticks;
    portEXIT_CRITICAL(&g_encoder_spinlock);

    Serial.printf(
      "{\"vl\":%.3f,\"vr\":%.3f,\"rpml\":%.1f,\"rpmr\":%.1f,\"tl\":%lld,\"tr\":%lld,\"x\":%.3f,\"y\":%.3f,\"yaw\":%.3f,\"bat\":%.2f,\"estop\":%d}\n",
      g_measured_left_speed,
      g_measured_right_speed,
      g_measured_left_rpm,
      g_measured_right_rpm,
      ticks_l,
      ticks_r,
      g_robot_x,
      g_robot_y,
      g_robot_yaw,
      battery_voltage,
      g_emergency_stop_active ? 1 : 0
    );

    // Heartbeat LED toggle
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
}

// ============================================================================
// 8. Arduino Setup & Main Loop
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(100);

  // Initialize GPIO Directions
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BATTERY_SENSE, INPUT);

  pinMode(PIN_LEFT_IN1, OUTPUT);
  pinMode(PIN_LEFT_IN2, OUTPUT);
  pinMode(PIN_RIGHT_IN1, OUTPUT);
  pinMode(PIN_RIGHT_IN2, OUTPUT);

  // GPIO 34/35 are input-only pins without internal pull-ups (external pull-ups required)
  pinMode(PIN_LEFT_ENC_A, INPUT);
  pinMode(PIN_LEFT_ENC_B, INPUT);
  pinMode(PIN_RIGHT_ENC_A, INPUT_PULLUP);
  pinMode(PIN_RIGHT_ENC_B, INPUT_PULLUP);

  // Attach Hardware Interrupts for Quadrature Encoders
  attachInterrupt(digitalPinToInterrupt(PIN_LEFT_ENC_A), leftEncoderISR, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_RIGHT_ENC_A), rightEncoderISR, RISING);

  // Configure ESP32 LEDC Hardware PWM Channels
  ledcSetup(PWM_CHANNEL_LEFT, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(PIN_LEFT_PWM, PWM_CHANNEL_LEFT);
  ledcWrite(PWM_CHANNEL_LEFT, 0);

  ledcSetup(PWM_CHANNEL_RIGHT, PWM_FREQ_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(PIN_RIGHT_PWM, PWM_CHANNEL_RIGHT);
  ledcWrite(PWM_CHANNEL_RIGHT, 0);

  // Initialize Discrete Velocity PID Controllers (Tuned for 12V 34:1 DC Gearmotors)
  // Kp=180.0, Ki=45.0, Kd=2.5, MaxIntegral=80.0, MinOut=-255.0, MaxOut=255.0
  g_pid_left.init(180.0f, 45.0f, 2.5f, 80.0f, -255.0f, 255.0f);
  g_pid_right.init(180.0f, 45.0f, 2.5f, 80.0f, -255.0f, 255.0f);

  g_last_cmd_timestamp = millis();

  // Create Pinned FreeRTOS Tasks
  xTaskCreatePinnedToCore(
    TaskControlLoop,
    "TaskControlLoop",
    4096,
    nullptr,
    2, // Higher priority for hard real-time control
    &g_task_control_handle,
    0  // Pin to Core 0
  );

  xTaskCreatePinnedToCore(
    TaskTelemetry,
    "TaskTelemetry",
    4096,
    nullptr,
    1, // Normal priority for serial I/O
    &g_task_telemetry_handle,
    1  // Pin to Core 1
  );
}

void loop() {
  // Main loop remains idle; operations managed by FreeRTOS tasks
  vTaskDelay(pdMS_TO_TICKS(1000));
}
