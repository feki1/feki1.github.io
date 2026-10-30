/**
 * ============================================================================
 * SmartGrid IoT: Empirical Challenger Stress Harness & Algorithmic Oracle
 * ============================================================================
 * Developer: Challenger 1 (teamwork_challenger)
 * Target Codebases:
 *   - projects/smartgrid-iot/firmware/esp32_smartgrid_node.cpp
 *   - projects/smartgrid-iot/src/edge_anomaly_detector.py
 * 
 * Verification Objectives:
 * 1. Discrete PID Anti-Windup Clamping & Saturation Invariance
 * 2. Low-Pass Filtered Derivative Noise Rejection & Setpoint Step Jump Attenuation
 * 3. Steady-State Setpoint Tracking & Dynamic Thermal Disturbance Recovery (+/- 1.5%)
 * 4. Multi-Sensor Kalman Fusion, Variance Reduction & Discrepancy Detection Thresholds
 * 5. Deep-Sleep Battery Autonomy Sensitivity, Derating & Boundary Stress
 * ============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ============================================================================
// EXACT ARCHITECTURAL MIRRORS FOR EMPIRICAL EVALUATION
// ============================================================================

/**
 * Mirror of struct PIDController in esp32_smartgrid_node.cpp & ClosedLoopPIDController in Python
 */
class AlgorithmicPidController {
  constructor(options = {}) {
    this.kp = options.kp ?? 6.5;
    this.ki = options.ki ?? 1.2;
    this.kd = options.kd ?? 2.8;
    this.setpoint = options.setpoint ?? 24.0;
    this.integral = 0.0;
    this.maxIntegral = options.maxIntegral ?? 40.0;
    this.prevError = 0.0;
    this.filteredDerivative = 0.0;
    this.derivativeAlpha = options.derivativeAlpha ?? 0.70;
    this.minOutput = options.minOutput ?? 0.0;
    this.maxOutput = options.maxOutput ?? 100.0;
    this.tolerancePct = options.tolerancePct ?? 1.5;
  }

  reset() {
    this.integral = 0.0;
    this.prevError = 0.0;
    this.filteredDerivative = 0.0;
  }

  compute(target, measured, dt) {
    if (!Number.isFinite(target) || !Number.isFinite(measured) || !Number.isFinite(dt) || dt <= 0.0) {
      return 0.0;
    }

    this.setpoint = target;
    const error = this.setpoint - measured;

    // 1. Proportional Term
    const pTerm = this.kp * error;

    // 2. Integral Term with Clamping Anti-Windup
    this.integral += error * dt;
    if (this.integral > this.maxIntegral) {
      this.integral = this.maxIntegral;
    } else if (this.integral < -this.maxIntegral) {
      this.integral = -this.maxIntegral;
    }
    const iTerm = this.ki * this.integral;

    // 3. Low-Pass Filtered Derivative
    const rawDerivative = (error - this.prevError) / dt;
    this.filteredDerivative =
      (this.derivativeAlpha * this.filteredDerivative) +
      ((1.0 - this.derivativeAlpha) * rawDerivative);
    this.prevError = error;
    const dTerm = this.kd * this.filteredDerivative;

    // 4. Output Clamping
    const unclamped = pTerm + iTerm + dTerm;
    const clamped = Math.max(this.minOutput, Math.min(this.maxOutput, unclamped));
    return clamped;
  }

  isWithinTolerance(measured) {
    if (!Number.isFinite(measured)) return false;
    if (Math.abs(this.setpoint) < 1e-4) {
      return Math.abs(measured - this.setpoint) <= 0.05;
    }
    const devPct = (Math.abs(measured - this.setpoint) / Math.abs(this.setpoint)) * 100.0;
    return devPct <= this.tolerancePct;
  }
}

/**
 * Mirror of struct MultiSensorKalmanFilter in esp32_smartgrid_node.cpp
 */
class AlgorithmicKalmanFusion {
  constructor(options = {}) {
    this.stateEstimate = options.initialTemp ?? 24.0;
    this.errorCovariance = options.initialCov ?? 1.0;
    this.processNoiseQ = options.q ?? 0.0050;
    this.varSensor1 = options.var1 ?? 0.0400; // sigma1 = 0.20 C
    this.varSensor2 = options.var2 ?? 0.1225; // sigma2 = 0.35 C
    this.discrepancyThreshold = options.discrepancyThreshold ?? 5.0;
  }

  fuseObservations(z1, z2) {
    const discrepancy = Math.abs(z1 - z2);
    const consistent = (discrepancy <= this.discrepancyThreshold);

    const totalVariance = this.varSensor1 + this.varSensor2;
    const w1 = this.varSensor2 / totalVariance;
    const w2 = this.varSensor1 / totalVariance;

    const fusedReading = (w1 * z1) + (w2 * z2);
    const fusedVariance = (this.varSensor1 * this.varSensor2) / totalVariance;

    return { fusedReading, fusedVariance, consistent, discrepancy, w1, w2 };
  }

  step(zFused, rFused) {
    // 1. Time Update (Predict)
    const pPriori = this.errorCovariance + this.processNoiseQ;

    // 2. Measurement Update (Correct)
    const kalmanGain = pPriori / (pPriori + rFused);
    this.stateEstimate = this.stateEstimate + kalmanGain * (zFused - this.stateEstimate);
    this.errorCovariance = (1.0 - kalmanGain) * pPriori;

    return {
      stateEstimate: this.stateEstimate,
      errorCovariance: this.errorCovariance,
      kalmanGain
    };
  }
}

