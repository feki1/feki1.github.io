#!/usr/bin/env python3
"""
Comprehensive Empirical Stress-Testing Harness for SmartGrid IoT
Author: Challenger 2 (Empirical Challenger)
Target Modules:
  - projects/smartgrid-iot/src/edge_anomaly_detector.py
  - projects/smartgrid-iot/src/mqtt_telemetry_broker.py
"""

import sys
import os
import math
import time
import json
import traceback

# Ensure projects/smartgrid-iot/src is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
SRC_DIR = os.path.join(PROJECT_ROOT, "projects", "smartgrid-iot", "src")
sys.path.insert(0, SRC_DIR)

from edge_anomaly_detector import ClosedLoopPIDController, EdgeAnomalyDetector, BatteryLifeEstimator
from mqtt_telemetry_broker import MqttTopicRouter, SmartGridMqttBridge

passed_count = 0
failed_count = 0
failures = []

def run_test(name, fn):
    global passed_count, failed_count
    try:
        fn()
        passed_count += 1
        print(f"  [PASS] {name}")
    except Exception as e:
        failed_count += 1
        failures.append((name, str(e), traceback.format_exc()))
        print(f"  [FAIL] {name}: {e}")

print("================================================================================")
print("EMPIRICAL STRESS TESTING: SmartGrid Anomaly Detection & MQTT Broker")
print(f"Python Executable: {sys.executable}")
print(f"Target Source Dir: {SRC_DIR}")
print("================================================================================\n")

# ==============================================================================
# SECTION 1: EDGE ANOMALY DETECTOR STRESS TESTS
# ==============================================================================
print("--- Suite 1: Edge Anomaly Detector (Z-Score, EWMA, CUSUM & Latching) ---")

def test_sliding_window_z_score():
    detector = EdgeAnomalyDetector(window_size=30, z_threshold=3.0, z_critical=5.0, baseline_mean=24.0, baseline_std=0.20)
    # 1. Warm-up window with 30 stable baseline readings
    for i in range(30):
        res = detector.feed(24.0 + (0.05 * math.sin(i)))
        assert not res["fail_safe_active"], f"Step {i} should not trip fail-safe"
        assert not res["z_anomaly"], f"Step {i} should not be z-anomaly"
    assert len(detector.window) == 30, f"Window length should be 30, got {len(detector.window)}"

    # 2. Moderate sub-threshold deviation (e.g. 24.5°C -> Z ~ 2.5)
    res = detector.feed(24.5)
    assert not res["z_anomaly"], f"Z-score {res['z_score']} should be below threshold 3.0"
    assert not res["fail_safe_active"], "Moderate deviation should not trip fail-safe"

    # 3. Moderate outlier (Z > 3.0, e.g. 24.8°C -> Z ~ 4.0)
    res = detector.feed(24.8)
    assert res["z_anomaly"], f"Z-score {res['z_score']} should exceed 3.0"
    # Single moderate outlier below z_critical=5.0 does not trip fail-safe immediately
    assert detector.consecutive_outliers == 1, "consecutive_outliers should be 1"

    # 4. Critical single spike (Z >= 5.0, e.g. 35.0°C)
    res = detector.feed(35.0)
    assert res["z_score"] >= 5.0, f"Z-score {res['z_score']} should be >= 5.0"
    assert res["fail_safe_active"], "Z >= 5.0 must immediately trip fail-safe"
    assert res["actuator_cutoff"], "actuator_cutoff must be True"
    assert "Z_SCORE_ANOMALY_EXCEEDED" in res["trip_reason"], f"Trip reason: {res['trip_reason']}"

run_test("Sliding-Window Z-Score Outlier Detection (W=30, Z > 3.0, Z >= 5.0 critical)", test_sliding_window_z_score)


