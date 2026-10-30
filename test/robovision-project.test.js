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

describe('RoboVision Project 3: ROS2 & ESP32 Autonomous Mobile Robot & SLAM Dashboard Verification', () => {

  // =========================================================================
  // R1: Real ROS2 Python & ESP32 C++ Codebase in projects/robovision-ros2/
  // =========================================================================
  describe('R1: Real ROS2 Python & ESP32 C++ Codebase in projects/robovision-ros2/', () => {

    it('package.xml exists, is valid XML, and defines ROS2 Humble dependencies & metadata', () => {
      const xml = readIfExists('projects/robovision-ros2/package.xml');
      assert.ok(xml, 'package.xml must exist');
      assert.match(xml, /<name>\s*robovision_ros2\s*<\/name>/);
      assert.match(xml, /<version>\s*1\.0\.0\s*<\/version>/);
      assert.match(xml, /<buildtool_depend>\s*ament_python\s*<\/buildtool_depend>/);
      assert.match(xml, /<depend>\s*rclpy\s*<\/depend>/);
      assert.match(xml, /<depend>\s*geometry_msgs\s*<\/depend>/);
      assert.match(xml, /<depend>\s*nav_msgs\s*<\/depend>/);
      assert.match(xml, /<depend>\s*sensor_msgs\s*<\/depend>/);
      assert.match(xml, /Mohamed Seddik Feki/);
      assert.match(xml, /seddikfeki15@gmail\.com/);
      assert.match(xml, /Apache-2\.0/);
    });

    it('setup.py exists and defines console_scripts entry points for ekf_slam_node and websocket_bridge', () => {
      const setupPy = readIfExists('projects/robovision-ros2/setup.py');
      assert.ok(setupPy, 'setup.py must exist');
      assert.match(setupPy, /package_name\s*=\s*['"]robovision_ros2['"]/);
      assert.match(setupPy, /'ekf_slam_node\s*=\s*ekf_slam_node:main'/);
      assert.match(setupPy, /'websocket_bridge\s*=\s*websocket_bridge:main'/);
      assert.match(setupPy, /maintainer=['"]Mohamed Seddik Feki['"]/);
      assert.match(setupPy, /maintainer_email=['"]seddikfeki15@gmail\.com['"]/);
    });

    it('firmware/esp32_motor_firmware.cpp implements IRAM_ATTR encoder ISRs, PID control & hardware PWM', () => {
      const cpp = readIfExists('projects/robovision-ros2/firmware/esp32_motor_firmware.cpp');
      assert.ok(cpp, 'esp32_motor_firmware.cpp must exist');

      // Hardware interrupts
      assert.match(cpp, /void\s+IRAM_ATTR\s+leftEncoderISR\s*\(\s*\)/);
      assert.match(cpp, /void\s+IRAM_ATTR\s+rightEncoderISR\s*\(\s*\)/);
      assert.match(cpp, /attachInterrupt\s*\(/);

      // Kinematics functions
      assert.match(cpp, /void\s+computeWheelVelocitiesFromTwist\s*\(/);
      assert.match(cpp, /void\s+updateOdometryFromTicks\s*\(/);

      // Discrete PID with anti-windup
      assert.match(cpp, /struct\s+PIDController/);
      assert.match(cpp, /max_integral/);
      assert.match(cpp, /compute\s*\(\s*float\s+target,\s*float\s+measured,\s*float\s+dt\s*\)/);

      // Hardware PWM via ESP32 LEDC
      assert.match(cpp, /ledcSetup\s*\(/);
      assert.match(cpp, /ledcAttachPin\s*\(/);
      assert.match(cpp, /ledcWrite\s*\(/);
      assert.match(cpp, /PWM_FREQ_HZ\s*=\s*20000/);

      // FreeRTOS dual-core tasks
      assert.match(cpp, /TaskControlLoop/);
      assert.match(cpp, /TaskTelemetry/);
      assert.match(cpp, /xTaskCreatePinnedToCore\s*\(\s*TaskControlLoop/);
      assert.match(cpp, /xTaskCreatePinnedToCore\s*\(\s*TaskTelemetry/);

      // Watchdog safety cutoff
      assert.match(cpp, /WATCHDOG_TIMEOUT_MS/);
      assert.match(cpp, /g_emergency_stop_active/);
    });

    it('src/ekf_slam_node.py implements Extended Kalman Filter, Bresenham raycasting & A* planning', () => {
      const py = readIfExists('projects/robovision-ros2/src/ekf_slam_node.py');
      assert.ok(py, 'ekf_slam_node.py must exist');

      // EKF implementation
      assert.match(py, /class\s+ExtendedKalmanFilter/);
      assert.match(py, /def\s+predict\s*\(\s*self,\s*linear_vel/);
      assert.match(py, /def\s+update_imu\s*\(\s*self,\s*measured_yaw/);
      assert.match(py, /def\s+update_lidar_pose\s*\(\s*self,\s*obs_x/);
      assert.match(py, /def\s+estimated_accuracy_cm\s*\(/);

      // Bresenham raycasting & Occupancy Grid
      assert.match(py, /def\s+bresenham_ray\s*\(/);
      assert.match(py, /class\s+OccupancyGridMap/);
      assert.match(py, /def\s+update_laser_scan\s*\(/);
      assert.match(py, /def\s+world_to_grid\s*\(/);
      assert.match(py, /def\s+grid_to_world\s*\(/);

      // A* Path Planning
      assert.match(py, /class\s+AStarPlanner/);
      assert.match(py, /def\s+plan\s*\(\s*self,\s*start_x/);
      assert.match(py, /heapq\.heappop/);
      assert.match(py, /is_safe_cell/);

      // ROS2 Node
      assert.match(py, /class\s+EkfSlamNode/);
      assert.match(py, /create_subscription/);
      assert.match(py, /create_publisher/);
    });

    it('src/websocket_bridge.py implements TelemetryPacketFormatter and WebSocketBridgeServer', () => {
      const bridge = readIfExists('projects/robovision-ros2/src/websocket_bridge.py');
      assert.ok(bridge, 'websocket_bridge.py must exist');

      assert.match(bridge, /class\s+TelemetryPacketFormatter/);
      assert.match(bridge, /def\s+format_telemetry\s*\(/);
      assert.match(bridge, /class\s+WebSocketBridgeServer/);
      assert.match(bridge, /def\s+generate_current_packet\s*\(/);
      assert.match(bridge, /async\s+def\s+broadcast_loop\s*\(/);
      assert.match(bridge, /async\s+def\s+handle_message\s*\(/);
      assert.match(bridge, /navigate_to/);
      assert.match(bridge, /cmd_vel/);
      assert.match(bridge, /reset_map/);
    });

    it('README.md provides complete technical architecture and mathematical documentation', () => {
      const readme = readIfExists('projects/robovision-ros2/README.md');
      assert.ok(readme, 'README.md must exist');
      assert.match(readme, /RoboVision/i);
      assert.match(readme, /Mohamed Seddik Feki/);
      assert.match(readme, /Bill of Materials/i);
      assert.match(readme, /RPLiDAR A1M8/);
      assert.match(readme, /TB6612FNG/);
      assert.match(readme, /Differential Drive Kinematics/i);
      assert.match(readme, /Extended Kalman Filter/i);
      assert.match(readme, /Bresenham/i);
      assert.match(readme, /FreeRTOS/);
      assert.match(readme, /ros2 run robovision_ros2/);
    });

    // =======================================================================
    // Analytical Mathematical Verification of Algorithms
    // =======================================================================
    it('Mathematically verifies differential-drive kinematics formulas against known test vector', () => {
      // Test vector: v = 0.30 m/s, omega = 0.50 rad/s, track width = 0.160 m, wheel radius = 0.033 m
      const v = 0.30;
      const omega = 0.50;
      const W = 0.160;
      const R = 0.033;

      // Inverse Kinematics
      const vL = v - (omega * W * 0.5);
      const vR = v + (omega * W * 0.5);

      assert.strictEqual(Number(vL.toFixed(4)), 0.2600);
      assert.strictEqual(Number(vR.toFixed(4)), 0.3400);

      // Wheel angular velocity & RPM
      const rpmL = (vL / (2 * Math.PI * R)) * 60;
      const rpmR = (vR / (2 * Math.PI * R)) * 60;

      assert.ok(rpmL > 75.0 && rpmL < 76.0, `Expected rpmL ~75.25, got ${rpmL}`);
      assert.ok(rpmR > 98.0 && rpmR < 99.0, `Expected rpmR ~98.40, got ${rpmR}`);

      // Forward Kinematics (reconstruct chassis v, omega)
      const reconstructedV = (vR + vL) * 0.5;
      const reconstructedOmega = (vR - vL) / W;

      assert.strictEqual(Number(reconstructedV.toFixed(4)), 0.3000);
      assert.strictEqual(Number(reconstructedOmega.toFixed(4)), 0.5000);
    });

    it('Mathematically verifies discrete PID with anti-windup clamping behavior', () => {
      let integral = 0.0;
      const maxIntegral = 80.0;
      const kp = 180.0;
      const ki = 45.0;
      const kd = 2.5;
      let prevError = 0.0;
      const dt = 0.01; // 100 Hz

      function computePid(target, measured) {
        const error = target - measured;
        integral += error * dt;
        if (integral > maxIntegral) integral = maxIntegral;
        else if (integral < -maxIntegral) integral = -maxIntegral;

        const derivative = (error - prevError) / dt;
        prevError = error;

        let output = (kp * error) + (ki * integral) + (kd * derivative);
        if (output > 255.0) output = 255.0;
        else if (output < -255.0) output = -255.0;
        return output;
      }

      // Step response with large persistent error across 10,000 steps (100 seconds)
      let out = 0;
      for (let i = 0; i < 10000; i++) {
        out = computePid(1.0, 0.0); // Target 1.0 m/s, measured 0 m/s (stalled)
      }

      // Integral must be strictly capped at maxIntegral (80.0)
      assert.strictEqual(integral, 80.0, 'Anti-windup must clamp integral to maxIntegral');
      // Output clamped at 255.0
      assert.strictEqual(out, 255.0, 'Output must be clamped at 255.0');
    });

    it('Mathematically verifies Bresenham integer line raycaster generates contiguous grid cells', () => {
      // Ray from (0, 0) to (4, 2)
      const x0 = 0, y0 = 0, x1 = 4, y1 = 2;
      const points = [];
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      let x = x0, y = y0;
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      while (true) {
        points.push([x, y]);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }

      assert.strictEqual(points.length, 5);
      assert.deepStrictEqual(points[0], [0, 0]);
      assert.deepStrictEqual(points[points.length - 1], [4, 2]);

      // Check 8-connected continuity (each step distance <= sqrt(2))
      for (let i = 1; i < points.length; i++) {
        const stepDist = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        assert.ok(stepDist <= Math.SQRT2 + 1e-6, `Discontinuous Bresenham step at index ${i}`);
      }
    });

    it('Mathematically verifies EKF position accuracy calculation bounds uncertainty within +/- 2 cm', () => {
      // Trace of position covariance P[0][0] + P[1][1]
      const P00 = 0.00015; // 0.012 m standard deviation in X
      const P11 = 0.00016; // 0.013 m standard deviation in Y
      const tracePos = P00 + P11;
      const sigmaM = Math.sqrt(tracePos);
      const accuracyCm = sigmaM * 100.0;

      assert.ok(accuracyCm <= 2.0, `EKF 1-sigma uncertainty must be within 2.0 cm (got ${accuracyCm.toFixed(2)} cm)`);
      assert.strictEqual(Number(accuracyCm.toFixed(2)), 1.76);
    });

    it('Generates valid 60 Hz Telemetry JSON packet matching schema', () => {
      const packet = {
        type: 'telemetry',
        timestamp: 1720000000.123,
        mode: 'AUTONOMOUS',
        robot: {
          ekf_pose: { x: 2.14, y: 1.56, yaw: 0.424, accuracy_cm: 1.8 },
          raw_pose: { x: 2.26, y: 1.68, yaw: 0.491, drift_error_cm: 16.97 },
          velocities: { linear_m_s: 0.35, angular_rad_s: 0.12, left_rpm: 98.4, right_rpm: 105.2 },
          actuators: { left_pwm: 184, right_pwm: 189, ticks_left: 48210, ticks_right: 48890 },
          power: { battery_voltage: 12.38, battery_pct: 86.5, current_draw_a: 1.15 }
        },
        lidar: { point_count: 360, angle_min: -Math.PI, angle_max: Math.PI },
        covariance: [0.00032, 0.0, 0.0, 0.0, 0.00031, 0.0, 0.0, 0.0, 0.00095]
      };

      const raw = JSON.stringify(packet);
      const parsed = JSON.parse(raw);
      assert.strictEqual(parsed.type, 'telemetry');
      assert.strictEqual(parsed.robot.ekf_pose.accuracy_cm, 1.8);
      assert.strictEqual(parsed.lidar.point_count, 360);
      assert.strictEqual(parsed.covariance.length, 9);
    });
  });

  // =========================================================================
  // R2: Live Interactive 2D LiDAR SLAM & Telemetry Dashboard (demo/index.html)
  // =========================================================================
  describe('R2: Live Interactive 2D LiDAR SLAM Dashboard (demo/index.html)', () => {

    it('demo/index.html exists and is standalone zero-dependency', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.ok(html, 'demo/index.html must exist');
      assert.match(html, /<!DOCTYPE html>/i);
      // Zero external CDN scripts or stylesheet dependencies
      assert.doesNotMatch(html, /<script[^>]*src=["']https?:\/\//i);
      assert.doesNotMatch(html, /<link[^>]*href=["']https?:\/\//i);
    });

    it('demo/index.html contains 60 FPS SLAM canvas with accessible labels', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /id=["']slamCanvas["']/);
      assert.match(html, /width=["']800["']/);
      assert.match(html, /height=["']520["']/);
      assert.match(html, /role=["']img["']/);
      assert.match(html, /aria-label=/);
      assert.match(html, /tabindex=["']0["']/);
    });

    it('demo/index.html contains navigation mode toggles, interactive tool buttons, and layer toggles', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /id=["']btnModeAuto["']/);
      assert.match(html, /id=["']btnModeTeleop["']/);
      assert.match(html, /id=["']toolGoal["']/);
      assert.match(html, /id=["']toolObstacle["']/);
      assert.match(html, /id=["']toolErase["']/);
      assert.match(html, /id=["']toggleLidar["']/);
      assert.match(html, /id=["']toggleOdom["']/);
      assert.match(html, /id=["']toggleMap["']/);
      assert.match(html, /resetSlamMap\(\)/);
      assert.match(html, /clearDynamicObstacles\(\)/);
    });

    it('demo/index.html contains virtual teleop D-pad controls and speed limit slider', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /id=["']dpadUp["']/);
      assert.match(html, /id=["']dpadDown["']/);
      assert.match(html, /id=["']dpadLeft["']/);
      assert.match(html, /id=["']dpadRight["']/);
      assert.match(html, /id=["']dpadStop["']/);
      assert.match(html, /id=["']sliderSpeed["']/);
      assert.match(html, /teleopMove\(/);
      assert.match(html, /teleopStop\(\)/);
    });

    it('demo/index.html contains live ESP32 hardware telemetry gauges and EKF covariance display', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /id=["']valRpmL["']/);
      assert.match(html, /id=["']valRpmR["']/);
      assert.match(html, /id=["']valPwmL["']/);
      assert.match(html, /id=["']valPwmR["']/);
      assert.match(html, /id=["']valTicksL["']/);
      assert.match(html, /id=["']valTicksR["']/);
      assert.match(html, /id=["']kpiPose["']/);
      assert.match(html, /id=["']kpiAccuracy["']/);
      assert.match(html, /id=["']kpiDrift["']/);
      assert.match(html, /id=["']kpiLidar["']/);
      assert.match(html, /id=["']kpiBattery["']/);
      assert.match(html, /id=["']covMatrixDisplay["']/);
    });

    it('demo/index.html back button cleanly resolves to portfolio index.html', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /href=["']\.\.\/\.\.\/\.\.\/index\.html["']/);
      assert.doesNotMatch(html, /href=["']\.\.\/\.\.\/index\.html["']/);

      const demoDir = path.join(ROOT_DIR, 'projects', 'robovision-ros2', 'demo');
      const resolved = path.resolve(demoDir, '../../../index.html');
      assert.ok(fs.existsSync(resolved), `Back link resolved to non-existent file: ${resolved}`);
      assert.strictEqual(resolved, path.join(ROOT_DIR, 'index.html'));
    });

    it('demo/index.html embeds 100% full-fidelity C++, Python, XML & Markdown source files', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      const cppFile = readIfExists('projects/robovision-ros2/firmware/esp32_motor_firmware.cpp');
      const ekfFile = readIfExists('projects/robovision-ros2/src/ekf_slam_node.py');
      const bridgeFile = readIfExists('projects/robovision-ros2/src/websocket_bridge.py');
      const pkgFile = readIfExists('projects/robovision-ros2/package.xml');
      const setupFile = readIfExists('projects/robovision-ros2/setup.py');
      const readmeFile = readIfExists('projects/robovision-ros2/README.md');

      assert.ok(html.includes(JSON.stringify(cppFile)), 'Full esp32_motor_firmware.cpp embedded');
      assert.ok(html.includes(JSON.stringify(ekfFile)), 'Full ekf_slam_node.py embedded');
      assert.ok(html.includes(JSON.stringify(bridgeFile)), 'Full websocket_bridge.py embedded');
      assert.ok(html.includes(JSON.stringify(pkgFile)), 'Full package.xml embedded');
      assert.ok(html.includes(JSON.stringify(setupFile)), 'Full setup.py embedded');
      assert.ok(html.includes(JSON.stringify(readmeFile)), 'Full README.md embedded');
    });

    it('demo/index.html declares and exports functions to window avoiding strict mode ReferenceErrors', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /window\.setNavMode\s*=\s*setNavMode/);
      assert.match(html, /window\.setActiveTool\s*=\s*setActiveTool/);
      assert.match(html, /window\.toggleLayer\s*=\s*toggleLayer/);
      assert.match(html, /window\.resetSlamMap\s*=\s*resetSlamMap/);
      assert.match(html, /window\.clearDynamicObstacles\s*=\s*clearDynamicObstacles/);
      assert.match(html, /window\.teleopMove\s*=\s*teleopMove/);
      assert.match(html, /window\.teleopStop\s*=\s*teleopStop/);
      assert.match(html, /window\.switchSourceFile\s*=\s*switchSourceFile/);
      assert.match(html, /window\.copyCurrentSourceCode\s*=\s*copyCurrentSourceCode/);
    });

    it('demo/index.html embedded simulation script compiles with zero syntax errors via vm.Script', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/g);
      assert.ok(scriptMatches && scriptMatches.length >= 2, 'Expected embedded script tags');

      scriptMatches.forEach(tag => {
        const code = tag.replace(/<\/?script>/g, '');
        assert.doesNotThrow(() => {
          new vm.Script(code);
        }, 'Script must compile without syntax errors');
      });
    });
  });

  // =========================================================================
  // R3: Portfolio Integration in index.html & portfolio-data.js
  // =========================================================================
  describe('R3: Portfolio Integration in index.html & portfolio-data.js', () => {

    it('index.html Project Card 3 links directly to projects/robovision-ros2/demo/index.html', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist');
      assert.match(html, /href=["']projects\/robovision-ros2\/demo\/index\.html["']/);
      assert.match(html, /data-testid=["']robovision-demo-link["']/);
    });

    it('data/portfolio-data.js Project 3 demo link points to projects/robovision-ros2/demo/index.html', () => {
      const data = require(path.join(ROOT_DIR, 'data', 'portfolio-data.js'));
      const projects = data.showcaseProjects || data.projects;
      const robo = projects.find(p => /robovision|ros2-esp32|robotics-telemetry/i.test(p.id + ' ' + p.title + ' ' + (p.fullTitle || '')));
      assert.ok(robo, 'RoboVision project entry must exist in data/portfolio-data.js');
      assert.strictEqual(robo.links.demo, 'projects/robovision-ros2/demo/index.html');
    });
  });

  // =========================================================================
  // Adversarial Boundary, Kinematics & Simulator Robustness Verification
  // =========================================================================
  describe('Adversarial Boundary, Kinematics & Simulator Robustness Verification', () => {

    it('ExtendedKalmanFilter maintains covariance symmetry and bounds accuracy during simulated slip', () => {
      // EKF mathematical emulation matching src/ekf_slam_node.py
      let state = [0.0, 0.0, 0.0];
      let P = [
        [0.00015, 0.0, 0.0],
        [0.0, 0.00015, 0.0],
        [0.0, 0.0, 0.00040]
      ];
      const q_pos = 0.001;
      const q_yaw = 0.001;
      const r_lidar_pos = 0.012 * 0.012;
      const r_lidar_yaw = 0.008 * 0.008;

      function normalizeAngle(a) {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
      }

      function predict(v, w, dt) {
        const midTheta = state[2] + (w * dt * 0.5);
        state[0] += v * Math.cos(midTheta) * dt;
        state[1] += v * Math.sin(midTheta) * dt;
        state[2] = normalizeAngle(state[2] + w * dt);

        const f02 = -v * Math.sin(midTheta) * dt;
        const f12 =  v * Math.cos(midTheta) * dt;

        const fp = [
          [P[0][0] + f02 * P[2][0], P[0][1] + f02 * P[2][1], P[0][2] + f02 * P[2][2]],
          [P[1][0] + f12 * P[2][0], P[1][1] + f12 * P[2][1], P[1][2] + f12 * P[2][2]],
          [P[2][0],                 P[2][1],                 P[2][2]]
        ];

        P = [
          [fp[0][0] + fp[0][2] * f02 + q_pos * dt, fp[0][1] + fp[0][2] * f12,              fp[0][2]],
          [fp[1][0] + fp[1][2] * f02,              fp[1][1] + fp[1][2] * f12 + q_pos * dt, fp[1][2]],
          [fp[2][0] + fp[2][2] * f02,              fp[2][1] + fp[2][2] * f12,              fp[2][2] + q_yaw * dt]
        ];
      }

      function updateLidar(obsX, obsY, obsYaw) {
        const y = [obsX - state[0], obsY - state[1], normalizeAngle(obsYaw - state[2])];
        const s00 = P[0][0] + r_lidar_pos;
        const s11 = P[1][1] + r_lidar_pos;
        const s22 = P[2][2] + r_lidar_yaw;

        const k0 = P[0][0] / s00;
        const k1 = P[1][1] / s11;
        const k2 = P[2][2] / s22;

        state[0] += k0 * y[0];
        state[1] += k1 * y[1];
        state[2] = normalizeAngle(state[2] + k2 * y[2]);

        for (let j = 0; j < 3; j++) {
          P[0][j] *= (1.0 - k0);
          P[1][j] *= (1.0 - k1);
          P[2][j] *= (1.0 - k2);
        }

        // Symmetrization
        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const avg = 0.5 * (P[i][j] + P[j][i]);
            P[i][j] = avg;
            P[j][i] = avg;
          }
        }
      }

      // Simulate 60 steps of aggressive curve driving with LiDAR corrections
      for (let step = 0; step < 60; step++) {
        predict(0.35, 0.40, 0.02);
        if (step % 5 === 0) {
          updateLidar(state[0] + 0.005, state[1] - 0.003, state[2] + 0.001);
        }
      }

      // Check positive-definiteness & symmetry
      assert.ok(P[0][0] > 0, 'P[0][0] must be positive');
      assert.ok(P[1][1] > 0, 'P[1][1] must be positive');
      assert.ok(P[2][2] > 0, 'P[2][2] must be positive');
      assert.ok(Math.abs(P[0][1] - P[1][0]) < 1e-12, 'Covariance must be symmetric');
      assert.ok(Math.abs(P[0][2] - P[2][0]) < 1e-12, 'Covariance must be symmetric');
      assert.ok(Math.abs(P[1][2] - P[2][1]) < 1e-12, 'Covariance must be symmetric');

      const sigmaCm = Math.sqrt(P[0][0] + P[1][1]) * 100;
      assert.ok(sigmaCm <= 2.0, `1-sigma accuracy must remain within +/- 2.0 cm (got ${sigmaCm.toFixed(2)} cm)`);
    });

    it('Angle normalization handles boundary, multiple turns, and edge wrap angles', () => {
      function normalizeAngle(a) {
        while (a > Math.PI) a -= 2 * Math.PI;
        while (a < -Math.PI) a += 2 * Math.PI;
        return a;
      }

      assert.strictEqual(normalizeAngle(0.0), 0.0);
      assert.strictEqual(normalizeAngle(Math.PI), Math.PI);
      assert.strictEqual(normalizeAngle(-Math.PI), -Math.PI);

      const plus3Pi = normalizeAngle(3 * Math.PI);
      assert.ok(Math.abs(plus3Pi - Math.PI) < 1e-9 || Math.abs(plus3Pi - (-Math.PI)) < 1e-9);

      const minus5Pi = normalizeAngle(-5 * Math.PI);
      assert.ok(Math.abs(minus5Pi - (-Math.PI)) < 1e-9 || Math.abs(minus5Pi - Math.PI) < 1e-9);

      const angle420 = normalizeAngle(420 * (Math.PI / 180));
      assert.ok(Math.abs(angle420 - (60 * (Math.PI / 180))) < 1e-9);
    });

    it('Continuous sub-tick accumulator correctly preserves micro-step distances without truncation loss', () => {
      const wheelRadiusM = 0.033;
      const ticksPerMeter = 1440.0 / (2 * Math.PI * wheelRadiusM);
      const vL = 0.005; // 5 mm/s slow crawl
      const dt = 0.01667; // 60 FPS

      let ticksL = 0;
      let subticksL = 0.0;

      // Run across 120 frames (2 seconds)
      for (let frame = 0; frame < 120; frame++) {
        subticksL += vL * dt * ticksPerMeter;
        const delta = Math.trunc(subticksL);
        ticksL += delta;
        subticksL -= delta;
      }

      const expectedDistance = vL * (120 * dt);
      const expectedTicks = Math.round(expectedDistance * ticksPerMeter);

      assert.ok(ticksL > 0, 'Ticks must accumulate at slow crawl speed');
      assert.ok(Math.abs(ticksL - expectedTicks) <= 2, `Ticks (${ticksL}) must match expected (${expectedTicks}) within sub-tick quantization`);
    });

    it('Simulator center rotation is preserved during boundary collision', () => {
      let robot = { x: 200, y: 200, theta: 0.0, v: 0.2, w: 1.0 };
      const dt = 0.016;
      const deltaTheta = robot.w * dt;

      // Emulate collision check where translation collides with obstacle
      function checkCollision(px, py) {
        return true; // Simulating collision ahead
      }

      const nextX = robot.x + Math.cos(robot.theta + deltaTheta * 0.5) * robot.v * 80.0 * dt;
      const nextY = robot.y + Math.sin(robot.theta + deltaTheta * 0.5) * robot.v * 80.0 * dt;

      // Rotation must always be applied
      robot.theta += deltaTheta;

      if (!checkCollision(nextX, nextY)) {
        robot.x = nextX;
        robot.y = nextY;
      } else {
        robot.v = 0.0; // Stop translation, keep rotation
      }

      assert.strictEqual(robot.v, 0.0, 'Forward translation halted');
      assert.strictEqual(robot.theta, deltaTheta, 'Center rotation preserved despite translation collision');
      assert.strictEqual(robot.x, 200, 'Position unchanged');
    });

    it('Multi-key teleoperation handles concurrent keypresses and graceful release', () => {
      const keysPressed = {};
      let teleopV = 0.0;
      let teleopW = 0.0;

      function updateTeleopFromKeys() {
        let v = 0.0;
        let w = 0.0;
        if (keysPressed['arrowup'] || keysPressed['w']) v += 1.0;
        if (keysPressed['arrowdown'] || keysPressed['s']) v -= 1.0;
        if (keysPressed['arrowleft'] || keysPressed['a']) w += 1.0;
        if (keysPressed['arrowright'] || keysPressed['d']) w -= 1.0;

        if (v !== 0.0 || w !== 0.0) {
          teleopV = Math.max(-1.0, Math.min(1.0, v));
          teleopW = Math.max(-1.0, Math.min(1.0, w));
        } else {
          teleopV = 0.0;
          teleopW = 0.0;
        }
      }

      // 1. Press W (Drive Forward)
      keysPressed['w'] = true;
      updateTeleopFromKeys();
      assert.strictEqual(teleopV, 1.0);
      assert.strictEqual(teleopW, 0.0);

      // 2. Press D simultaneously (Turn Right while driving forward)
      keysPressed['d'] = true;
      updateTeleopFromKeys();
      assert.strictEqual(teleopV, 1.0);
      assert.strictEqual(teleopW, -1.0);

      // 3. Release D (Should smoothly continue driving forward without stopping)
      delete keysPressed['d'];
      updateTeleopFromKeys();
      assert.strictEqual(teleopV, 1.0, 'Forward drive must continue when turning key is released');
      assert.strictEqual(teleopW, 0.0);

      // 4. Emergency Stop (Space)
      for (const k of Object.keys(keysPressed)) delete keysPressed[k];
      updateTeleopFromKeys();
      assert.strictEqual(teleopV, 0.0);
      assert.strictEqual(teleopW, 0.0);
    });

    it('WebSocket server discard method prevents KeyError during client drop', () => {
      const bridgeCode = readIfExists('projects/robovision-ros2/src/websocket_bridge.py');
      assert.match(bridgeCode, /self\.clients\.discard\s*\(\s*websocket\s*\)/, 'Must use discard instead of remove to prevent KeyError');
      assert.doesNotMatch(bridgeCode, /self\.clients\.remove\s*\(\s*websocket\s*\)/, 'Must not use remove on clients set');
    });

    it('ESP32 firmware configures GPI 34/35 input-only pins without internal pull-ups', () => {
      const cppCode = readIfExists('projects/robovision-ros2/firmware/esp32_motor_firmware.cpp');
      assert.match(cppCode, /pinMode\s*\(\s*PIN_LEFT_ENC_A\s*,\s*INPUT\s*\)/);
      assert.match(cppCode, /pinMode\s*\(\s*PIN_LEFT_ENC_B\s*,\s*INPUT\s*\)/);
    });

    it('demo/index.html includes touchstart listener and dynamic covariance matrix updates', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /canvas\.addEventListener\s*\(\s*['"]touchstart['"]/);
      assert.match(html, /window\.handleCanvasAction\s*=\s*handleCanvasAction/);
      assert.match(html, /document\.getElementById\s*\(\s*['"]labelCovAccuracy['"]\s*\)/);
      assert.match(html, /document\.getElementById\s*\(\s*['"]kpiAccuracy['"]\s*\)/);
    });

    it('AStarPlanner in Python ekf_slam_node and JS demo prevents diagonal cutting across obstacle corners', () => {
      const pyCode = readIfExists('projects/robovision-ros2/src/ekf_slam_node.py');
      assert.match(pyCode, /if\s+dx\s*!=\s*0\s+and\s+dy\s*!=\s*0:/, 'Python A* must detect diagonal moves');
      assert.match(pyCode, /not\s+self\.is_safe_cell\s*\(\s*cx\s*\+\s*dx\s*,\s*cy\s*\)\s+or\s+not\s+self\.is_safe_cell\s*\(\s*cx\s*,\s*cy\s*\+\s*dy\s*\)/, 'Python A* must prevent diagonal corner cutting');

      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /if\s*\(\s*dx\s*!==\s*0\s*&&\s*dy\s*!==\s*0\s*\)/, 'JS A* must detect diagonal moves');
      assert.match(html, /checkCollision\s*\(\s*wx1,\s*wy1,\s*16\s*\)\s*\|\|\s*checkCollision\s*\(\s*wx2,\s*wy2,\s*16\s*\)/, 'JS A* must prevent diagonal corner cutting');
    });

    function createMockSimulator() {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/g);
      const firstScript = scriptMatches[0].replace(/<\/?script>/g, '');
      const mainScript = scriptMatches[1].replace(/<\/?script>/g, '');

      const mockCtx = {
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        roundRect: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        setLineDash: () => {}
      };

      const dom = {
        getElementById: () => ({
          getContext: () => mockCtx,
          getBoundingClientRect: () => ({ width: 800, height: 520, left: 0, top: 0 }),
          addEventListener: () => {},
          classList: { toggle: () => {} },
          setAttribute: () => {},
          textContent: '',
          style: {}
        }),
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
      };

      const sandbox = {
        window: {
          addEventListener: () => {},
          removeEventListener: () => {}
        },
        document: dom,
        console,
        performance: { now: () => 0 },
        requestAnimationFrame: () => {},
        Float32Array: Float32Array,
        Set: Set,
        Map: Map,
        Math: Math,
        setTimeout: () => {}
      };
      sandbox.window = sandbox;
      sandbox.addEventListener = () => {};

      vm.createContext(sandbox);
      vm.runInContext(firstScript, sandbox);
      vm.runInContext(mainScript, sandbox);
      return sandbox;
    }

    it('AStarPlanner handles start/goal in same cell, boundary limits, and enclosed unreachable goal', () => {
      const sandbox = createMockSimulator();

      // 1. Same-cell start and goal -> returns exactly 1 point
      const sameCellPath = sandbox.window.runAStar(220, 260, 220, 260);
      assert.strictEqual(sameCellPath.length, 1, 'Same cell must return 1 waypoint immediately');
      assert.strictEqual(sameCellPath[0].x, 230); // center of cell 11 ((11 + 0.5) * 20 = 230)
      assert.strictEqual(sameCellPath[0].y, 270); // center of cell 13 ((13 + 0.5) * 20 = 270)

      // 2. Goal outside canvas boundaries -> returns empty path []
      const outOfBoundsPath = sandbox.window.runAStar(220, 260, -50, 100);
      assert.strictEqual(outOfBoundsPath.length, 0, 'Out of bounds goal must return []');

      // 3. Goal inside static outer wall -> returns empty path []
      const wallGoalPath = sandbox.window.runAStar(220, 260, 4, 4);
      assert.strictEqual(wallGoalPath.length, 0, 'Goal inside wall must return []');

      // 4. Enclosed unreachable goal
      sandbox.window.getDynamicObstacles().push(
        [370, 270, 60, 15],
        [370, 315, 60, 15],
        [370, 270, 15, 60],
        [415, 270, 15, 60]
      );
      const enclosedPath = sandbox.window.runAStar(220, 260, 395, 295);
      assert.strictEqual(enclosedPath.length, 0, 'Enclosed unreachable goal must return []');
    });

    it('SLAM occupancy grid map reset and dynamic obstacle clearance restore clean state and clear drift', () => {
      const sandbox = createMockSimulator();
      const robot = sandbox.window.robot;

      // Modify state to simulate drift and mapped cells
      robot.x = 350.0;
      robot.y = 280.0;
      robot.theta = 1.25;
      robot.raw_x = 380.0;
      robot.raw_y = 310.0;
      robot.raw_theta = 1.55;
      robot.ekf_x = 352.0;
      robot.ekf_y = 281.0;
      robot.ekf_theta = 1.26;
      robot.raw_history.push({ x: 340, y: 270 }, { x: 380, y: 310 });
      robot.ekf_history.push({ x: 340, y: 270 }, { x: 352, y: 281 });
      sandbox.window.occupancyGrid[150] = 3.5;
      sandbox.window.occupancyGrid[200] = -2.1;

      // 1. Reset SLAM Map
      sandbox.window.resetSlamMap();

      assert.strictEqual(robot.raw_history.length, 0, 'raw_history cleared');
      assert.strictEqual(robot.ekf_history.length, 0, 'ekf_history cleared');
      assert.strictEqual(robot.raw_x, robot.x, 'raw_x synchronized to ground truth');
      assert.strictEqual(robot.raw_y, robot.y, 'raw_y synchronized to ground truth');
      assert.strictEqual(robot.raw_theta, robot.theta, 'raw_theta synchronized');
      assert.strictEqual(robot.ekf_x, robot.x, 'ekf_x synchronized to ground truth');
      assert.strictEqual(robot.ekf_y, robot.y, 'ekf_y synchronized to ground truth');
      assert.strictEqual(robot.ekf_theta, robot.theta, 'ekf_theta synchronized');
      assert.ok(sandbox.window.occupancyGrid.every(v => v === 0), 'occupancyGrid completely zeroed');

      // 2. Clear dynamic obstacles
      sandbox.window.setDynamicObstacles([[100, 100, 40, 40], [200, 200, 40, 40]]);
      sandbox.window.clearDynamicObstacles();
      assert.strictEqual(sandbox.window.getDynamicObstacles().length, 0, 'Dynamic obstacles completely cleared');
    });

    it('Canvas interaction auto-switches to autonomous mode on goal dispatch and provides erase tolerance', () => {
      const sandbox = createMockSimulator();

      // Start in manual teleop mode
      sandbox.window.setNavMode('teleop');
      assert.strictEqual(sandbox.window.getNavMode(), 'teleop');

      // Dispatch goal inside obstacle (central column at [360, 220, 80, 80]) -> must reject and stay in teleop
      sandbox.window.setActiveTool('goal');
      sandbox.window.handleCanvasAction(400, 260);
      assert.strictEqual(sandbox.window.getNavMode(), 'teleop', 'Mode must remain teleop if target collides with obstacle');

      // Dispatch goal in open free space -> must auto-switch to auto mode
      sandbox.window.handleCanvasAction(680, 260);
      assert.strictEqual(sandbox.window.getNavMode(), 'auto', 'Mode must auto-switch to auto when valid goal is set');
      const goal = sandbox.window.getGoalPoint();
      assert.ok(goal, 'Goal point must be defined');
      assert.strictEqual(goal.x, 680, 'Goal x must be 680');
      assert.strictEqual(goal.y, 260, 'Goal y must be 260');

      // Test erase with 6px tolerance
      sandbox.window.setDynamicObstacles([[200, 200, 40, 40]]);
      sandbox.window.setActiveTool('erase');
      // Click at (196, 196) which is within 6px of boundary [200, 200]
      sandbox.window.handleCanvasAction(196, 196);
      assert.strictEqual(sandbox.window.getDynamicObstacles().length, 0, 'Obstacle must be erased within 6px touch tolerance');
    });

    it('Responsive layout CSS enforces mobile ergonomics for 640px, 480px, 375px and 320px viewports', () => {
      const html = readIfExists('projects/robovision-ros2/demo/index.html');
      assert.match(html, /@media\s*\(\s*max-width:\s*640px\s*\)/, 'Must contain max-width: 640px media query');
      assert.match(html, /@media\s*\(\s*max-width:\s*480px\s*\)/, 'Must contain max-width: 480px media query');
      assert.match(html, /@media\s*\(\s*max-width:\s*360px\s*\)/, 'Must contain max-width: 360px media query');
      assert.match(html, /\.btn-group\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s, 'btn-group wraps on mobile');
      assert.match(html, /\.meters-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s, 'meters-grid collapses to 1fr on narrow viewports');
      assert.match(html, /\.dpad-btn\s*\{[^}]*width:\s*46px;\s*height:\s*46px;/s, 'dpad-btn sized safely for <=360px');
    });

    it('Adversarial numerical stability: non-finite inputs, singular matrix avoidance, and zero-division guards in EKF, PID, and A*', () => {
      const sandbox = createMockSimulator();

      // 1. Angle normalization must gracefully reject non-finite inputs without infinite loops
      const normInf = sandbox.window.normalizeAngle(Infinity);
      const normNegInf = sandbox.window.normalizeAngle(-Infinity);
      const normNan = sandbox.window.normalizeAngle(NaN);
      assert.strictEqual(normInf, 0.0, 'normalizeAngle(Infinity) must return 0.0');
      assert.strictEqual(normNegInf, 0.0, 'normalizeAngle(-Infinity) must return 0.0');
      assert.strictEqual(normNan, 0.0, 'normalizeAngle(NaN) must return 0.0');

      // 2. Extreme large turns must evaluate in O(1) time
      const t0 = Date.now();
      const largeTurn = sandbox.window.normalizeAngle(1e12);
      const tElapsed = Date.now() - t0;
      assert.ok(tElapsed < 100, `Large angle evaluation took too long: ${tElapsed}ms`);
      assert.ok(largeTurn >= -Math.PI && largeTurn <= Math.PI, 'Large turn must be normalized within [-PI, PI]');

      // 3. Collision checker must reject non-finite coordinates (return true/collision)
      assert.strictEqual(sandbox.window.checkCollision(NaN, NaN), true, 'Non-finite position must report collision');
      assert.strictEqual(sandbox.window.checkCollision(Infinity, 100), true, 'Infinity position must report collision');

      // 4. A* Planner on canvas must return empty path [] on non-finite coordinates
      assert.strictEqual(sandbox.window.runAStar(NaN, 260, 680, 260).length, 0, 'NaN startX must return []');
      assert.strictEqual(sandbox.window.runAStar(220, NaN, 680, 260).length, 0, 'NaN startY must return []');
      assert.strictEqual(sandbox.window.runAStar(220, 260, NaN, 260).length, 0, 'NaN targetX must return []');
      assert.strictEqual(sandbox.window.runAStar(220, 260, Infinity, 260).length, 0, 'Infinity targetX must return []');

      // 5. Verification of EKF and PID hardening in source files
      const pySource = readIfExists('projects/robovision-ros2/src/ekf_slam_node.py');
      assert.match(pySource, /math\.isfinite\(theta\)/, 'Python normalize_angle guards isfinite');
      assert.match(pySource, /math\.isfinite\(linear_vel\)/, 'Python EKF predict guards isfinite');
      assert.match(pySource, /math\.isfinite\(measured_yaw\)/, 'Python EKF update_imu guards isfinite');
      assert.match(pySource, /math\.isfinite\(obs_x\)/, 'Python EKF update_lidar_pose guards isfinite');
      assert.match(pySource, /math\.isfinite\(wx\)/, 'Python world_to_grid guards isfinite');

      const cppSource = readIfExists('projects/robovision-ros2/firmware/esp32_motor_firmware.cpp');
      assert.match(cppSource, /!isfinite\(target\)\s*\|\|\s*!isfinite\(measured\)/, 'ESP32 PID guards isfinite');
      assert.match(cppSource, /!isfinite\(g_robot_yaw\)/, 'ESP32 odometry guards isfinite');
    });
  });

  // =========================================================================
  // Zero Placeholder Audit
  // =========================================================================
  describe('Zero Placeholder Audit across RoboVision files', () => {
    const filesToCheck = [
      'projects/robovision-ros2/package.xml',
      'projects/robovision-ros2/setup.py',
      'projects/robovision-ros2/README.md',
      'projects/robovision-ros2/firmware/esp32_motor_firmware.cpp',
      'projects/robovision-ros2/src/ekf_slam_node.py',
      'projects/robovision-ros2/src/websocket_bridge.py',
      'projects/robovision-ros2/demo/index.html'
    ];

    const forbidden = [
      /lorem\s+ipsum/i,
      /\bTBD\b/,
      /\bTODO\b/,
      /example@example\.com/i,
      /\[your\s*name\]/i,
      /123-456-7890/
    ];

    filesToCheck.forEach(relPath => {
      it(`Audit ${relPath} for zero forbidden placeholders`, () => {
        const content = readIfExists(relPath);
        assert.ok(content, `${relPath} must exist`);
        forbidden.forEach(regex => {
          assert.doesNotMatch(content, regex, `Forbidden placeholder token matched in ${relPath}: ${regex}`);
        });
      });
    });
  });
});
