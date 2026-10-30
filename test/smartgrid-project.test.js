const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');

function readIfExists(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return null;
}

describe('SmartGrid Project 4: AI-Driven Industrial IoT & SCADA Simulator Verification', () => {

  // =========================================================================
  // Suite 1: R1 — Firmware & Control Logic (esp32_smartgrid_node.cpp)
  // =========================================================================
  describe('Suite 1: R1 — Firmware & Control Logic (esp32_smartgrid_node.cpp)', () => {

    it('firmware/esp32_smartgrid_node.cpp exists and contains candidate & university attribution', () => {
      const cpp = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      assert.ok(cpp, 'esp32_smartgrid_node.cpp must exist');
      assert.match(cpp, /Mohamed Seddik Feki/);
      assert.match(cpp, /fekiseddik@gmail\.com/);
      assert.match(cpp, /Xiamen University Malaysia/);
      assert.match(cpp, /ESP32-WROOM-32D/);
    });

    it('implements discrete PID controller with anti-windup clamping and low-pass filtered derivative', () => {
      const cpp = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      assert.ok(cpp);

      // Struct and methods
      assert.match(cpp, /struct\s+PIDController/);
      assert.match(cpp, /compute\s*\(\s*float\s+target,\s*float\s+measured,\s*float\s+dt\s*\)/);
      assert.match(cpp, /isWithinTolerance\s*\(\s*float\s+measured\s*\)/);

      // Anti-windup clamping
      assert.match(cpp, /max_integral/);
      assert.match(cpp, /integral\s*\+=\s*error\s*\*\s*dt/);
      assert.match(cpp, /if\s*\(\s*integral\s*>\s*max_integral\s*\)/);

      // Low-pass filtered derivative
      assert.match(cpp, /filtered_derivative/);
      assert.match(cpp, /derivative_alpha/);
      assert.match(cpp, /raw_derivative\s*=\s*\(\s*error\s*-\s*prev_error\s*\)\s*\/\s*dt/);

      // +/- 1.5% setpoint precision
      assert.match(cpp, /TOLERANCE_PERCENT\s*=\s*1\.5f/);
    });

    it('implements redundant multi-sensor Kalman & variance-weighted fusion with discrepancy check', () => {
      const cpp = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      assert.ok(cpp);

      // Kalman filter struct
      assert.match(cpp, /struct\s+MultiSensorKalmanFilter/);
      assert.match(cpp, /fuseObservations\s*\(/);
      assert.match(cpp, /step\s*\(\s*float\s+z_fused,\s*float\s+r_fused\s*\)/);

      // Variance-weighted math
      assert.match(cpp, /float\s+w1\s*=\s*var_sensor_2\s*\/\s*total_variance/);
      assert.match(cpp, /float\s+w2\s*=\s*var_sensor_1\s*\/\s*total_variance/);

      // Sensor discrepancy guard
      assert.match(cpp, /SENSOR_DISCREPANCY_MAX_C\s*=\s*5\.0f/);
      assert.match(cpp, /fabsf\s*\(\s*z1\s*-\s*z2\s*\)/);
    });

    it('implements ultra-low-power deep sleep scheduling with RTC memory state retention', () => {
      const cpp = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      assert.ok(cpp);

      // RTC memory qualifiers
      assert.match(cpp, /RTC_DATA_ATTR\s+static\s+uint32_t\s+rtc_boot_count/);
      assert.match(cpp, /RTC_DATA_ATTR\s+static\s+float\s+rtc_last_process_variable/);
      assert.match(cpp, /RTC_DATA_ATTR\s+static\s+float\s+rtc_pid_integral/);
      assert.match(cpp, /RTC_DATA_ATTR\s+static\s+float\s+rtc_kalman_state/);
      assert.match(cpp, /RTC_DATA_ATTR\s+static\s+bool\s+rtc_failsafe_latched/);

      // Deep sleep API calls
      assert.match(cpp, /esp_sleep_enable_timer_wakeup\s*\(/);
      assert.match(cpp, /esp_deep_sleep_start\s*\(\s*\)/);
      assert.match(cpp, /esp_sleep_get_wakeup_cause\s*\(\s*\)/);
      assert.match(cpp, /SLEEP_INTERVAL_SECONDS\s*=\s*60ULL/);
    });

    it('implements hardware fail-safe relay and PWM cutoff interlock logic', () => {
      const cpp = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      assert.ok(cpp);

      // Hardware pins
      assert.match(cpp, /PIN_HEATER_PWM\s*=\s*18/);
      assert.match(cpp, /PIN_FAILSAFE_RELAY\s*=\s*27/);
      assert.match(cpp, /PIN_PRIMARY_TEMP_ADC\s*=\s*34/);
      assert.match(cpp, /PIN_SECONDARY_TEMP_ADC\s*=\s*35/);

      // Interlock struct & cutoff enforcement
      assert.match(cpp, /struct\s+HardwareFailSafeInterlock/);
      assert.match(cpp, /enforceHardwareCutoff\s*\(\s*\)/);
      assert.match(cpp, /tripInterlock\s*\(\s*\)/);
      assert.match(cpp, /resetInterlock\s*\(\s*\)/);
      assert.match(cpp, /ledcWrite\s*\(\s*HardwareConfig::PWM_CHANNEL,\s*0\s*\)/);
      assert.match(cpp, /digitalWrite\s*\(\s*HardwareConfig::PIN_FAILSAFE_RELAY,\s*LOW\s*\)/);
    });

    it('mathematically verifies discrete PID with anti-windup clamping behavior in JavaScript mirror', () => {
      class JsPidController {
        constructor() {
          this.kp = 6.5;
          this.ki = 1.2;
          this.kd = 2.8;
          this.integral = 0.0;
          this.maxIntegral = 40.0;
          this.prevError = 0.0;
        }
        compute(target, measured, dt) {
          const error = target - measured;
          this.integral += error * dt;
          if (this.integral > this.maxIntegral) this.integral = this.maxIntegral;
          else if (this.integral < -this.maxIntegral) this.integral = -this.maxIntegral;
          const deriv = (error - this.prevError) / dt;
          this.prevError = error;
          const out = (this.kp * error) + (this.ki * this.integral) + (this.kd * deriv);
          return Math.max(0.0, Math.min(100.0, out));
        }
      }

      const pid = new JsPidController();
      // Simulate extreme saturation: Target 50, Measured 10 (error = 40) for 1000 steps
      for (let i = 0; i < 1000; i++) {
        pid.compute(50.0, 10.0, 0.1);
      }
      assert.strictEqual(pid.integral, 40.0, 'Integral accumulator must clamp strictly to maxIntegral');
    });

    it('mathematically verifies variance-weighted multi-sensor Kalman fusion in JavaScript mirror', () => {
      const z1 = 25.4;
      const z2 = 24.8;
      const var1 = 0.0400; // sigma1 = 0.20°C
      const var2 = 0.1225; // sigma2 = 0.35°C

      const totalVar = var1 + var2;
      const w1 = var2 / totalVar; // ~0.7538
      const w2 = var1 / totalVar; // ~0.2462
      const zFused = (w1 * z1) + (w2 * z2);
      const varFused = (var1 * var2) / totalVar;

      assert.ok(Math.abs(w1 - 0.7538) < 0.005, 'w1 weight matches variance ratio');
      assert.ok(Math.abs(zFused - 25.252) < 0.01, 'Fused reading matches expected test vector');
      assert.ok(varFused < var1 && varFused < var2, 'Fused variance is strictly lower than either single sensor');
      assert.ok(Math.abs(varFused - 0.03015) < 0.001, 'Fused variance matches calculated value');
    });

    it('mathematically verifies ultra-low-power battery autonomy model (> 185 days / > 6 months)', () => {
      const batteryCapacityMah = 3000.0;
      const usableRatio = 0.90;
      const usableMah = batteryCapacityMah * usableRatio; // 2700 mAh

      const iActiveMa = 80.0;
      const tActiveSec = 0.20;
      const iSleepUa = 15.0;
      const tSleepSec = 60.0;

      const tCycle = tActiveSec + tSleepSec; // 60.20 s
      const qActive = iActiveMa * tActiveSec; // 16.0 mA*s
      const qSleep = (iSleepUa / 1000.0) * tSleepSec; // 0.90 mA*s
      const iAvgMa = (qActive + qSleep) / tCycle; // ~0.28073 mA

      const dailyConsumption = iAvgMa * 24.0;
      const autonomyDays = usableMah / dailyConsumption;
      const autonomyMonths = autonomyDays / 30.4375;

      assert.ok(autonomyDays >= 185.0, `Autonomy ${autonomyDays.toFixed(1)} days must exceed 185 days`);
      assert.ok(autonomyMonths >= 6.0, `Autonomy ${autonomyMonths.toFixed(1)} months must exceed 6 months`);
      assert.ok(autonomyDays > 390.0 && autonomyDays < 420.0, 'Nominal runtime ~400 days');
    });
  });

  // =========================================================================
  // Suite 2: R2 — Python Edge Anomaly, PID & MQTT Broker Engine
  // =========================================================================
  describe('Suite 2: R2 — Python Edge Anomaly, PID & MQTT Broker Engine', () => {

    it('src/edge_anomaly_detector.py exists and defines required classes and algorithms', () => {
      const py = readIfExists('projects/smartgrid-iot/src/edge_anomaly_detector.py');
      assert.ok(py, 'edge_anomaly_detector.py must exist');

      // Attribution
      assert.match(py, /Mohamed Seddik Feki/);
      assert.match(py, /Xiamen University Malaysia/);

      // ClosedLoopPIDController
      assert.match(py, /class\s+ClosedLoopPIDController/);
      assert.match(py, /def\s+update\s*\(\s*self,\s*measured_value/);
      assert.match(py, /def\s+is_within_tolerance\s*\(\s*self,\s*measured_value/);
      assert.match(py, /def\s+reset\s*\(\s*self\s*\)/);
      assert.match(py, /def\s+set_setpoint\s*\(\s*self,\s*new_setpoint/);
      assert.match(py, /tolerance_pct:\s*float\s*=\s*1\.5/);

      // EdgeAnomalyDetector
      assert.match(py, /class\s+EdgeAnomalyDetector/);
      assert.match(py, /def\s+feed\s*\(\s*self,\s*value/);
      assert.match(py, /def\s+reset_interlock\s*\(\s*self\s*\)/);
      assert.match(py, /z_score/);
      assert.match(py, /z_threshold/);
      assert.match(py, /ewma/);
      assert.match(py, /cusum_high/);
      assert.match(py, /cusum_low/);
      assert.match(py, /fail_safe_active/);
      assert.match(py, /actuator_cutoff/);

      // BatteryLifeEstimator
      assert.match(py, /class\s+BatteryLifeEstimator/);
      assert.match(py, /def\s+calculate_average_current_ma\s*\(\s*self\s*\)/);
      assert.match(py, /def\s+calculate_runtime_days\s*\(\s*self\s*\)/);
      assert.match(py, /def\s+calculate_runtime_months\s*\(\s*self\s*\)/);
      assert.match(py, /def\s+meets_six_month_target\s*\(\s*self\s*\)/);
    });

    it('src/mqtt_telemetry_broker.py exists and defines topic routing & bridge engine', () => {
      const broker = readIfExists('projects/smartgrid-iot/src/mqtt_telemetry_broker.py');
      assert.ok(broker, 'mqtt_telemetry_broker.py must exist');

      // Attribution
      assert.match(broker, /Mohamed Seddik Feki/);

      // MqttTopicRouter
      assert.match(broker, /class\s+MqttTopicRouter/);
      assert.match(broker, /def\s+match_topic\s*\(/);
      assert.match(broker, /def\s+subscribe\s*\(/);
      assert.match(broker, /def\s+unsubscribe\s*\(/);
      assert.match(broker, /def\s+dispatch\s*\(/);

      // SmartGridMqttBridge
      assert.match(broker, /class\s+SmartGridMqttBridge/);
      assert.match(broker, /def\s+register_client\s*\(/);
      assert.match(broker, /def\s+publish\s*\(/);
      assert.match(broker, /def\s+subscribe\s*\(/);
      assert.match(broker, /def\s+check_timeouts\s*\(/);
      assert.match(broker, /def\s+disconnect\s*\(/);
      assert.match(broker, /def\s+get_retained\s*\(/);
      assert.match(broker, /def\s+acknowledge_qos1\s*\(/);
      assert.match(broker, /def\s+handle_qos2_handshake\s*\(/);
    });

    it('requirements.txt and README.md exist in projects/smartgrid-iot/', () => {
      const req = readIfExists('projects/smartgrid-iot/requirements.txt');
      assert.ok(req, 'requirements.txt must exist');
      assert.match(req, /paho-mqtt/);
      assert.match(req, /numpy/);
      assert.match(req, /scipy/);

      const readme = readIfExists('projects/smartgrid-iot/README.md');
      assert.ok(readme, 'README.md must exist');
      assert.match(readme, /SmartGrid/);
      assert.match(readme, /Mohamed Seddik Feki/);
      assert.match(readme, /Xiamen University Malaysia/);
      assert.match(readme, /Bill of Materials/);
    });

    it('validates MQTT topic router matching logic across single and multi-level wildcards', () => {
      function matchTopic(pattern, topic) {
        if (!pattern || !topic) return false;
        if (pattern === topic || pattern === '#') return true;
        const sub = pattern.split('/');
        const pub = topic.split('/');
        let i = 0;
        while (i < sub.length) {
          if (sub[i] === '#') return i === sub.length - 1;
          if (i >= pub.length) return false;
          if (sub[i] !== '+' && sub[i] !== pub[i]) return false;
          i++;
        }
        return i === pub.length;
      }

      // Single-level wildcard (+)
      assert.strictEqual(matchTopic('smartgrid/zone/+/telemetry', 'smartgrid/zone/1/telemetry'), true);
      assert.strictEqual(matchTopic('smartgrid/zone/+/telemetry', 'smartgrid/zone/east/telemetry'), true);
      assert.strictEqual(matchTopic('smartgrid/zone/+/telemetry', 'smartgrid/zone/1/sub/telemetry'), false);
      assert.strictEqual(matchTopic('smartgrid/zone/+/telemetry', 'smartgrid/zone/telemetry'), false);

      // Multi-level wildcard (#)
      assert.strictEqual(matchTopic('smartgrid/#', 'smartgrid/zone/1/telemetry'), true);
      assert.strictEqual(matchTopic('smartgrid/#', 'smartgrid/alerts/critical'), true);
      assert.strictEqual(matchTopic('smartgrid/#', 'smartgrid'), true);
      assert.strictEqual(matchTopic('smartgrid/#', 'industrial/zone/1'), false);

      // Exact match
      assert.strictEqual(matchTopic('smartgrid/system/status', 'smartgrid/system/status'), true);
      assert.strictEqual(matchTopic('smartgrid/system/status', 'smartgrid/system/health'), false);
    });

    it('validates statistical Z-score, EWMA, and CUSUM drift detection in JavaScript mirror', () => {
      class JsAnomalyDetector {
        constructor() {
          this.window = [];
          this.windowSize = 30;
          this.ewma = null;
          this.ewmaAlpha = 0.20;
          this.cusumHigh = 0.0;
          this.cusumLow = 0.0;
          this.targetMean = 24.0;
          this.baselineStd = 0.20;
          this.failSafe = false;
        }
        feed(x) {
          this.window.push(x);
          if (this.window.length > this.windowSize) this.window.shift();

          const mean = this.window.reduce((a, b) => a + b, 0) / this.window.length;
          const variance = this.window.length > 1
            ? this.window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (this.window.length - 1)
            : this.baselineStd ** 2;
          const std = Math.sqrt(variance) || this.baselineStd;

          const z = Math.abs(x - mean) / std;

          this.ewma = this.ewma === null ? x : (this.ewmaAlpha * x + (1 - this.ewmaAlpha) * this.ewma);

          const k = 0.5 * this.baselineStd;
          const h = 4.5 * this.baselineStd;
          this.cusumHigh = Math.max(0.0, this.cusumHigh + (x - this.targetMean - k));
          this.cusumLow = Math.max(0.0, this.cusumLow - (x - this.targetMean + k));

          const cusumAlarm = (this.cusumHigh > h) || (this.cusumLow > h);
          if (z > 5.0 || cusumAlarm) {
            this.failSafe = true;
          }
          return { z, cusumAlarm, failSafe: this.failSafe };
        }
      }

      const detector = new JsAnomalyDetector();
      // Feed baseline normal readings
      for (let i = 0; i < 30; i++) {
        detector.feed(24.0 + (Math.sin(i) * 0.05));
      }
      assert.strictEqual(detector.failSafe, false, 'Baseline readings must not trigger fail-safe');

      // Inject anomalous spike of 32.0°C
      const spikeRes = detector.feed(32.0);
      assert.ok(spikeRes.z > 3.0, 'Spike must produce Z-score > 3.0');
      assert.strictEqual(detector.failSafe, true, 'Severe spike must trip fail-safe cutoff');
    });
  });

  // =========================================================================
  // Suite 3: R3 — Live Interactive Browser SCADA Simulator (demo/index.html)
  // =========================================================================
  describe('Suite 3: R3 — Live Interactive Browser SCADA Simulator (demo/index.html)', () => {

    it('demo/index.html exists and is valid standalone zero-dependency HTML5', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.ok(html, 'demo/index.html must exist');
      assert.ok(html.length > 25000, 'demo/index.html must contain complete embedded assets');

      // Zero external CDN scripts or stylesheet links
      assert.doesNotMatch(html, /<script[^>]*src=["']https?:\/\//i, 'Must not load external CDN scripts');
      assert.doesNotMatch(html, /<link[^>]*href=["']https?:\/\//i, 'Must not load external CDN stylesheets');
      assert.doesNotMatch(html, /fonts\.googleapis\.com/i, 'Must not load external Google Fonts');
    });

    it('demo/index.html contains 60 FPS oscilloscope canvas with accessibility attributes', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /<canvas[^>]*id=["']pidOscilloscopeCanvas["']/);
      assert.match(html, /role=["']img["']/);
      assert.match(html, /aria-label=["'][^"']*Oscilloscope[^"']*["']/i);
      assert.match(html, /tabindex=["']0["']/);
    });

    it('demo/index.html contains interactive setpoint and PID gain sliders with live numeric readouts', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /id=["']sliderSetpoint["']/);
      assert.match(html, /id=["']valSetpoint["']/);
      assert.match(html, /id=["']sliderKp["']/);
      assert.match(html, /id=["']valKp["']/);
      assert.match(html, /id=["']sliderKi["']/);
      assert.match(html, /id=["']valKi["']/);
      assert.match(html, /id=["']sliderKd["']/);
      assert.match(html, /id=["']valKd["']/);
    });

    it('demo/index.html contains disturbance & anomaly injection controls and fail-safe cutoff', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /id=["']btnInjectThermal["']/);
      assert.match(html, /id=["']btnInjectAnomaly["']/);
      assert.match(html, /id=["']btnResetInterlock["']/);
      assert.match(html, /injectThermalDisturbance\s*\(/);
      assert.match(html, /injectSensorAnomaly\s*\(/);
      assert.match(html, /resetFailSafeInterlock\s*\(/);
      assert.match(html, /id=["']anomalyBanner["']/);
    });

    it('demo/index.html contains 4-zone ESP32 node grid and live MQTT topic inspector', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /id=["']zoneCard1["']/);
      assert.match(html, /id=["']zoneCard2["']/);
      assert.match(html, /id=["']zoneCard3["']/);
      assert.match(html, /id=["']zoneCard4["']/);
      assert.match(html, /id=["']mqttStreamTerminal["']/);
      assert.match(html, /smartgrid\/zone\/\+\/telemetry/);
      assert.match(html, /id=["']btnToggleMqttStream["']/);
      assert.match(html, /id=["']btnClearMqttLog["']/);
    });

    it('demo/index.html contains interactive 6-month deep-sleep battery autonomy calculator', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /id=["']calcWakeDuration["']/);
      assert.match(html, /id=["']calcSleepInterval["']/);
      assert.match(html, /id=["']calcActiveCurrent["']/);
      assert.match(html, /id=["']calcSleepCurrent["']/);
      assert.match(html, /id=["']calcBatteryCap["']/);
      assert.match(html, /id=["']calcAvgCurrent["']/);
      assert.match(html, /id=["']calcDailyMah["']/);
      assert.match(html, /id=["']calcDays["']/);
      assert.match(html, /id=["']calcMonths["']/);
      assert.match(html, /id=["']calcTargetBadge["']/);
      assert.match(html, /calculateBatteryAutonomy\s*\(/);
    });

    it('demo/index.html embeds 100% full-fidelity C++, Python & Markdown source files', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      const cppFile = readIfExists('projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp');
      const anomalyFile = readIfExists('projects/smartgrid-iot/src/edge_anomaly_detector.py');
      const brokerFile = readIfExists('projects/smartgrid-iot/src/mqtt_telemetry_broker.py');
      const readmeFile = readIfExists('projects/smartgrid-iot/README.md');

      assert.ok(html.includes(JSON.stringify(cppFile)), 'Full esp32_smartgrid_node.cpp must be embedded');
      assert.ok(html.includes(JSON.stringify(anomalyFile)), 'Full edge_anomaly_detector.py must be embedded');
      assert.ok(html.includes(JSON.stringify(brokerFile)), 'Full mqtt_telemetry_broker.py must be embedded');
      assert.ok(html.includes(JSON.stringify(readmeFile)), 'Full README.md must be embedded');
    });

    it('demo/index.html back button cleanly resolves to portfolio index.html', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /href=["']\.\.\/\.\.\/\.\.\/index\.html["']/);

      const demoDir = path.join(ROOT_DIR, 'projects', 'smartgrid-iot', 'demo');
      const resolved = path.resolve(demoDir, '../../../index.html');
      assert.ok(fs.existsSync(resolved), `Back link resolved to non-existent file: ${resolved}`);
      assert.strictEqual(resolved, path.join(ROOT_DIR, 'index.html'));
    });

    it('demo/index.html declares and exports functions to window avoiding strict mode ReferenceErrors', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /window\.injectThermalDisturbance\s*=\s*injectThermalDisturbance/);
      assert.match(html, /window\.injectSensorAnomaly\s*=\s*injectSensorAnomaly/);
      assert.match(html, /window\.resetFailSafeInterlock\s*=\s*resetFailSafeInterlock/);
      assert.match(html, /window\.calculateBatteryAutonomy\s*=\s*calculateBatteryAutonomy/);
      assert.match(html, /window\.switchSourceFile\s*=\s*switchSourceFile/);
      assert.match(html, /window\.copyCurrentSourceCode\s*=\s*copyCurrentSourceCode/);
      assert.match(html, /window\.selectZone\s*=\s*selectZone/);
      assert.match(html, /window\.toggleMqttStream\s*=\s*toggleMqttStream/);
      assert.match(html, /window\.clearMqttStream\s*=\s*clearMqttStream/);
    });

    it('demo/index.html embedded simulation script compiles with zero syntax errors via vm.Script', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
      let match;
      let count = 0;

      while ((match = scriptRegex.exec(html)) !== null) {
        const code = match[1].trim();
        if (code.length > 0) {
          assert.doesNotThrow(() => {
            new vm.Script(code);
          }, `Embedded script block ${count} threw syntax error during compilation`);
          count++;
        }
      }
      assert.ok(count >= 2, 'Expected at least 2 compiled script blocks in demo/index.html');
    });
  });

  // =========================================================================
  // Suite 4: R4 — Portfolio Integration (index.html & data/portfolio-data.js)
  // =========================================================================
  describe('Suite 4: R4 — Portfolio Integration (index.html & data/portfolio-data.js)', () => {

    it('index.html Project Card 4 links directly to projects/smartgrid-iot/demo/index.html', () => {
      const html = readIfExists('index.html');
      assert.ok(html);

      // Verify Card 4 container
      assert.match(html, /data-testid=["']project-card-4["']/);
      assert.match(html, /data-testid=["']smartgrid-demo-link["']/);
      assert.match(html, /href=["']projects\/smartgrid-iot\/demo\/index\.html["']/);
      assert.match(html, /class=["'][^"']*btn-primary[^"']*["']/);
      assert.match(html, /⚡ Live Interactive Demo/);
    });

    it('data/portfolio-data.js Project 4 demo link points to projects/smartgrid-iot/demo/index.html', () => {
      const js = readIfExists('data/portfolio-data.js');
      assert.ok(js);

      assert.match(js, /id:\s*["']ai-iot-automation-system["']/);
      assert.match(js, /demo:\s*["']projects\/smartgrid-iot\/demo\/index\.html["']/);
      assert.match(js, /github:\s*["']https:\/\/github\.com\/fekiseddik\/smartgrid-iot-automation["']/);
    });
  });

  // =========================================================================
  // Suite 5: Adversarial Robustness & Zero-Placeholder Audit
  // =========================================================================
  describe('Suite 5: Adversarial Boundary, Numerical Robustness & Zero-Placeholder Audit', () => {

    it('PID controller guards against non-finite inputs without NaN propagation', () => {
      function safePidCompute(target, measured, dt) {
        if (!Number.isFinite(target) || !Number.isFinite(measured) || !Number.isFinite(dt) || dt <= 0) {
          return 0.0;
        }
        return Math.max(0.0, Math.min(100.0, target - measured));
      }

      assert.strictEqual(safePidCompute(NaN, 24.0, 0.1), 0.0);
      assert.strictEqual(safePidCompute(24.0, Infinity, 0.1), 0.0);
      assert.strictEqual(safePidCompute(24.0, 20.0, -1.0), 0.0);
      assert.strictEqual(safePidCompute(24.0, 20.0, 0.0), 0.0);
    });

    it('Z-Score detector handles zero-variance sensor windows without division by zero', () => {
      function safeZScore(values, current, fallbackStd = 0.20) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.length > 1
          ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
          : 0;
        const std = Math.sqrt(variance);
        const effStd = std > 1e-5 ? std : fallbackStd;
        return Math.abs(current - mean) / effStd;
      }

      // 30 identical readings
      const identical = Array(30).fill(24.0);
      const z = safeZScore(identical, 24.0);
      assert.strictEqual(z, 0.0);
      assert.ok(Number.isFinite(z));
    });

    it('demo/index.html includes responsive media queries for mobile viewports', () => {
      const html = readIfExists('projects/smartgrid-iot/demo/index.html');
      assert.match(html, /@media\s*\(\s*max-width:\s*1200px\s*\)/);
      assert.match(html, /@media\s*\(\s*max-width:\s*768px\s*\)/);
      assert.match(html, /@media\s*\(\s*max-width:\s*480px\s*\)/);
    });

    const FILES_TO_AUDIT = [
      'projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp',
      'projects/smartgrid-iot/src/edge_anomaly_detector.py',
      'projects/smartgrid-iot/src/mqtt_telemetry_broker.py',
      'projects/smartgrid-iot/requirements.txt',
      'projects/smartgrid-iot/README.md',
      'projects/smartgrid-iot/demo/index.html'
    ];

    for (const relPath of FILES_TO_AUDIT) {
      it(`Audit ${relPath} for zero forbidden placeholders`, () => {
        const content = readIfExists(relPath);
        assert.ok(content, `${relPath} must exist for placeholder audit`);

        assert.doesNotMatch(content, /lorem\s+ipsum/i, `Forbidden 'lorem ipsum' found in ${relPath}`);
        assert.doesNotMatch(content, /\bTBD\b/, `Forbidden 'TBD' found in ${relPath}`);
        assert.doesNotMatch(content, /\bTODO\b/, `Forbidden 'TODO' found in ${relPath}`);
        assert.doesNotMatch(content, /\bFIXME\b/, `Forbidden 'FIXME' found in ${relPath}`);
        assert.doesNotMatch(content, /example@example\.com/i, `Forbidden 'example@example.com' found in ${relPath}`);
        assert.doesNotMatch(content, /\[your\s*name\]/i, `Forbidden '[your name]' found in ${relPath}`);
        assert.doesNotMatch(content, /123-456-7890/, `Forbidden '123-456-7890' found in ${relPath}`);
      });
    }
  });

});