def test_consecutive_outliers_latch():
    # 3 consecutive moderate outliers (Z > 3.0 but < 5.0) must trip fail-safe
    detector = EdgeAnomalyDetector(window_size=30, z_threshold=3.0, z_critical=10.0, baseline_mean=24.0, baseline_std=0.20)
    for _ in range(30):
        detector.feed(24.0)
    
    # Feeding 24.7°C (Z ~ 3.5, < 10.0)
    r1 = detector.feed(24.7)
    assert r1["z_anomaly"] and not r1["fail_safe_active"], "1st outlier should not trip"
    r2 = detector.feed(24.7)
    assert r2["z_anomaly"] and not r2["fail_safe_active"], "2nd outlier should not trip"
    r3 = detector.feed(24.7)
    assert r3["z_anomaly"] and r3["fail_safe_active"], "3rd consecutive outlier MUST trip fail-safe"
    assert detector.consecutive_outliers == 3, f"Expected 3, got {detector.consecutive_outliers}"

run_test("Consecutive Outlier Accumulation & Latching (3 consecutive Z > 3.0)", test_consecutive_outliers_latch)


def test_zero_variance_guard():
    # 30 identical readings: variance = 0. Detector must guard against division by zero using baseline_std
    detector = EdgeAnomalyDetector(window_size=30, baseline_mean=24.0, baseline_std=0.25)
    for _ in range(30):
        detector.feed(24.0)
    # std_dev should be 0, but effective_sigma should fall back to baseline_std (0.25)
    res = detector.feed(24.0)
    assert res["z_score"] == 0.0, f"Z-score should be 0, got {res['z_score']}"
    assert math.isfinite(res["z_score"]), "Z-score must be finite"
    assert not res["fail_safe_active"], "Identical nominal values must not trip fail-safe"

run_test("Zero-Variance Sensor Window Guard (Division by Zero Prevention)", test_zero_variance_guard)


def test_ewma_and_cusum_drift_detection():
    # Test EWMA smoothing (alpha=0.20) and CUSUM drift detection (k=0.5*sigma0=0.10, h=4.5*sigma0=0.90)
    sigma0 = 0.20
    detector = EdgeAnomalyDetector(
        window_size=30,
        ewma_alpha=0.20,
        cusum_slack=0.5,
        cusum_threshold=4.5,
        baseline_mean=24.0,
        baseline_std=sigma0
    )

    # 1. EWMA step check
    detector.feed(24.0)
    assert detector.ewma == 24.0, f"Initial EWMA must be 24.0, got {detector.ewma}"
    detector.feed(25.0)
    expected_ewma = (0.20 * 25.0) + (0.80 * 24.0)  # 5.0 + 19.2 = 24.2
    assert abs(detector.ewma - expected_ewma) < 1e-6, f"EWMA mismatch: {detector.ewma} vs {expected_ewma}"

    # Reset
    detector.reset_interlock()
    detector.window.clear()
    detector.ewma = None

    # Upward persistent drift: baseline is 24.0. We feed 24.6°C (+0.6°C shift).
    # k = 0.5 * 0.20 = 0.10. Each step adds (24.6 - 24.0 - 0.10) = 0.50 to cusum_high.
    # h = 4.5 * 0.20 = 0.90.
    # Step 1: cusum_high = 0.50
    # Step 2: cusum_high = 1.00 > 0.90 -> cusum_anomaly = True, trips fail-safe!
    r1 = detector.feed(24.6)
    assert abs(r1["cusum_high"] - 0.50) < 1e-4, f"CUSUM high step 1: {r1['cusum_high']}"
    assert not r1["cusum_anomaly"], "Step 1 should not trip CUSUM"

    r2 = detector.feed(24.6)
    assert abs(r2["cusum_high"] - 1.00) < 1e-4, f"CUSUM high step 2: {r2['cusum_high']}"
    assert r2["cusum_anomaly"], "Step 2 MUST trip CUSUM (1.00 > 0.90)"
    assert r2["fail_safe_active"], "CUSUM drift must trip fail-safe actuator cutoff"
    assert "CUSUM_CALIBRATION_DRIFT" in r2["trip_reason"], f"Trip reason: {r2['trip_reason']}"

    # Downward persistent drift test:
    detector.reset_interlock()
    # Feed 23.4°C (-0.6°C shift). Each step adds -(23.4 - 24.0 + 0.10) = -(-0.50) = 0.50 to cusum_low.
    r1_down = detector.feed(23.4)
    assert abs(r1_down["cusum_low"] - 0.50) < 1e-4, f"CUSUM low step 1: {r1_down['cusum_low']}"
    assert not r1_down["cusum_anomaly"]

    r2_down = detector.feed(23.4)
    assert abs(r2_down["cusum_low"] - 1.00) < 1e-4, f"CUSUM low step 2: {r2_down['cusum_low']}"
    assert r2_down["cusum_anomaly"], "Step 2 MUST trip CUSUM downward drift"
    assert r2_down["fail_safe_active"], "Downward drift must trip fail-safe"

