#!/usr/bin/env python3
"""
===============================================================================
SmartGrid IoT: Edge Anomaly Detection, Closed-Loop PID & Battery Life Engine
===============================================================================
Developer: Mohamed Seddik Feki <fekiseddik@gmail.com>
Academic Profile: Bachelor of Robotics and Automation Engineering (Honours)
Institution: Xiamen University Malaysia (XMUM)
License: MIT

Description:
High-precision analytical engine implementing:
1. ClosedLoopPIDController: Discrete PID with integral anti-windup clamping
   and low-pass filtered derivative maintaining control within +/- 1.5%.
2. EdgeAnomalyDetector: Sliding-window Z-score statistical outlier detection,
   Exponentially Weighted Moving Average (EWMA), and Cumulative Sum (CUSUM)
   calibration drift detection with automatic fail-safe actuator cutoff.
3. BatteryLifeEstimator: Mathematical autonomy model evaluating active/sleep
   duty cycles, verifying 6+ months (> 185 days) runtime on a 3000 mAh Li-ion cell.
===============================================================================
"""

from collections import deque
import math
from typing import Any, Dict, List, Optional


class ClosedLoopPIDController:
    """
    Discrete Closed-Loop PID Controller with Integral Anti-Windup Clamping
    and Low-Pass Filtered Derivative Action maintaining setpoint precision
    within +/- 1.5%.
    """

    def __init__(
        self,
        kp: float = 6.5,
        ki: float = 1.2,
        kd: float = 2.8,
        setpoint: float = 24.0,
        min_output: float = 0.0,
        max_output: float = 100.0,
        max_integral: float = 40.0,
        derivative_filter_alpha: float = 0.70,
        tolerance_pct: float = 1.5,
    ) -> None:
        self.kp = float(kp)
        self.ki = float(ki)
        self.kd = float(kd)
        self.setpoint = float(setpoint)
        self.min_output = float(min_output)
        self.max_output = float(max_output)
        self.max_integral = float(max_integral)
        self.derivative_filter_alpha = float(derivative_filter_alpha)
        self.tolerance_pct = float(tolerance_pct)

        self.integral: float = 0.0
        self.prev_error: float = 0.0
        self.filtered_derivative: float = 0.0
        self.last_output: float = 0.0

    def reset(self) -> None:
        """Resets integral and derivative accumulators to initial state."""
        self.integral = 0.0
        self.prev_error = 0.0
        self.filtered_derivative = 0.0
        self.last_output = 0.0

    def set_setpoint(self, new_setpoint: float) -> None:
        """Safely updates target setpoint without resetting accumulators."""
        if math.isfinite(new_setpoint):
            self.setpoint = float(new_setpoint)

    def update(self, measured_value: float, dt: float = 1.0) -> float:
        """
        Computes discrete PID control effort with anti-windup clamping and low-pass filtered derivative.
        
        :param measured_value: Current process variable (e.g. Temperature in °C)
        :param dt: Time delta in seconds (must be positive and finite)
        :return: Clamped control effort in range [min_output, max_output] (%)
        """
        if not math.isfinite(measured_value) or not math.isfinite(dt) or dt <= 0.0:
            return 0.0

        error = self.setpoint - measured_value

        # 1. Proportional Term
        p_term = self.kp * error

        # 2. Integral Term with Clamping Anti-Windup
        self.integral += error * dt
        if self.integral > self.max_integral:
            self.integral = self.max_integral
        elif self.integral < -self.max_integral:
            self.integral = -self.max_integral
        i_term = self.ki * self.integral

        # 3. Low-Pass Filtered Derivative Action
        # Attenuates high-frequency sensor noise and prevents derivative kick
        raw_derivative = (error - self.prev_error) / dt
        self.filtered_derivative = (
            (self.derivative_filter_alpha * self.filtered_derivative)
            + ((1.0 - self.derivative_filter_alpha) * raw_derivative)
        )
        self.prev_error = error
        d_term = self.kd * self.filtered_derivative

        # 4. Summation and Actuator Bound Clamping
        unclamped_output = p_term + i_term + d_term
        clamped_output = max(self.min_output, min(self.max_output, unclamped_output))
        self.last_output = clamped_output

        return clamped_output

    def is_within_tolerance(self, measured_value: float) -> bool:
        """
        Evaluates whether process variable is within target tolerance (+/- 1.5% of setpoint).
        """
        if not math.isfinite(measured_value):
            return False
        if abs(self.setpoint) < 1e-6:
            return abs(measured_value - self.setpoint) <= 0.05

        deviation_pct = (abs(measured_value - self.setpoint) / abs(self.setpoint)) * 100.0
        return deviation_pct <= self.tolerance_pct

    def get_diagnostics(self, measured_value: Optional[float] = None) -> Dict[str, Any]:
        """Returns internal state diagnostics dictionary."""
        current_val = measured_value if measured_value is not None else (self.setpoint - self.prev_error)
        return {
            "setpoint": self.setpoint,
            "measured_value": current_val,
            "error": self.setpoint - current_val,
            "integral": self.integral,
            "filtered_derivative": self.filtered_derivative,
            "last_output": self.last_output,
            "within_tolerance": self.is_within_tolerance(current_val),
            "tolerance_pct": self.tolerance_pct,
        }