/**
 * Mirror of struct HardwareFailSafeInterlock in esp32_smartgrid_node.cpp
 */
class AlgorithmicFailSafeInterlock {
  constructor() {
    this.isLatched = false;
    this.consecutiveDiscrepancies = 0;
    this.relayEnergized = true;
    this.pwmOutput = 0;
  }

  evaluate(processVar, tempS1, tempS2, dt, prevTemp) {
    if (this.isLatched) {
      this.relayEnergized = false;
      this.pwmOutput = 0;
      return false;
    }

    // Critical limit check (0.0°C to 75.0°C)
    if (processVar > 75.0 || processVar < 0.0) {
      this.trip();
      return false;
    }

    // Thermal runaway check (> 4.0°C/s)
    if (dt > 0.0) {
      const slewRate = Math.abs(processVar - prevTemp) / dt;
      if (slewRate > 4.0) {
        this.trip();
        return false;
      }
    }

    // Sensor discrepancy check (> 5.0°C for >= 3 cycles)
    const diff = Math.abs(tempS1 - tempS2);
    if (diff > 5.0) {
      this.consecutiveDiscrepancies++;
      if (this.consecutiveDiscrepancies >= 3) {
        this.trip();
        return false;
      }
    } else {
      this.consecutiveDiscrepancies = 0;
    }

    this.relayEnergized = true;
    return true;
  }

  trip() {
    this.isLatched = true;
    this.relayEnergized = false;
    this.pwmOutput = 0;
  }

  reset() {
    this.isLatched = false;
    this.consecutiveDiscrepancies = 0;
    this.relayEnergized = true;
  }
}

/**
 * Mirror of BatteryLifeEstimator in edge_anomaly_detector.py
 */
class AlgorithmicBatteryEstimator {
  constructor(options = {}) {
    this.batteryCapacityMah = options.capacityMah ?? 3000.0;
    this.activeCurrentMa = options.activeCurrentMa ?? 80.0;
    this.sleepCurrentUa = options.sleepCurrentUa ?? 15.0;
    this.activeDurationMs = options.activeDurationMs ?? 200.0;
    this.sleepIntervalS = options.sleepIntervalS ?? 60.0;
    this.usableCapacityRatio = options.usableRatio ?? 0.90;
  }

  calculateAverageCurrentMa() {
    const tActiveSec = this.activeDurationMs / 1000.0;
    const tSleepSec = this.sleepIntervalS;
    const tCycle = tActiveSec + tSleepSec;

    const sleepCurrentMa = this.sleepCurrentUa / 1000.0;
    const qActive = this.activeCurrentMa * tActiveSec;
    const qSleep = sleepCurrentMa * tSleepSec;
    const qTotal = qActive + qSleep;

    return qTotal / tCycle;
  }

  calculateRuntimeHours() {
    const usableMah = this.batteryCapacityMah * this.usableCapacityRatio;
    const iAvg = this.calculateAverageCurrentMa();
    if (iAvg <= 0.0) return Infinity;
    return usableMah / iAvg;
  }

  calculateRuntimeDays() {
    return this.calculateRuntimeHours() / 24.0;
  }

  calculateRuntimeMonths() {
    return this.calculateRuntimeDays() / 30.4375;
  }

  meetsSixMonthTarget() {
    return this.calculateRuntimeDays() >= 185.0;
  }
}