run_test("EWMA Smoothing (alpha=0.20) and CUSUM Drift Detection (k=0.5*sigma, h=4.5*sigma)", test_ewma_and_cusum_drift_detection)


def test_failsafe_latching_and_manual_reset():
    # Confirm that once tripped, fail-safe latches open and does not clear even if temperature normalizes
    detector = EdgeAnomalyDetector(critical_high=75.0, critical_low=0.0)
    detector.feed(24.0)
    assert not detector.fail_safe_active

    # Trip via thermal spike
    detector.feed(80.0)
    assert detector.fail_safe_active, "Should be active after 80°C"

    # Now feed completely normal values for 50 steps
    for _ in range(50):
        res = detector.feed(24.0)
        assert res["fail_safe_active"], "Fail-safe MUST REMAIN LATCHED until reset_interlock is called"
        assert res["actuator_cutoff"], "Actuator cutoff must remain active"

    # Manual reset
    detector.reset_interlock()
    assert not detector.fail_safe_active, "Fail-safe must clear after reset_interlock"
    assert detector.trip_reason is None, "Trip reason must be None after reset"

    # Feed normal reading again
    res = detector.feed(24.0)
    assert not res["fail_safe_active"], "Must remain normal after reset"

run_test("Fail-Safe Actuator Cutoff Persistent Latching & Manual Reset", test_failsafe_latching_and_manual_reset)


def test_non_finite_and_boundary_safety():
    detector = EdgeAnomalyDetector(critical_high=75.0, critical_low=0.0)

    # NaN input
    res_nan = detector.feed(float("nan"))
    assert res_nan["fail_safe_active"], "NaN input must trip fail-safe"
    assert res_nan["trip_reason"] == "NON_FINITE_INPUT"

    detector.reset_interlock()

    # Positive Infinity input
    res_inf = detector.feed(float("inf"))
    assert res_inf["fail_safe_active"], "Infinity input must trip fail-safe"
    assert res_inf["trip_reason"] == "NON_FINITE_INPUT"

    detector.reset_interlock()

    # Sub-zero freezing boundary (< 0.0°C)
    res_subzero = detector.feed(-5.0)
    assert res_subzero["fail_safe_active"], "Sub-zero reading must trip fail-safe"
    assert "CRITICAL_LOW_TEMP_EXCEEDED" in res_subzero["trip_reason"]

    detector.reset_interlock()

    # Extreme high temperature (> 75.0°C)
    res_high = detector.feed(85.0)
    assert res_high["fail_safe_active"], "Over-temp must trip fail-safe"
    assert "CRITICAL_HIGH_TEMP_EXCEEDED" in res_high["trip_reason"]

run_test("Non-Finite (NaN, Inf) and Critical Temperature Bounds (0°C - 75°C)", test_non_finite_and_boundary_safety)