class EdgeAnomalyDetector:
    """
    Edge Anomaly Detector combining Sliding-Window Z-Score Outlier Detection,
    EWMA Trend Smoothing, and CUSUM Persistent Drift Detection.
    Automatically latches fail-safe actuator cutoff upon severe anomaly or drift.
    """

    def __init__(
        self,
        window_size: int = 30,
        z_threshold: float = 3.0,
        z_critical: float = 5.0,
        ewma_alpha: float = 0.20,
        cusum_slack: float = 0.5,
        cusum_threshold: float = 4.5,
        critical_high: float = 75.0,
        critical_low: float = 0.0,
        baseline_mean: float = 24.0,
        baseline_std: float = 0.20,
    ) -> None:
        self.window_size = max(5, int(window_size))
        self.z_threshold = float(z_threshold)
        self.z_critical = float(z_critical)
        self.ewma_alpha = float(ewma_alpha)
        self.cusum_slack = float(cusum_slack)
        self.cusum_threshold = float(cusum_threshold)
        self.critical_high = float(critical_high)
        self.critical_low = float(critical_low)
        self.baseline_mean = float(baseline_mean)
        self.baseline_std = max(1e-4, float(baseline_std))

        self.window: deque[float] = deque(maxlen=self.window_size)
        self.ewma: Optional[float] = None
        self.cusum_high: float = 0.0
        self.cusum_low: float = 0.0
        self.fail_safe_active: bool = False
        self.trip_reason: Optional[str] = None
        self.consecutive_outliers: int = 0

    def reset_interlock(self) -> None:
        """Resets fail-safe interlock latch and restores normal monitoring."""
        self.fail_safe_active = False
        self.trip_reason = None
        self.cusum_high = 0.0
        self.cusum_low = 0.0
        self.consecutive_outliers = 0

    def reset_failsafe(self) -> None:
        """Alias for reset_interlock."""
        self.reset_interlock()

    def feed(self, value: float) -> Dict[str, Any]:
        """
        Feeds a new sensor reading into the anomaly detection pipeline.
        
        :param value: Sensor reading (e.g. Temperature in °C)
        :return: Detection report dictionary
        """
        # 1. Guard against non-finite numerical inputs
        if not math.isfinite(value):
            self.fail_safe_active = True
            self.trip_reason = "NON_FINITE_INPUT"
            return {
                "value": value,
                "z_score": float("inf"),
                "z_anomaly": True,
                "ewma": self.ewma or 0.0,
                "cusum_high": self.cusum_high,
                "cusum_low": self.cusum_low,
                "cusum_anomaly": True,
                "fail_safe_active": True,
                "actuator_cutoff": True,
                "trip_reason": self.trip_reason,
            }

        # 2. Check Critical Temperature Safety Bounds
        if value > self.critical_high:
            self.fail_safe_active = True
            self.trip_reason = f"CRITICAL_HIGH_TEMP_EXCEEDED: {value:.2f}°C > {self.critical_high:.2f}°C"
        elif value < self.critical_low:
            self.fail_safe_active = True
            self.trip_reason = f"CRITICAL_LOW_TEMP_EXCEEDED: {value:.2f}°C < {self.critical_low:.2f}°C"

        # 3. Update Sliding-Window Statistics
        self.window.append(value)
        n = len(self.window)
        mean = sum(self.window) / n
        if n > 1:
            variance = sum((x - mean) ** 2 for x in self.window) / (n - 1)
            std_dev = math.sqrt(variance)
        else:
            std_dev = self.baseline_std

        # 4. Standardized Z-Score Outlier Detection
        # Safe zero-division guard when all window elements are identical
        effective_sigma = std_dev if std_dev > 1e-5 else self.baseline_std
        z_score = abs(value - mean) / effective_sigma
        z_anomaly = z_score > self.z_threshold

        if z_anomaly:
            self.consecutive_outliers += 1
        else:
            self.consecutive_outliers = 0

        # Critical single spike or persistent outliers trigger fail-safe
        if z_score >= self.z_critical or self.consecutive_outliers >= 3:
            self.fail_safe_active = True
            if self.trip_reason is None:
                self.trip_reason = f"Z_SCORE_ANOMALY_EXCEEDED: Z={z_score:.2f} > {self.z_critical:.2f}"

        # 5. Exponentially Weighted Moving Average (EWMA)
        if self.ewma is None:
            self.ewma = value
        else:
            self.ewma = (self.ewma_alpha * value) + ((1.0 - self.ewma_alpha) * self.ewma)

        # 6. Cumulative Sum (CUSUM) Calibration Drift Detection
        # Tracks persistent low-amplitude systematic shifts: k = slack * sigma_0, h = threshold * sigma_0
        k = self.cusum_slack * self.baseline_std
        h = self.cusum_threshold * self.baseline_std

        self.cusum_high = max(0.0, self.cusum_high + (value - self.baseline_mean - k))
        self.cusum_low = max(0.0, self.cusum_low - (value - self.baseline_mean + k))
        cusum_anomaly = (self.cusum_high > h) or (self.cusum_low > h)

        if cusum_anomaly:
            self.fail_safe_active = True
            if self.trip_reason is None:
                self.trip_reason = (
                    f"CUSUM_CALIBRATION_DRIFT: Sh={self.cusum_high:.3f}, Sl={self.cusum_low:.3f} > {h:.3f}"
                )

        return {
            "value": value,
            "window_mean": mean,
            "window_std": std_dev,
            "z_score": z_score,
            "z_anomaly": z_anomaly,
            "ewma": self.ewma,
            "cusum_high": self.cusum_high,
            "cusum_low": self.cusum_low,
            "cusum_anomaly": cusum_anomaly,
            "fail_safe_active": self.fail_safe_active,
            "actuator_cutoff": self.fail_safe_active,
            "trip_reason": self.trip_reason,
        }