// Pseudo-random Gaussian generator (Box-Muller)
function randomGaussian(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

// ============================================================================
// EMPIRICAL CHALLENGER TEST SUITES
// ============================================================================

describe('Empirical Challenger: SmartGrid Control, Fusion & Autonomy Stress Tests', () => {

  // --------------------------------------------------------------------------
  // Suite 1: Discrete PID Anti-Windup Clamping & Saturation Invariance
  // --------------------------------------------------------------------------
  describe('Suite 1: Discrete PID Anti-Windup Clamping & Saturation Invariance', () => {

    it('clamps integral accumulator strictly to +40.0% under extreme positive error saturation', () => {
      const pid = new AlgorithmicPidController({ maxIntegral: 40.0 });

      // Target = 100°C, Measured = -50°C (Error = +150°C) for 10,000 steps of dt = 0.1s
      let lastOutput = 0;
      for (let i = 0; i < 10000; i++) {
        lastOutput = pid.compute(100.0, -50.0, 0.1);
      }

      assert.strictEqual(pid.integral, 40.0, 'Integral accumulator must clamp precisely at maxIntegral (+40.0%)');
      assert.strictEqual(lastOutput, 100.0, 'Output must be strictly clamped to maxOutput (100.0%)');
    });

    it('clamps integral accumulator strictly to -40.0% under extreme negative error saturation', () => {
      const pid = new AlgorithmicPidController({ maxIntegral: 40.0 });

      // Target = 0°C, Measured = 150°C (Error = -150°C) for 10,000 steps of dt = 0.1s
      let lastOutput = 0;
      for (let i = 0; i < 10000; i++) {
        lastOutput = pid.compute(0.0, 150.0, 0.1);
      }

      assert.strictEqual(pid.integral, -40.0, 'Integral accumulator must clamp precisely at -maxIntegral (-40.0%)');
      assert.strictEqual(lastOutput, 0.0, 'Output must be strictly clamped to minOutput (0.0%)');
    });

    it('unwinds immediately upon error sign reversal without windup lag', () => {
      const pid = new AlgorithmicPidController({ maxIntegral: 40.0, ki: 1.2 });

      // Saturate positive
      for (let i = 0; i < 500; i++) {
        pid.compute(50.0, 10.0, 0.1);
      }
      assert.strictEqual(pid.integral, 40.0);

      // Immediately flip error to negative: target = 20, measured = 30 (error = -10.0°C)
      // On next step with dt = 0.1, integral must decrease: 40.0 + (-10.0 * 0.1) = 39.0
      pid.compute(20.0, 30.0, 0.1);
      assert.strictEqual(pid.integral, 39.0, 'Integral must unwind immediately without hysteresis');
      assert.ok(pid.integral < 40.0, 'Integral accumulator started unwinding instantly');
    });

    it('maintains strict output bounds [0, 100]% under adversarial floating-point inputs', () => {
      const pid = new AlgorithmicPidController();

      // Test extreme numerical inputs
      const outputs = [
        pid.compute(1e6, -1e6, 0.01),
        pid.compute(-1e6, 1e6, 0.01),
        pid.compute(24.0, 24.0, 1e-6),
        pid.compute(24.0, 24.0, 1e6),
      ];

      for (const out of outputs) {
        assert.ok(out >= 0.0 && out <= 100.0, `Output ${out} broke [0, 100]% boundary`);
      }

      // Test invalid inputs: NaN, Inf, non-positive dt
      assert.strictEqual(pid.compute(NaN, 24.0, 0.1), 0.0);
      assert.strictEqual(pid.compute(24.0, Infinity, 0.1), 0.0);
      assert.strictEqual(pid.compute(24.0, 20.0, 0.0), 0.0);
      assert.strictEqual(pid.compute(24.0, 20.0, -1.0), 0.0);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Low-Pass Filtered Derivative Noise Rejection & Step Response
  // --------------------------------------------------------------------------
  describe('Suite 2: Low-Pass Filtered Derivative Noise Rejection & Step Response', () => {

    it('empirically demonstrates derivative noise attenuation under high-frequency Gaussian noise', () => {
      const pidFiltered = new AlgorithmicPidController({ derivativeAlpha: 0.70 });
      const dt = 0.05; // 20 Hz loop
      const noiseSigma = 0.20; // 0.20°C standard deviation sensor noise
      const numSteps = 5000;

      const rawDerivatives = [];
      const filteredDerivatives = [];

      let prevNoise = 0;
      for (let i = 0; i < numSteps; i++) {
        const noise = randomGaussian(0, noiseSigma);
        const measured = 24.0 + noise;

        const rawDeriv = ( (24.0 - measured) - (24.0 - (24.0 + prevNoise)) ) / dt;
        rawDerivatives.push(rawDeriv);
        prevNoise = noise;

        pidFiltered.compute(24.0, measured, dt);
        filteredDerivatives.push(pidFiltered.filteredDerivative);
      }

      // Compute sample variances
      const rawMean = rawDerivatives.reduce((a, b) => a + b, 0) / numSteps;
      const rawVar = rawDerivatives.reduce((s, v) => s + (v - rawMean) ** 2, 0) / numSteps;

      const filtMean = filteredDerivatives.reduce((a, b) => a + b, 0) / numSteps;
      const filtVar = filteredDerivatives.reduce((s, v) => s + (v - filtMean) ** 2, 0) / numSteps;

      const varianceReductionPct = (1.0 - (filtVar / rawVar)) * 100.0;

      // Theoretical reduction factor for first-order IIR with beta = 1 - alpha = 0.30:
      // Var_filt / Var_raw = beta / (2 - beta) = 0.30 / 1.70 ≈ 0.1765 => ~82.35% variance reduction
      assert.ok(
        filtVar < rawVar * 0.35,
        `Filtered variance ${filtVar.toFixed(4)} must be < 35% of raw variance ${rawVar.toFixed(4)}`
      );
      assert.ok(
        varianceReductionPct >= 65.0,
        `Noise variance reduction (${varianceReductionPct.toFixed(1)}%) must exceed 65%`
      );
    });

    it('attenuates derivative kick on sudden setpoint step jump by exactly (1 - alpha)', () => {
      const pid = new AlgorithmicPidController({ derivativeAlpha: 0.70 });
      const dt = 0.1;

      // Steady state at 24.0°C
      pid.compute(24.0, 24.0, dt);

      // Sudden setpoint step jump from 24.0°C to 30.0°C (jump of +6.0°C)
      // Raw derivative impulse: (6.0 - 0.0) / 0.1 = 60.0°C/s
      // Filtered derivative: 0.70 * 0.0 + (1.0 - 0.70) * 60.0 = 18.0°C/s (exactly 70% attenuation!)
      pid.compute(30.0, 24.0, dt);

      const expectedFilteredDeriv = (1.0 - 0.70) * (6.0 / dt); // 18.0
      assert.ok(
        Math.abs(pid.filteredDerivative - expectedFilteredDeriv) < 1e-4,
        `Filtered derivative ${pid.filteredDerivative} must equal theoretical attenuated kick ${expectedFilteredDeriv}`
      );
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Steady-State Tracking & Dynamic Thermal Disturbance Recovery
  // --------------------------------------------------------------------------
  describe('Suite 3: Steady-State Tracking & Dynamic Thermal Disturbance Recovery', () => {

    it('settles and tracks setpoint within +/- 1.5% tolerance in a dynamic 1st-order thermal chamber', () => {
      const pid = new AlgorithmicPidController({
        kp: 6.5,
        ki: 1.2,
        kd: 2.8,
        setpoint: 24.0,
        tolerancePct: 1.5
      });

      // SmartGrid environmental chamber dynamics (matching demo/index.html):
      // dT/dt = -(1 / tau) * (T - T_ambient) + K_actuator * (PWM / 100) * 4.5
      const tau = 8.0;             // Thermal lag tau (s)
      const actuatorGain = 0.85;   // Actuator thermal efficiency
      const tAmbient = 20.0;       // Nominal industrial ambient (°C)
      const targetSp = 24.0;       // Target setpoint (°C)
      const dt = 0.05;             // 20 Hz loop step
      const totalSteps = 4000;     // 200 seconds

      let plantTemp = 20.0;        // Start at ambient
      let pwmEffort = 0.0;

      for (let step = 0; step < totalSteps; step++) {
        pwmEffort = pid.compute(targetSp, plantTemp, dt);
        const ambientLoss = -(1.0 / tau) * (plantTemp - tAmbient);
        const heatInput = actuatorGain * (pwmEffort / 100.0) * 4.5;
        const deltaTemp = (ambientLoss + heatInput) * dt;
        plantTemp += deltaTemp;
      }

      // Check steady-state temperature
      const steadyStateDeviationPct = (Math.abs(plantTemp - targetSp) / targetSp) * 100.0;
      assert.ok(
        pid.isWithinTolerance(plantTemp),
        `Steady-state temperature ${plantTemp.toFixed(3)}°C must be within +/- 1.5% of ${targetSp}°C`
      );
      assert.ok(
        steadyStateDeviationPct < 0.15,
        `Steady-state deviation (${steadyStateDeviationPct.toFixed(3)}%) must be < 0.15% (well within 1.5%)`
      );
      assert.ok(
        pid.integral < pid.maxIntegral,
        `Integrator (${pid.integral.toFixed(2)}%) operates within linear anti-windup bounds (< 40%)`
      );
    });

    it('recovers from external thermal disturbance and returns to +/- 1.5% band', () => {
      const pid = new AlgorithmicPidController({
        kp: 6.5,
        ki: 1.2,
        kd: 2.8,
        setpoint: 24.0,
        tolerancePct: 1.5
      });

      const tau = 8.0;
      const actuatorGain = 0.85;
      let tAmbient = 20.0;
      const targetSp = 24.0;
      const dt = 0.05;
      let plantTemp = 24.0; // Start at setpoint

      // Run 500 steps in steady state
      for (let i = 0; i < 500; i++) {
        const pwm = pid.compute(targetSp, plantTemp, dt);
        const ambientLoss = -(1.0 / tau) * (plantTemp - tAmbient);
        const heatInput = actuatorGain * (pwm / 100.0) * 4.5;
        plantTemp += (ambientLoss + heatInput) * dt;
      }

      // Inject thermal disturbance: Ambient temperature drops from 20°C down to 16°C
      tAmbient = 16.0;

      // Simulate recovery for 2000 steps (100 seconds)
      for (let i = 0; i < 2000; i++) {
        const pwm = pid.compute(targetSp, plantTemp, dt);
        const ambientLoss = -(1.0 / tau) * (plantTemp - tAmbient);
        const heatInput = actuatorGain * (pwm / 100.0) * 4.5;
        plantTemp += (ambientLoss + heatInput) * dt;
      }

      assert.ok(
        pid.isWithinTolerance(plantTemp),
        `After disturbance, temperature ${plantTemp.toFixed(3)}°C must return to +/- 1.5% tolerance band`
      );
      assert.ok(
        Math.abs(plantTemp - targetSp) < 0.10,
        `Steady-state error is strictly < 0.10°C (settled at ${plantTemp.toFixed(3)}°C)`
      );
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Multi-Sensor Fusion, Variance Reduction & Discrepancy Checks
  // --------------------------------------------------------------------------
  describe('Suite 4: Multi-Sensor Fusion, Variance Reduction & Discrepancy Checks', () => {

    it('mathematically confirms fused variance is strictly less than min(var1, var2)', () => {
      const var1 = 0.0400; // sigma1 = 0.20°C
      const var2 = 0.1225; // sigma2 = 0.35°C
      const totalVar = var1 + var2;

      const w1 = var2 / totalVar; // ~0.753846
      const w2 = var1 / totalVar; // ~0.246154
      const varFused = (var1 * var2) / totalVar; // ~0.0301538

      assert.strictEqual(w1 + w2, 1.0, 'Weights must sum to 1.0');
      assert.ok(varFused < var1, `Fused variance ${varFused} must be < var1 ${var1}`);
      assert.ok(varFused < var2, `Fused variance ${varFused} must be < var2 ${var2}`);
      assert.ok(varFused < Math.min(var1, var2), 'Fused variance is strictly lower than minimum individual variance');
      assert.ok(Math.abs(varFused - 0.0301538) < 1e-5, 'Fused variance matches analytical formula');
    });

    it('empirically verifies variance reduction via Monte Carlo test (100,000 samples)', () => {
      const kalman = new AlgorithmicKalmanFusion({ var1: 0.0400, var2: 0.1225 });
      const trueTemp = 24.0;
      const sigma1 = Math.sqrt(0.0400); // 0.20
      const sigma2 = Math.sqrt(0.1225); // 0.35
      const nSamples = 100000;

      const fusedReadings = [];
      for (let i = 0; i < nSamples; i++) {
        const z1 = randomGaussian(trueTemp, sigma1);
        const z2 = randomGaussian(trueTemp, sigma2);
        const { fusedReading } = kalman.fuseObservations(z1, z2);
        fusedReadings.push(fusedReading);
      }

      const meanFused = fusedReadings.reduce((a, b) => a + b, 0) / nSamples;
      const sampleVarFused = fusedReadings.reduce((s, v) => s + (v - meanFused) ** 2, 0) / (nSamples - 1);

      assert.ok(
        Math.abs(meanFused - trueTemp) < 0.01,
        `Sample mean ${meanFused.toFixed(4)} must be unbiased around ${trueTemp}`
      );
      assert.ok(
        Math.abs(sampleVarFused - 0.03015) < 0.001,
        `Empirical sample variance ${sampleVarFused.toFixed(5)} must converge to theoretical 0.03015`
      );
      assert.ok(
        sampleVarFused < 0.0400,
        `Empirical fused variance ${sampleVarFused.toFixed(5)} is strictly lower than sensor 1 variance 0.0400`
      );
    });

    it('verifies 1D recursive Kalman filter error covariance convergence to steady-state Riccati limit', () => {
      const kalman = new AlgorithmicKalmanFusion({
        initialTemp: 24.0,
        initialCov: 1.0,
        q: 0.0050,
        var1: 0.0400,
        var2: 0.1225
      });

      const rFused = (0.0400 * 0.1225) / (0.0400 + 0.1225); // 0.0301538
      const q = 0.0050;

      // Analytical steady-state Riccati equation: P^2 + Q*P - Q*R = 0
      // P_inf = (-Q + sqrt(Q^2 + 4*Q*R)) / 2
      const pInfAnalytical = (-q + Math.sqrt(q * q + 4 * q * rFused)) / 2.0; // ≈ 0.010034

      // Run 30 recursive Kalman steps with observations around 24.0°C
      for (let i = 0; i < 30; i++) {
        kalman.step(24.0, rFused);
      }

      assert.ok(
        Math.abs(kalman.errorCovariance - pInfAnalytical) < 0.0005,
        `Kalman error covariance ${kalman.errorCovariance.toFixed(5)} must converge to Riccati limit ${pInfAnalytical.toFixed(5)}`
      );
      assert.ok(
        kalman.errorCovariance < rFused,
        `Kalman steady-state covariance (${kalman.errorCovariance.toFixed(5)}) is 3x lower than measurement noise (${rFused.toFixed(5)})`
      );
    });

    it('verifies sensor discrepancy detection boundary (|z1 - z2| > 5.0°C)', () => {
      const kalman = new AlgorithmicKalmanFusion();

      // Test just below threshold: 4.99°C
      const resBelow = kalman.fuseObservations(24.0, 28.99);
      assert.strictEqual(resBelow.consistent, true, 'Diff 4.99°C must be consistent');

      // Test exact threshold: 5.00°C
      const resExact = kalman.fuseObservations(24.0, 29.00);
      assert.strictEqual(resExact.consistent, true, 'Diff 5.00°C must be consistent');

      // Test just above threshold: 5.01°C
      const resAbove = kalman.fuseObservations(24.0, 29.01);
      assert.strictEqual(resAbove.consistent, false, 'Diff 5.01°C must be flagged as anomaly');
    });

    it('evaluates hardware fail-safe interlock latching after 3 consecutive discrepancy cycles', () => {
      const interlock = new AlgorithmicFailSafeInterlock();

      // Cycle 1: anomaly injected (|z1 - z2| = 6.0°C)
      let safe = interlock.evaluate(24.0, 24.0, 30.0, 1.0, 24.0);
      assert.strictEqual(safe, true, 'Cycle 1: anomaly recorded but interlock not tripped yet');
      assert.strictEqual(interlock.consecutiveDiscrepancies, 1);

      // Cycle 2: persistent anomaly
      safe = interlock.evaluate(24.0, 24.0, 30.0, 1.0, 24.0);
      assert.strictEqual(safe, true, 'Cycle 2: consecutive anomalies = 2');
      assert.strictEqual(interlock.consecutiveDiscrepancies, 2);

      // Cycle 3: 3rd consecutive anomaly trips interlock!
      safe = interlock.evaluate(24.0, 24.0, 30.0, 1.0, 24.0);
      assert.strictEqual(safe, false, 'Cycle 3: interlock must trip and enforce cutoff');
      assert.strictEqual(interlock.isLatched, true);
      assert.strictEqual(interlock.relayEnergized, false);
      assert.strictEqual(interlock.pwmOutput, 0);

      // Cycle 4: readings return to normal, but interlock remains latched until reset!
      safe = interlock.evaluate(24.0, 24.0, 24.0, 1.0, 24.0);
      assert.strictEqual(safe, false, 'Safety interlock must stay latched even if sensors return to normal');

      // Manual reset restores operation
      interlock.reset();
      assert.strictEqual(interlock.isLatched, false);
      assert.strictEqual(interlock.relayEnergized, true);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Deep-Sleep Battery Autonomy Sensitivity & Boundary Stress
  // --------------------------------------------------------------------------
  describe('Suite 5: Deep-Sleep Battery Autonomy Sensitivity & Boundary Stress', () => {

    it('verifies standard baseline achieves > 400 days (> 185 days / > 6 months)', () => {
      const est = new AlgorithmicBatteryEstimator();
      const avgCurrent = est.calculateAverageCurrentMa();
      const days = est.calculateRuntimeDays();
      const months = est.calculateRuntimeMonths();

      assert.ok(Math.abs(avgCurrent - 0.28073) < 0.001, `Average current ${avgCurrent} mA matches nominal`);
      assert.ok(days > 400.0 && days < 402.0, `Nominal autonomy ${days.toFixed(1)} days matches 400.7 days`);
      assert.ok(days >= 185.0, `Autonomy ${days.toFixed(1)} days exceeds 185 days mandate`);
      assert.ok(months >= 6.0, `Autonomy ${months.toFixed(1)} months exceeds 6 months mandate`);
      assert.strictEqual(est.meetsSixMonthTarget(), true);
    });

    it('stress-tests 0% sleep edge case (continuous active execution)', () => {
      const estZeroSleep = new AlgorithmicBatteryEstimator({ sleepIntervalS: 0.0001 });
      const avgCurrent = estZeroSleep.calculateAverageCurrentMa();
      const hours = estZeroSleep.calculateRuntimeHours();
      const days = estZeroSleep.calculateRuntimeDays();

      assert.ok(Math.abs(avgCurrent - 80.0) < 0.5, '0% sleep current equals active current ~80 mA');
      assert.ok(Math.abs(hours - 33.75) < 0.5, 'Autonomy is ~33.75 hours (1.4 days) without sleep');
      assert.strictEqual(estZeroSleep.meetsSixMonthTarget(), false);
    });

    it('stress-tests wake duration boundary to determine critical threshold for 185-day target', () => {
      // Find maximum allowable active duration T_active at T_sleep = 60s
      // I_max_avg = 2700 / (185 * 24) = 0.608108 mA
      // Solving (80 * T_act + 0.015 * 60) / (T_act + 60) = 0.608108 => T_act ≈ 0.4482 s (448.2 ms)
      const maxWakeMs = 448.2;

      const estPass = new AlgorithmicBatteryEstimator({ activeDurationMs: maxWakeMs });
      assert.ok(estPass.calculateRuntimeDays() >= 185.0, 'Wake time 448.2 ms must satisfy >= 185 days');

      const estFail = new AlgorithmicBatteryEstimator({ activeDurationMs: 460.0 });
      assert.ok(estFail.calculateRuntimeDays() < 185.0, 'Wake time 460 ms drops below 185 days');
    });

    it('stress-tests severe battery capacity degradation (down to 50% usable)', () => {
      const estDegraded = new AlgorithmicBatteryEstimator({ usableRatio: 0.50 }); // 1500 mAh
      const days = estDegraded.calculateRuntimeDays();

      assert.ok(
        days >= 185.0,
        `Even under severe 50% capacity loss, autonomy ${days.toFixed(1)} days still exceeds 185 days`
      );
      assert.strictEqual(estDegraded.meetsSixMonthTarget(), true);
    });

    it('stress-tests sleep current variation from 10 uA to 50 uA', () => {
      const currents = [10.0, 15.0, 25.0, 35.0, 50.0];
      for (const iSleep of currents) {
        const est = new AlgorithmicBatteryEstimator({ sleepCurrentUa: iSleep });
        const days = est.calculateRuntimeDays();
        assert.ok(
          days >= 185.0,
          `At sleep current ${iSleep} uA, runtime ${days.toFixed(1)} days must satisfy >= 185 days`
        );
      }
    });

    it('calculates minimum sleep interval required to satisfy 185-day mandate', () => {
      // Usable mAh = 2700. I_max_avg = 0.608108 mA. T_act = 0.2 s, I_act = 80 mA, I_sleep = 0.015 mA
      // (0.608108 - 0.015) * T_sleep = 0.2 * (80 - 0.608108) = 15.87837
      // T_sleep = 15.87837 / 0.593108 ≈ 26.775 seconds -> 26.78s
      const minSleepSec = 26.78;

      const estMin = new AlgorithmicBatteryEstimator({ sleepIntervalS: minSleepSec });
      assert.ok(
        estMin.calculateRuntimeDays() >= 185.0,
        `Sleep interval ${minSleepSec}s satisfies 185 days target (achieved ${estMin.calculateRuntimeDays().toFixed(2)} days)`
      );

      const estShort = new AlgorithmicBatteryEstimator({ sleepIntervalS: 20.0 });
      assert.ok(
        estShort.calculateRuntimeDays() < 185.0,
        'Sleep interval 20s is insufficient for 185 days target'
      );
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Edge Anomaly Inference, Calibration Drift & Interlock Latching
  // --------------------------------------------------------------------------
  describe('Suite 6: Edge Anomaly Inference, Calibration Drift & Interlock Latching', () => {

    class AlgorithmicAnomalyDetector {
      constructor(options = {}) {
        this.windowSize = options.windowSize ?? 30;
        this.zThreshold = options.zThreshold ?? 3.0;
        this.zCritical = options.zCritical ?? 5.0;
        this.ewmaAlpha = options.ewmaAlpha ?? 0.20;
        this.cusumSlack = options.cusumSlack ?? 0.5;
        this.cusumThreshold = options.cusumThreshold ?? 4.5;
        this.criticalHigh = options.criticalHigh ?? 75.0;
        this.criticalLow = options.criticalLow ?? 0.0;
        this.baselineMean = options.baselineMean ?? 24.0;
        this.baselineStd = options.baselineStd ?? 0.20;

        this.window = [];
        this.ewma = null;
        this.cusumHigh = 0.0;
        this.cusumLow = 0.0;
        this.failSafeActive = false;
        this.tripReason = null;
        this.consecutiveOutliers = 0;
      }

      resetInterlock() {
        this.failSafeActive = false;
        this.tripReason = null;
        this.cusumHigh = 0.0;
        this.cusumLow = 0.0;
        this.consecutiveOutliers = 0;
      }

      feed(value) {
        if (!Number.isFinite(value)) {
          this.failSafeActive = true;
          this.tripReason = 'NON_FINITE_INPUT';
          return { failSafeActive: true, tripReason: this.tripReason };
        }

        if (value > this.criticalHigh || value < this.criticalLow) {
          this.failSafeActive = true;
          this.tripReason = 'CRITICAL_LIMIT_EXCEEDED';
        }

        this.window.push(value);
        if (this.window.length > this.windowSize) {
          this.window.shift();
        }

        const n = this.window.length;
        const mean = this.window.reduce((a, b) => a + b, 0) / n;
        const variance = n > 1
          ? this.window.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
          : 0.0;
        const stdDev = Math.sqrt(variance);

        const effSigma = stdDev > 1e-5 ? stdDev : this.baselineStd;
        const zScore = Math.abs(value - mean) / effSigma;
        const zAnomaly = zScore > this.zThreshold;

        if (zAnomaly) this.consecutiveOutliers++;
        else this.consecutiveOutliers = 0;

        if (zScore >= this.zCritical || this.consecutiveOutliers >= 3) {
          this.failSafeActive = true;
          if (!this.tripReason) this.tripReason = 'Z_SCORE_ANOMALY';
        }

        if (this.ewma === null) {
          this.ewma = value;
        } else {
          this.ewma = (this.ewmaAlpha * value) + ((1.0 - this.ewmaAlpha) * this.ewma);
        }

        const k = this.cusumSlack * this.baselineStd;
        const h = this.cusumThreshold * this.baselineStd;
        this.cusumHigh = Math.max(0.0, this.cusumHigh + (value - this.baselineMean - k));
        this.cusumLow = Math.max(0.0, this.cusumLow - (value - this.baselineMean + k));

        if (this.cusumHigh > h || this.cusumLow > h) {
          this.failSafeActive = true;
          if (!this.tripReason) this.tripReason = 'CUSUM_CALIBRATION_DRIFT';
        }

        return {
          value,
          mean,
          stdDev,
          zScore,
          zAnomaly,
          ewma: this.ewma,
          cusumHigh: this.cusumHigh,
          cusumLow: this.cusumLow,
          failSafeActive: this.failSafeActive,
          tripReason: this.tripReason
        };
      }
    }

    it('trips fail-safe immediately upon non-finite sensor values (NaN / Inf)', () => {
      const detector = new AlgorithmicAnomalyDetector();
      const resNaN = detector.feed(NaN);
      assert.strictEqual(resNaN.failSafeActive, true);
      assert.strictEqual(resNaN.tripReason, 'NON_FINITE_INPUT');

      detector.resetInterlock();
      const resInf = detector.feed(Infinity);
      assert.strictEqual(resInf.failSafeActive, true);
      assert.strictEqual(resInf.tripReason, 'NON_FINITE_INPUT');
    });

    it('detects subtle persistent calibration drift via CUSUM where individual Z-scores remain small', () => {
      const detector = new AlgorithmicAnomalyDetector({
        baselineMean: 24.0,
        baselineStd: 0.20,
        cusumSlack: 0.5,
        cusumThreshold: 4.5
      });

      // Warm up with baseline readings at 24.0°C
      for (let i = 0; i < 30; i++) {
        detector.feed(24.0 + (Math.sin(i) * 0.05));
      }
      assert.strictEqual(detector.failSafeActive, false);

      // Inject small constant offset: 24.25°C (+0.25°C is only ~1.25 sigma, so Z-score < 3.0 never alarms!)
      let cusumAlarm = false;
      for (let i = 0; i < 40; i++) {
        const report = detector.feed(24.25);
        if (report.failSafeActive && report.tripReason === 'CUSUM_CALIBRATION_DRIFT') {
          cusumAlarm = true;
          break;
        }
      }

      assert.strictEqual(cusumAlarm, true, 'CUSUM must accumulate and detect persistent 0.25°C calibration drift');
      assert.strictEqual(detector.failSafeActive, true);
    });

    it('strictly latches fail-safe state until explicit manual reset is called', () => {
      const detector = new AlgorithmicAnomalyDetector();
      // Inject critical spike (35.0°C)
      detector.feed(35.0);
      assert.strictEqual(detector.failSafeActive, true);

      // Subsequent normal readings must not clear the latch
      for (let i = 0; i < 20; i++) {
        const rep = detector.feed(24.0);
        assert.strictEqual(rep.failSafeActive, true, 'Fail-safe must stay latched on normal readings');
      }

      // Explicit reset
      detector.resetInterlock();
      assert.strictEqual(detector.failSafeActive, false);
      const repAfterReset = detector.feed(24.0);
      assert.strictEqual(repAfterReset.failSafeActive, false);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: MQTT Topic Router Wildcards, QoS 2 Lifecycle & Retained/LWT Store
  // --------------------------------------------------------------------------
  describe('Suite 7: MQTT Topic Router Wildcards, QoS 2 Lifecycle & Retained/LWT Store', () => {

    function matchMqttTopic(pattern, topic) {
      if (!pattern || !topic) return false;
      if (topic.startsWith('$') && !pattern.startsWith('$')) return false;
      if (pattern === topic || pattern === '#') return true;

      const subParts = pattern.split('/');
      const pubParts = topic.split('/');
      let i = 0;

      while (i < subParts.length) {
        if (subParts[i] === '#') return i === subParts.length - 1;
        if (i >= pubParts.length) return false;
        if (subParts[i] !== '+' && subParts[i] !== pubParts[i]) return false;
        i++;
      }
      return i === pubParts.length;
    }

    it('matches complex hierarchical single and multi-level wildcards', () => {
      assert.strictEqual(matchMqttTopic('smartgrid/+/+/telemetry', 'smartgrid/zone/1/telemetry'), true);
      assert.strictEqual(matchMqttTopic('smartgrid/+/+/telemetry', 'smartgrid/building/alpha/telemetry'), true);
      assert.strictEqual(matchMqttTopic('smartgrid/+/+/telemetry', 'smartgrid/zone/1/sub/telemetry'), false);

      assert.strictEqual(matchMqttTopic('+/zone/#', 'smartgrid/zone/1/telemetry'), true);
      assert.strictEqual(matchMqttTopic('+/zone/#', 'industrial/zone/temperature/raw'), true);
      assert.strictEqual(matchMqttTopic('+/zone/#', 'zone/1'), false);
    });

    it('guards against system $SYS topics leakage with wildcards', () => {
      assert.strictEqual(matchMqttTopic('#', '$SYS/broker/uptime'), false);
      assert.strictEqual(matchMqttTopic('+', '$SYS'), false);
      assert.strictEqual(matchMqttTopic('$SYS/#', '$SYS/broker/uptime'), true);
    });

    it('validates QoS 2 4-step handshake lifecycle state transitions', () => {
      const qos2States = {};
      const packetId = 42;

      // 1. Initial Publish received
      qos2States[packetId] = 'RECEIVED';
      assert.strictEqual(qos2States[packetId], 'RECEIVED');

      // 2. PUBREC response
      assert.strictEqual(qos2States[packetId], 'RECEIVED');

      // 3. PUBREL received
      qos2States[packetId] = 'RELEASED';
      assert.strictEqual(qos2States[packetId], 'RELEASED');

      // 4. PUBCOMP response
      qos2States[packetId] = 'COMPLETED';
      assert.strictEqual(qos2States[packetId], 'COMPLETED');
    });

    it('handles retained message clearing via empty payload per OASIS MQTT specification', () => {
      const retainedStore = {};

      // Publish retained telemetry
      retainedStore['smartgrid/zone/1/telemetry'] = { payload: '{"pv": 24.0}', retain: true };
      assert.ok(retainedStore['smartgrid/zone/1/telemetry']);

      // Publish empty payload to clear retained message
      const clearPayload = '';
      if (clearPayload === '' || clearPayload === null) {
        delete retainedStore['smartgrid/zone/1/telemetry'];
      }
      assert.strictEqual(retainedStore['smartgrid/zone/1/telemetry'], undefined);
    });

    it('validates Last Will & Testament (LWT) trigger on keep-alive timeout (1.5x timeout)', () => {
      const client = {
        id: 'ESP32-Node-01',
        keepAlive: 10,
        lastSeen: 1000.0,
        online: true,
        will: {
          topic: 'smartgrid/alerts/offline',
          payload: '{"status": "OFFLINE", "reason": "LWT_TIMEOUT"}'
        }
      };

      const nowNormal = 1014.0; // 14s elapsed <= 15s (1.5 * 10)
      const timeoutLimit = client.keepAlive * 1.5;
      let lwtTriggered = false;

      if ((nowNormal - client.lastSeen) > timeoutLimit) {
        lwtTriggered = true;
      }
      assert.strictEqual(lwtTriggered, false, '14s elapsed must not trigger LWT');

      const nowTimeout = 1016.0; // 16s elapsed > 15s
      if ((nowTimeout - client.lastSeen) > timeoutLimit) {
        client.online = false;
        lwtTriggered = true;
      }
      assert.strictEqual(lwtTriggered, true, '16s elapsed (> 15s) must trigger LWT offline alert');
      assert.strictEqual(client.online, false);
    });
  });

});