def test_pid_and_battery_estimator():
    # ClosedLoopPIDController anti-windup & tolerance
    pid = ClosedLoopPIDController(kp=6.5, ki=1.2, kd=2.8, setpoint=24.0, max_integral=40.0, tolerance_pct=1.5)
    
    # Extreme error for 500 steps
    for _ in range(500):
        pid.update(10.0, dt=0.1)
    assert abs(pid.integral - 40.0) < 1e-6, f"Integral clamped to {pid.integral}, expected 40.0"
    assert pid.last_output == 100.0, f"Output clamped to 100.0, got {pid.last_output}"
    assert not pid.is_within_tolerance(10.0)

    # Within tolerance (+/- 1.5% of 24.0 is [23.64, 24.36])
    assert pid.is_within_tolerance(24.1)
    assert pid.is_within_tolerance(23.7)
    assert not pid.is_within_tolerance(24.5)  # 24.5 is +2.08%

    # BatteryLifeEstimator (3000 mAh, 90% usable = 2700 mAh, active 80 mA for 200 ms, sleep 15 uA for 60 s)
    batt = BatteryLifeEstimator(battery_capacity_mah=3000.0, active_current_ma=80.0, sleep_current_ua=15.0, active_duration_ms=200.0, sleep_interval_s=60.0)
    days = batt.calculate_runtime_days()
    assert days >= 185.0, f"Expected >= 185 days, got {days}"
    assert batt.meets_six_month_target(), "Must meet 6-month target"
    assert 390.0 < days < 420.0, f"Runtime {days} days outside expected ~400 days"

run_test("Closed-Loop PID Anti-Windup Precision & Battery 6-Month Model", test_pid_and_battery_estimator)

# ==============================================================================
# SECTION 2: MQTT TOPIC ROUTER STRESS TESTS
# ==============================================================================
print("\n--- Suite 2: MQTT Topic Router Wildcard & Routing Stress Tests ---")

def test_mqtt_single_level_wildcard():
    # '+' wildcard must match exactly one level
    router = MqttTopicRouter()

    # 1. Standard pattern: smartgrid/zone/+/telemetry
    assert router.match_topic("smartgrid/zone/+/telemetry", "smartgrid/zone/1/telemetry"), "Should match zone 1"
    assert router.match_topic("smartgrid/zone/+/telemetry", "smartgrid/zone/zone-42/telemetry"), "Should match zone-42"
    assert not router.match_topic("smartgrid/zone/+/telemetry", "smartgrid/zone/1/sub/telemetry"), "Must NOT match multi-level"
    assert not router.match_topic("smartgrid/zone/+/telemetry", "smartgrid/zone/telemetry"), "Must NOT match missing level"
    assert not router.match_topic("smartgrid/zone/+/telemetry", "smartgrid/zone/1/status"), "Must NOT match wrong tail"

    # 2. Leading '+' wildcard
    assert router.match_topic("+/zone/1", "smartgrid/zone/1")
    assert router.match_topic("+/zone/1", "factory/zone/1")
    assert not router.match_topic("+/zone/1", "enterprise/smartgrid/zone/1")

    # 3. Trailing '+' wildcard
    assert router.match_topic("smartgrid/zone/+", "smartgrid/zone/temp")
    assert not router.match_topic("smartgrid/zone/+", "smartgrid/zone/temp/celsius")

    # 4. Multiple single-level wildcards: +/+/telemetry
    assert router.match_topic("+/+/telemetry", "smartgrid/zone1/telemetry")
    assert router.match_topic("+/+/telemetry", "factory/substationA/telemetry")
    assert not router.match_topic("+/+/telemetry", "smartgrid/telemetry")
    assert not router.match_topic("+/+/telemetry", "smartgrid/zone1/sub/telemetry")

run_test("Single-Level Wildcard '+' Pattern Matching", test_mqtt_single_level_wildcard)