class BatteryLifeEstimator:
    """
    IoT Battery Autonomy Estimator modeling active/sleep duty cycles,
    quiescent currents, and battery derating over 6+ months runtime.
    """

    def __init__(
        self,
        battery_capacity_mah: float = 3000.0,
        active_current_ma: float = 80.0,
        sleep_current_ua: float = 15.0,
        active_duration_ms: float = 200.0,
        sleep_interval_s: float = 60.0,
        usable_capacity_ratio: float = 0.90,
    ) -> None:
        self.battery_capacity_mah = max(100.0, float(battery_capacity_mah))
        self.active_current_ma = max(1.0, float(active_current_ma))
        self.sleep_current_ua = max(0.1, float(sleep_current_ua))
        self.active_duration_ms = max(1.0, float(active_duration_ms))
        self.sleep_interval_s = max(1.0, float(sleep_interval_s))
        self.usable_capacity_ratio = max(0.5, min(1.0, float(usable_capacity_ratio)))

    def calculate_average_current_ma(self) -> float:
        """
        Computes weighted average current consumption per wake/sleep cycle:
        I_avg = (I_active * T_active + I_sleep * T_sleep) / (T_active + T_sleep)
        """
        t_active_sec = self.active_duration_ms / 1000.0
        t_sleep_sec = self.sleep_interval_s
        t_cycle = t_active_sec + t_sleep_sec

        sleep_current_ma = self.sleep_current_ua / 1000.0

        q_active = self.active_current_ma * t_active_sec  # mA * s
        q_sleep = sleep_current_ma * t_sleep_sec          # mA * s
        q_total = q_active + q_sleep

        return q_total / t_cycle

    def calculate_runtime_hours(self) -> float:
        """Computes autonomous operating runtime in hours."""
        usable_mah = self.battery_capacity_mah * self.usable_capacity_ratio
        i_avg = self.calculate_average_current_ma()
        if i_avg <= 0.0:
            return float("inf")
        return usable_mah / i_avg

    def calculate_runtime_days(self) -> float:
        """Computes autonomous operating runtime in days."""
        return self.calculate_runtime_hours() / 24.0

    def calculate_runtime_months(self) -> float:
        """Computes autonomous operating runtime in months (30.4375 days/month)."""
        return self.calculate_runtime_days() / 30.4375

    def meets_six_month_target(self) -> bool:
        """Verifies whether battery autonomy satisfies the 6-month (>= 185 days) requirement."""
        return self.calculate_runtime_days() >= 185.0

    def find_minimum_sleep_interval(self, target_days: float = 185.0) -> float:
        """
        Calculates the minimum required sleep interval in seconds to satisfy target days.
        """
        usable_mah = self.battery_capacity_mah * self.usable_capacity_ratio
        max_avg_current = usable_mah / (target_days * 24.0)

        t_act = self.active_duration_ms / 1000.0
        i_act = self.active_current_ma
        i_slp = self.sleep_current_ua / 1000.0

        # max_avg_current = (i_act * t_act + i_slp * t_slp) / (t_act + t_slp)
        # max_avg_current * (t_act + t_slp) = i_act * t_act + i_slp * t_slp
        # t_slp * (max_avg_current - i_slp) = t_act * (i_act - max_avg_current)
        denominator = max_avg_current - i_slp
        if denominator <= 0:
            return float("inf")

        t_slp = (t_act * (i_act - max_avg_current)) / denominator
        return max(1.0, t_slp)

    def get_detailed_summary(self) -> Dict[str, Any]:
        """Provides full breakdown of energy budget, daily consumption, and lifespans."""
        i_avg = self.calculate_average_current_ma()
        days = self.calculate_runtime_days()
        months = self.calculate_runtime_months()
        daily_consumption = i_avg * 24.0
        meets_target = self.meets_six_month_target()

        return {
            "battery_nominal_mah": self.battery_capacity_mah,
            "usable_capacity_mah": self.battery_capacity_mah * self.usable_capacity_ratio,
            "active_current_ma": self.active_current_ma,
            "sleep_current_ua": self.sleep_current_ua,
            "active_duration_ms": self.active_duration_ms,
            "sleep_interval_s": self.sleep_interval_s,
            "average_current_ma": i_avg,
            "average_current_ua": i_avg * 1000.0,
            "daily_consumption_mah": daily_consumption,
            "autonomy_hours": self.calculate_runtime_hours(),
            "autonomy_days": days,
            "autonomy_months": months,
            "meets_185_day_target": meets_target,
        }