def test_mqtt_multi_level_wildcard():
    # '#' wildcard must match any number of levels
    router = MqttTopicRouter()

    # 1. Root wildcard: '#' matches everything
    assert router.match_topic("#", "smartgrid")
    assert router.match_topic("#", "smartgrid/zone/1/telemetry")
    assert router.match_topic("#", "a/b/c/d/e/f/g")

    # 2. Trailing '#' wildcard: smartgrid/#
    assert router.match_topic("smartgrid/#", "smartgrid")
    assert router.match_topic("smartgrid/#", "smartgrid/zone")
    assert router.match_topic("smartgrid/#", "smartgrid/zone/1")
    assert router.match_topic("smartgrid/#", "smartgrid/zone/1/sub/sub2/telemetry")
    assert not router.match_topic("smartgrid/#", "factory/zone/1")
    assert not router.match_topic("smartgrid/#", "smart/grid")

    # 3. Sub-level trailing '#': smartgrid/zone/1/#
    assert router.match_topic("smartgrid/zone/1/#", "smartgrid/zone/1")
    assert router.match_topic("smartgrid/zone/1/#", "smartgrid/zone/1/temperature")
    assert router.match_topic("smartgrid/zone/1/#", "smartgrid/zone/1/device/status/voltage")
    assert not router.match_topic("smartgrid/zone/1/#", "smartgrid/zone/2/temperature")

    # 4. Misplaced '#' (not at end of pattern): must NOT match per MQTT spec
    assert not router.match_topic("smartgrid/#/telemetry", "smartgrid/zone1/telemetry")

run_test("Multi-Level Wildcard '#' Pattern Matching", test_mqtt_multi_level_wildcard)


def test_mqtt_topic_validation_and_system_topics():
    router = MqttTopicRouter()

    # Empty inputs
    assert not router.match_topic("", "smartgrid/zone/1")
    assert not router.match_topic("smartgrid/zone/1", "")
    assert not router.match_topic("", "")

    # System topics starting with '$'
    assert not router.match_topic("#", "$SYS/broker/status"), "Wildcard '#' must NOT match $SYS system topics"
    assert not router.match_topic("+/broker/status", "$SYS/broker/status"), "Wildcard '+' must NOT match $SYS"
    assert router.match_topic("$SYS/#", "$SYS/broker/status"), "Explicit $SYS subscription matches"
    assert router.match_topic("$SYS/broker/status", "$SYS/broker/status"), "Exact $SYS matches"

    # Dispatch mechanism
    received = []
    def on_telemetry(t, p):
        received.append((t, p))

    router.subscribe("smartgrid/zone/+/telemetry", on_telemetry)
    router.dispatch("smartgrid/zone/1/telemetry", {"temp": 24.2})
    router.dispatch("smartgrid/zone/2/telemetry", {"temp": 25.1})
    router.dispatch("smartgrid/zone/1/alerts", {"alarm": True})  # Should NOT match

    assert len(received) == 2, f"Expected 2 dispatched messages, got {len(received)}"
    assert received[0][0] == "smartgrid/zone/1/telemetry"
    assert received[1][0] == "smartgrid/zone/2/telemetry"

    # Unsubscribe
    router.unsubscribe("smartgrid/zone/+/telemetry", on_telemetry)
    router.dispatch("smartgrid/zone/1/telemetry", {"temp": 26.0})
    assert len(received) == 2, "After unsubscribe, no new messages should be received"

run_test("Topic Validation, System Topics ($SYS) Isolation & Dispatching", test_mqtt_topic_validation_and_system_topics)

# ==============================================================================
# SECTION 3: SMARTGRID MQTT BRIDGE STRESS TESTS
# ==============================================================================
print("\n--- Suite 3: SmartGrid MQTT Bridge (QoS 0/1/2, Retained, LWT) ---")

def test_qos_schemas_and_payload_validation():
    bridge = SmartGridMqttBridge()

    # QoS 0: no packet ID (0)
    p0 = bridge.publish("smartgrid/zone/1/telemetry", {"temp": 24.0}, qos=0)
    assert p0["qos"] == 0
    assert p0["packet_id"] == 0
    assert json.loads(p0["payload"]) == {"temp": 24.0}

    # QoS 1: packet ID > 0, generates PUBACK
    p1 = bridge.publish("smartgrid/zone/1/telemetry", "Alert: Overheat", qos=1)
    assert p1["qos"] == 1
    assert p1["packet_id"] > 0
    ack1 = bridge.acknowledge_qos1(p1["packet_id"])
    assert ack1["type"] == "PUBACK"
    assert ack1["packet_id"] == p1["packet_id"]
    assert ack1["status"] == "ACKNOWLEDGED"

    # QoS 2: 4-step handshake (PUBLISH -> PUBREC -> PUBREL -> PUBCOMP)
    p2 = bridge.publish("smartgrid/zone/1/control", {"relay": "OPEN"}, qos=2)
    pid = p2["packet_id"]
    assert p2["qos"] == 2
    assert pid > 0

    rec = bridge.handle_qos2_handshake("PUBREC", pid)
    assert rec["type"] == "PUBREC" and rec["status"] == "RECEIVED"
    assert bridge._qos2_states[pid] == "RECEIVED"

    rel = bridge.handle_qos2_handshake("PUBREL", pid)
    assert rel["type"] == "PUBREL" and rel["status"] == "RELEASED"
    assert bridge._qos2_states[pid] == "RELEASED"

    comp = bridge.handle_qos2_handshake("PUBCOMP", pid)
    assert comp["type"] == "PUBCOMP" and comp["status"] == "COMPLETED"
    assert bridge._qos2_states[pid] == "COMPLETED"

    # Invalid stage should raise ValueError
    try:
        bridge.handle_qos2_handshake("INVALID_STAGE", pid)
        assert False, "Should have raised ValueError on invalid QoS 2 stage"
    except ValueError:
        pass

    # Publish topic cannot be empty
    try:
        bridge.publish("", "data")
        assert False, "Empty topic must raise ValueError"
    except ValueError:
        pass

    # Publish topic cannot contain wildcards
    try:
        bridge.publish("smartgrid/+/telemetry", "data")
        assert False, "Publish to wildcard topic must raise ValueError"
    except ValueError:
        pass

    try:
        bridge.publish("smartgrid/#", "data")
        assert False, "Publish to # topic must raise ValueError"
    except ValueError:
        pass

run_test("QoS 0, QoS 1, QoS 2 Packet Schemas & Handshake Verification", test_qos_schemas_and_payload_validation)


def test_retained_message_lifecycle():
    bridge = SmartGridMqttBridge()

    # 1. Publish retained message on smartgrid/zone/1/config
    bridge.publish("smartgrid/zone/1/config", {"kp": 6.5, "setpoint": 24.0}, retain=True)

    # Verify message is cached in retained store
    retained = bridge.get_retained("smartgrid/zone/1/config")
    assert retained is not None, "Retained message must be cached"
    assert json.loads(retained["payload"])["kp"] == 6.5
    assert retained["retain"] is True

    # 2. New client subscribes to topic -> immediately receives retained message
    client1_msgs = []
    delivered = bridge.subscribe("client-web-dashboard", "smartgrid/zone/1/config", lambda t, p: client1_msgs.append(p))
    assert len(delivered) == 1, f"Expected 1 immediate retained delivery, got {len(delivered)}"
    assert len(client1_msgs) == 1
    assert client1_msgs[0]["retained_delivery"] is True

    # 3. New client subscribes via wildcard -> immediately receives retained message
    wildcard_msgs = []
    delivered_wild = bridge.subscribe("client-scada", "smartgrid/zone/+/config", lambda t, p: wildcard_msgs.append(p))
    assert len(delivered_wild) == 1
    assert len(wildcard_msgs) == 1

    # 4. Clear retained message by publishing empty payload with retain=True per MQTT spec
    bridge.publish("smartgrid/zone/1/config", "", retain=True)
    assert bridge.get_retained("smartgrid/zone/1/config") is None, "Empty payload must delete retained message"

    # New subscriber after clearing should receive NO retained message
    new_sub_msgs = []
    delivered_after = bridge.subscribe("client-new", "smartgrid/zone/1/config", lambda t, p: new_sub_msgs.append(p))
    assert len(delivered_after) == 0, "No retained message should be delivered after clearing"

run_test("Retained Message Storage, Immediate Subscription Delivery & Clearing", test_retained_message_lifecycle)


def test_lwt_offline_detection():
    bridge = SmartGridMqttBridge()

    # Monitor LWT alerts topic
    lwt_alerts = []
    bridge.subscribe("monitor-agent", "smartgrid/alerts/lwt", lambda t, p: lwt_alerts.append(p))

    # Register ESP32 node with 10s keep_alive and registered LWT
    start_time = 1000.0
    bridge.register_client(
        client_id="esp32-node-zone-1",
        keep_alive=10,
        will_topic="smartgrid/alerts/lwt",
        will_payload=json.dumps({"node": "zone-1", "status": "LOST_COMMUNICATIONS"}),
        will_qos=1,
        will_retain=True
    )
    # Set known last_seen timestamp
    bridge._clients["esp32-node-zone-1"]["last_seen"] = start_time

    # 1. Sweep at t = 1010s (elapsed 10s <= 1.5 * 10 = 15s) -> no timeout
    res1 = bridge.check_timeouts(current_time=1010.0)
    assert len(res1) == 0, "Client should still be online at 10s elapsed"
    assert bridge._clients["esp32-node-zone-1"]["online"] is True
    assert len(lwt_alerts) == 0

    # 2. Ping at t = 1012s
    bridge._clients["esp32-node-zone-1"]["last_seen"] = 1012.0

    # 3. Sweep at t = 1020s (elapsed 8s) -> no timeout
    res2 = bridge.check_timeouts(current_time=1020.0)
    assert len(res2) == 0

    # 4. Advance time to t = 1030s (elapsed 18s > 15s timeout limit) -> TIMEOUT!
    res3 = bridge.check_timeouts(current_time=1030.0)
    assert len(res3) == 1, f"Expected 1 LWT alert, got {len(res3)}"
    assert res3[0]["client_id"] == "esp32-node-zone-1"
    assert res3[0]["reason"] == "KEEP_ALIVE_TIMEOUT"
    assert bridge._clients["esp32-node-zone-1"]["online"] is False
    assert len(lwt_alerts) == 1, f"Subscriber should have received LWT alert, got {len(lwt_alerts)}"

    alert_payload = json.loads(lwt_alerts[0]["payload"])
    assert alert_payload["node"] == "zone-1"
    assert alert_payload["status"] == "LOST_COMMUNICATIONS"

    # 5. Test ungraceful disconnect immediately firing LWT
    bridge.register_client(
        client_id="esp32-node-zone-2",
        keep_alive=60,
        will_topic="smartgrid/alerts/lwt",
        will_payload="Zone 2 Abruptly Disconnected",
        will_qos=0
    )
    bridge.disconnect("esp32-node-zone-2", graceful=False)
    assert len(lwt_alerts) == 2, "Ungraceful disconnect must trigger immediate LWT publish"
    assert lwt_alerts[1]["payload"] == "Zone 2 Abruptly Disconnected"

    # 6. Test graceful disconnect NOT firing LWT
    bridge.register_client(
        client_id="esp32-node-zone-3",
        keep_alive=60,
        will_topic="smartgrid/alerts/lwt",
        will_payload="Zone 3 Disconnected",
        will_qos=0
    )
    bridge.disconnect("esp32-node-zone-3", graceful=True)
    assert len(lwt_alerts) == 2, "Graceful disconnect must NOT trigger LWT publish"

run_test("Last Will & Testament (LWT) Offline Detection & Disconnect Handling", test_lwt_offline_detection)

# ==============================================================================
# SUMMARY REPORT
# ==============================================================================
print("\n================================================================================")
print(f"STRESS TEST RESULTS: {passed_count} PASSED, {failed_count} FAILED")
print("================================================================================")

if failures:
    print("\nFAILURES DETECTED:")
    for name, err, tb in failures:
        print(f"\n--- {name} ---")
        print(err)
        print(tb)
    sys.exit(1)
else:
    print("\nALL STRESS TESTS PASSED WITH 100% SUCCESS.")
    sys.exit(0)
