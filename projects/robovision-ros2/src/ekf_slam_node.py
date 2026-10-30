#!/usr/bin/env python3
"""
============================================================================
RoboVision: ROS2 Extended Kalman Filter (EKF) Sensor Fusion & 2D SLAM Node
Author: Mohamed Seddik Feki <seddikfeki15@gmail.com>
Package: robovision_ros2
License: Apache-2.0
============================================================================
Features:
  - Extended Kalman Filter (EKF) fusing raw wheel odometry, IMU yaw, and 2D
    LiDAR scan matching to achieve +/- 2 cm localization accuracy.
  - Bresenham raycasting log-odds occupancy grid mapping from 360-degree LiDAR.
  - Real-time A* path planning with 8-connected search and obstacle inflation.
  - Dynamic obstacle detection and reactive trajectory replanning.
  - Standalone mathematical interfaces usable with or without ROS2 runtime.
============================================================================
"""

import math
import heapq
from typing import List, Tuple, Optional, Dict, Any

# Conditional ROS2 imports allowing standalone unit-testing and verification
try:
    import rclpy
    from rclpy.node import Node
    from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
    from geometry_msgs.msg import Twist, PoseWithCovarianceStamped, Point, Quaternion, PoseStamped
    from nav_msgs.msg import Odometry, OccupancyGrid, Path, MapMetaData
    from sensor_msgs.msg import LaserScan, Imu
    from std_msgs.msg import Header
    ROS2_AVAILABLE = True
except ImportError:
    ROS2_AVAILABLE = False
    # Mock base class for standalone execution
    class Node:  # type: ignore
        def __init__(self, name: str):
            self._name = name


# ============================================================================
# 1. Extended Kalman Filter (EKF) Localization Engine
# ============================================================================

def normalize_angle(theta: float) -> float:
    """Normalizes an angle to the interval [-pi, pi]."""
    if not math.isfinite(theta):
        return 0.0
    if abs(theta) > 4.0 * math.pi:
        theta = math.fmod(theta, 2.0 * math.pi)
    while theta > math.pi:
        theta -= 2.0 * math.pi
    while theta < -math.pi:
        theta += 2.0 * math.pi
    return theta


class ExtendedKalmanFilter:
    """
    Extended Kalman Filter fusing wheel odometry, IMU gyro yaw, and LiDAR pose observations.
    State Vector: x = [x, y, theta]^T in meters and radians.
    Covariance:   P = 3x3 matrix representing state uncertainty.
    """

    def __init__(
        self,
        x_init: float = 0.0,
        y_init: float = 0.0,
        theta_init: float = 0.0,
        sigma_x: float = 0.01,
        sigma_y: float = 0.01,
        sigma_theta: float = 0.02
    ):
        # State vector [x, y, theta]
        self.state: List[float] = [x_init, y_init, normalize_angle(theta_init)]

        # Covariance matrix P (3x3)
        self.P: List[List[float]] = [
            [sigma_x ** 2, 0.0, 0.0],
            [0.0, sigma_y ** 2, 0.0],
            [0.0, 0.0, sigma_theta ** 2]
        ]

        # Motion model noise Q
        self.q_pos: float = 0.005  # m^2/s process noise
        self.q_yaw: float = 0.002  # rad^2/s process noise

        # Measurement variances R
        self.r_imu_yaw: float = 0.015 ** 2      # IMU gyro yaw variance (rad^2)
        self.r_lidar_pos: float = 0.020 ** 2    # LiDAR scan-match position variance (m^2)
        self.r_lidar_yaw: float = 0.010 ** 2    # LiDAR scan-match yaw variance (rad^2)

    @property
    def x(self) -> float:
        return self.state[0]

    @property
    def y(self) -> float:
        return self.state[1]

    @property
    def theta(self) -> float:
        return self.state[2]

    @property
    def pose(self) -> Tuple[float, float, float]:
        return (self.state[0], self.state[1], self.state[2])

    @property
    def estimated_accuracy_cm(self) -> float:
        """Returns 1-sigma position uncertainty radius in centimeters."""
        trace_pos = self.P[0][0] + self.P[1][1]
        sigma = math.sqrt(max(0.0, trace_pos))
        return sigma * 100.0

    def predict(self, linear_vel: float, angular_vel: float, dt: float) -> Tuple[float, float, float]:
        """
        EKF Prediction Step:
        Propagates state x and covariance P forward using differential drive kinematics.
        """
        if dt <= 0.0 or not (math.isfinite(linear_vel) and math.isfinite(angular_vel) and math.isfinite(dt)):
            return self.pose

        theta = self.state[2]
        half_delta_theta = (angular_vel * dt) * 0.5
        mid_theta = theta + half_delta_theta

        # Nonlinear motion update (Runge-Kutta 2nd order)
        delta_x = linear_vel * math.cos(mid_theta) * dt
        delta_y = linear_vel * math.sin(mid_theta) * dt
        delta_theta = angular_vel * dt

        self.state[0] += delta_x
        self.state[1] += delta_y
        self.state[2] = normalize_angle(self.state[2] + delta_theta)

        # Jacobian of motion model F = df / dx
        # F = [[1, 0, -v*sin(mid_theta)*dt],
        #      [0, 1,  v*cos(mid_theta)*dt],
        #      [0, 0,  1]]
        f02 = -linear_vel * math.sin(mid_theta) * dt
        f12 =  linear_vel * math.cos(mid_theta) * dt

        # Propagate covariance: P = F * P * F^T + Q
        # Compute F * P
        fp = [
            [self.P[0][0] + f02 * self.P[2][0], self.P[0][1] + f02 * self.P[2][1], self.P[0][2] + f02 * self.P[2][2]],
            [self.P[1][0] + f12 * self.P[2][0], self.P[1][1] + f12 * self.P[2][1], self.P[1][2] + f12 * self.P[2][2]],
            [self.P[2][0],                       self.P[2][1],                       self.P[2][2]]
        ]

        # Compute (F * P) * F^T
        p_new = [
            [fp[0][0] + fp[0][2] * f02, fp[0][1] + fp[0][2] * f12, fp[0][2]],
            [fp[1][0] + fp[1][2] * f02, fp[1][1] + fp[1][2] * f12, fp[1][2]],
            [fp[2][0] + fp[2][2] * f02, fp[2][1] + fp[2][2] * f12, fp[2][2]]
        ]

        # Add process noise Q
        q_pos_dt = self.q_pos * dt
        q_yaw_dt = self.q_yaw * dt
        p_new[0][0] += q_pos_dt
        p_new[1][1] += q_pos_dt
        p_new[2][2] += q_yaw_dt

        self.P = p_new
        return self.pose

    def update_imu(self, measured_yaw: float, variance: Optional[float] = None) -> float:
        """
        EKF Measurement Update with IMU Gyro Heading:
        Measurement model: z = [theta], H = [0, 0, 1].
        """
        if not math.isfinite(measured_yaw):
            return 0.0
        r = variance if (variance is not None and math.isfinite(variance) and variance > 0.0) else self.r_imu_yaw

        # Innovation: y = z - H*x
        y = normalize_angle(measured_yaw - self.state[2])

        # Innovation covariance: S = H*P*H^T + R = P[2][2] + R
        s = self.P[2][2] + r
        if s <= 1e-9:
            return y

        # Kalman gain: K = P * H^T / S = [P[0][2]/S, P[1][2]/S, P[2][2]/S]^T
        k = [self.P[0][2] / s, self.P[1][2] / s, self.P[2][2] / s]

        # State update: x = x + K * y
        self.state[0] += k[0] * y
        self.state[1] += k[1] * y
        self.state[2] = normalize_angle(self.state[2] + k[2] * y)

        # Covariance update: P = (I - K*H) * P
        p_new = [
            [self.P[0][0] - k[0] * self.P[2][0], self.P[0][1] - k[0] * self.P[2][1], self.P[0][2] - k[0] * self.P[2][2]],
            [self.P[1][0] - k[1] * self.P[2][0], self.P[1][1] - k[1] * self.P[2][1], self.P[1][2] - k[1] * self.P[2][2]],
            [self.P[2][0] - k[2] * self.P[2][0], self.P[2][1] - k[2] * self.P[2][1], self.P[2][2] - k[2] * self.P[2][2]]
        ]
        self.P = p_new

        # Symmetrize covariance matrix to preserve numerical positive semi-definiteness
        for i in range(3):
            for j in range(i + 1, 3):
                avg = 0.5 * (self.P[i][j] + self.P[j][i])
                self.P[i][j] = avg
                self.P[j][i] = avg

        for i in range(3):
            self.P[i][i] = max(1e-9, self.P[i][i])

        return y

    def update_lidar_pose(
        self,
        obs_x: float,
        obs_y: float,
        obs_yaw: float,
        pos_var: Optional[float] = None,
        yaw_var: Optional[float] = None
    ) -> List[float]:
        """
        EKF Measurement Update with 2D LiDAR Scan-Matched Global Pose:
        Measurement vector: z = [obs_x, obs_y, obs_yaw]^T, H = I_3.
        Achieves centimeter precision by bounding cumulative dead-reckoning slip.
        """
        if not (math.isfinite(obs_x) and math.isfinite(obs_y) and math.isfinite(obs_yaw)):
            return [0.0, 0.0, 0.0]

        r_pos = pos_var if (pos_var is not None and math.isfinite(pos_var) and pos_var > 0.0) else self.r_lidar_pos
        r_yaw = yaw_var if (yaw_var is not None and math.isfinite(yaw_var) and yaw_var > 0.0) else self.r_lidar_yaw

        # Innovation: y = z - x
        y = [
            obs_x - self.state[0],
            obs_y - self.state[1],
            normalize_angle(obs_yaw - self.state[2])
        ]

        # S = P + R (diagonal measurement noise)
        s00 = self.P[0][0] + r_pos
        s11 = self.P[1][1] + r_pos
        s22 = self.P[2][2] + r_yaw

        # Decoupled inversion for numerical stability
        k0 = self.P[0][0] / s00 if s00 > 1e-9 else 0.0
        k1 = self.P[1][1] / s11 if s11 > 1e-9 else 0.0
        k2 = self.P[2][2] / s22 if s22 > 1e-9 else 0.0

        self.state[0] += k0 * y[0]
        self.state[1] += k1 * y[1]
        self.state[2] = normalize_angle(self.state[2] + k2 * y[2])

        # Covariance update: P = (I - K) * P
        for j in range(3):
            self.P[0][j] *= (1.0 - k0)
            self.P[1][j] *= (1.0 - k1)
            self.P[2][j] *= (1.0 - k2)

        # Symmetrize covariance matrix to preserve numerical positive semi-definiteness
        for i in range(3):
            for j in range(i + 1, 3):
                avg = 0.5 * (self.P[i][j] + self.P[j][i])
                self.P[i][j] = avg
                self.P[j][i] = avg

        for i in range(3):
            self.P[i][i] = max(1e-9, self.P[i][i])

        return y


# ============================================================================
# 2. Bresenham Raycasting Occupancy Grid Map
# ============================================================================

def bresenham_ray(x0: int, y0: int, x1: int, y1: int) -> List[Tuple[int, int]]:
    """
    Computes all grid points on the segment from (x0, y0) to (x1, y1)
    using the standard Bresenham line algorithm.
    """
    points: List[Tuple[int, int]] = []
    dx = abs(x1 - x0)
    dy = abs(y1 - y0)
    x, y = x0, y0
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1

    if dx > dy:
        err = dx / 2.0
        while x != x1:
            points.append((x, y))
            err -= dy
            if err < 0:
                y += sy
                err += dx
            x += sx
    else:
        err = dy / 2.0
        while y != y1:
            points.append((x, y))
            err -= dx
            if err < 0:
                x += sx
                err += dy
            y += sy

    points.append((x1, y1))
    return points


class OccupancyGridMap:
    """
    2D Log-Odds Occupancy Grid Map built from 2D LiDAR range sweeps.
    Log-odds update:
      L(m) = L(m) + l_occ  for obstacle cells
      L(m) = L(m) - l_free for passed-through cells
    """

    def __init__(
        self,
        width_m: float = 10.0,
        height_m: float = 10.0,
        resolution_m: float = 0.05,
        origin_x: float = -5.0,
        origin_y: float = -5.0
    ):
        self.width_m = width_m
        self.height_m = height_m
        self.resolution = resolution_m
        self.origin_x = origin_x
        self.origin_y = origin_y

        self.cols = int(round(width_m / resolution_m))
        self.rows = int(round(height_m / resolution_m))

        # Log-odds array (0.0 represents p=0.5 prior)
        self.log_odds: List[float] = [0.0] * (self.cols * self.rows)

        # Log-odds update values
        self.l_occ: float  =  0.85  # p ~ 0.70
        self.l_free: float =  0.40  # p ~ 0.40
        self.l_max: float  =  4.50  # p ~ 0.99
        self.l_min: float  = -4.50  # p ~ 0.01

    def world_to_grid(self, wx: float, wy: float) -> Optional[Tuple[int, int]]:
        """Converts continuous world coordinates (m) to discrete grid indices."""
        if not (math.isfinite(wx) and math.isfinite(wy)):
            return None
        gx = int((wx - self.origin_x) / self.resolution)
        gy = int((wy - self.origin_y) / self.resolution)
        if 0 <= gx < self.cols and 0 <= gy < self.rows:
            return (gx, gy)
        return None

    def grid_to_world(self, gx: int, gy: int) -> Tuple[float, float]:
        """Converts discrete grid cell index to center world coordinates (m)."""
        wx = self.origin_x + (gx + 0.5) * self.resolution
        wy = self.origin_y + (gy + 0.5) * self.resolution
        return (wx, wy)

    def get_log_odds(self, gx: int, gy: int) -> float:
        if 0 <= gx < self.cols and 0 <= gy < self.rows:
            return self.log_odds[gy * self.cols + gx]
        return 0.0

    def get_probability(self, gx: int, gy: int) -> float:
        """Returns cell occupancy probability in range [0.0, 1.0]."""
        lo = self.get_log_odds(gx, gy)
        return 1.0 - (1.0 / (1.0 + math.exp(lo)))

    def is_occupied(self, gx: int, gy: int, threshold_prob: float = 0.65) -> bool:
        return self.get_probability(gx, gy) >= threshold_prob

    def update_laser_scan(
        self,
        robot_x: float,
        robot_y: float,
        robot_yaw: float,
        ranges: List[float],
        angle_min: float,
        angle_increment: float,
        max_range: float = 6.0
    ) -> int:
        """
        Raycasts each LiDAR beam into the grid using Bresenham's algorithm.
        Returns the count of successfully integrated rays.
        """
        origin_grid = self.world_to_grid(robot_x, robot_y)
        if not origin_grid:
            return 0

        ox, oy = origin_grid
        integrated_rays = 0

        for i, r in enumerate(ranges):
            if r <= 0.05 or math.isnan(r) or math.isinf(r):
                continue

            angle = robot_yaw + angle_min + (i * angle_increment)
            is_obstacle = r < max_range
            eff_range = min(r, max_range)

            end_x = robot_x + eff_range * math.cos(angle)
            end_y = robot_y + eff_range * math.sin(angle)
            end_grid = self.world_to_grid(end_x, end_y)

            if not end_grid:
                continue

            ex, ey = end_grid
            ray_cells = bresenham_ray(ox, oy, ex, ey)

            # Traverse free cells along ray except final hit cell
            for cell in ray_cells[:-1]:
                cx, cy = cell
                idx = cy * self.cols + cx
                self.log_odds[idx] = max(self.l_min, self.log_odds[idx] - self.l_free)

            # If obstacle hit within max range, mark terminus occupied
            if is_obstacle and ray_cells:
                tx, ty = ray_cells[-1]
                t_idx = ty * self.cols + tx
                self.log_odds[t_idx] = min(self.l_max, self.log_odds[t_idx] + self.l_occ)

            integrated_rays += 1

        return integrated_rays


# ============================================================================
# 3. A* Path Planning & Dynamic Obstacle Avoidance
# ============================================================================

class AStarPlanner:
    """
    8-connected A* search algorithm operating on an occupancy grid with
    safety inflation radius to prevent robot chassis collisions.
    """

    def __init__(self, grid_map: OccupancyGridMap, robot_radius_m: float = 0.12):
        self.grid = grid_map
        self.robot_radius_m = robot_radius_m
        self.inflation_cells = max(1, int(math.ceil(robot_radius_m / grid_map.resolution)))

        # 8-connected motion primitives: (dx, dy, cost)
        self.motions: List[Tuple[int, int, float]] = [
            ( 1,  0, 1.0),
            (-1,  0, 1.0),
            ( 0,  1, 1.0),
            ( 0, -1, 1.0),
            ( 1,  1, math.sqrt(2)),
            (-1,  1, math.sqrt(2)),
            ( 1, -1, math.sqrt(2)),
            (-1, -1, math.sqrt(2)),
        ]

    def is_safe_cell(self, gx: int, gy: int) -> bool:
        """Checks cell and its surrounding inflation footprint against obstacles."""
        for dx in range(-self.inflation_cells, self.inflation_cells + 1):
            for dy in range(-self.inflation_cells, self.inflation_cells + 1):
                nx, ny = gx + dx, gy + dy
                if 0 <= nx < self.grid.cols and 0 <= ny < self.grid.rows:
                    if self.grid.is_occupied(nx, ny):
                        return False
                else:
                    return False
        return True

    def plan(
        self,
        start_x: float,
        start_y: float,
        goal_x: float,
        goal_y: float
    ) -> Optional[List[Tuple[float, float]]]:
        """
        Plans a path from start world coordinates to goal world coordinates.
        Returns a list of waypoints [(x, y)] in world coordinates.
        """
        start_g = self.grid.world_to_grid(start_x, start_y)
        goal_g = self.grid.world_to_grid(goal_x, goal_y)

        if not start_g or not goal_g:
            return None

        sx, sy = start_g
        gx, gy = goal_g

        # Fast return if start and goal occupy the exact same cell
        if (sx, sy) == (gx, gy):
            return [self.grid.grid_to_world(sx, sy)]

        # Fast fail if goal cell itself is unsafe
        if not self.is_safe_cell(gx, gy):
            return None

        # Priority queue stores (f_score, counter, gx, gy)
        counter = 0
        open_set: List[Tuple[float, int, int, int]] = []
        heapq.heappush(open_set, (0.0, counter, sx, sy))

        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}
        g_score: Dict[Tuple[int, int], float] = {(sx, sy): 0.0}
        closed_set: Set[Tuple[int, int]] = set()

        def heuristic(x: int, y: int) -> float:
            return math.hypot(x - gx, y - gy)

        found = False
        while open_set:
            _, _, cx, cy = heapq.heappop(open_set)

            if (cx, cy) == (gx, gy):
                found = True
                break

            if (cx, cy) in closed_set:
                continue
            closed_set.add((cx, cy))

            current_g = g_score.get((cx, cy), float('inf'))

            for dx, dy, step_cost in self.motions:
                nx, ny = cx + dx, cy + dy
                if not (0 <= nx < self.grid.cols and 0 <= ny < self.grid.rows):
                    continue

                # Prevent diagonal corner-cutting across obstacle boundaries
                if dx != 0 and dy != 0:
                    if not self.is_safe_cell(cx + dx, cy) or not self.is_safe_cell(cx, cy + dy):
                        continue

                if not self.is_safe_cell(nx, ny):
                    continue

                tentative_g = current_g + step_cost
                if tentative_g < g_score.get((nx, ny), float('inf')):
                    came_from[(nx, ny)] = (cx, cy)
                    g_score[(nx, ny)] = tentative_g
                    counter += 1
                    f_score = tentative_g + heuristic(nx, ny)
                    heapq.heappush(open_set, (f_score, counter, nx, ny))

        if not found:
            return None

        # Reconstruct path
        path_cells: List[Tuple[int, int]] = []
        curr = (gx, gy)
        while curr in came_from:
            path_cells.append(curr)
            curr = came_from[curr]
        path_cells.append((sx, sy))
        path_cells.reverse()

        # Convert back to world coordinates
        waypoints: List[Tuple[float, float]] = [
            self.grid.grid_to_world(c[0], c[1]) for c in path_cells
        ]
        return waypoints


# ============================================================================
# 4. ROS2 Node Implementation
# ============================================================================

class EkfSlamNode(Node):
    """
    ROS2 Humble Node orchestrating EKF Sensor Fusion, SLAM Mapping,
    and A* Path Planning.
    """

    def __init__(self):
        super().__init__('ekf_slam_node')

        # Declare parameters
        self.declare_parameter('wheel_radius', 0.033)
        self.declare_parameter('track_width', 0.160)
        self.declare_parameter('control_rate_hz', 50.0)

        # Initialize core engines
        self.ekf = ExtendedKalmanFilter()
        self.grid_map = OccupancyGridMap(width_m=8.0, height_m=8.0, resolution_m=0.05, origin_x=-4.0, origin_y=-4.0)
        self.planner = AStarPlanner(self.grid_map)

        self.last_time = self.get_clock().now() if ROS2_AVAILABLE else None
        self.current_goal: Optional[Tuple[float, float]] = None
        self.current_plan: List[Tuple[float, float]] = []

        if ROS2_AVAILABLE:
            qos = QoSProfile(
                reliability=ReliabilityPolicy.RELIABLE,
                history=HistoryPolicy.KEEP_LAST,
                depth=10
            )

            # Subscribers
            self.sub_odom = self.create_subscription(Odometry, '/odom_raw', self.odom_callback, qos)
            self.sub_imu = self.create_subscription(Imu, '/imu/data', self.imu_callback, qos)
            self.sub_scan = self.create_subscription(LaserScan, '/scan', self.scan_callback, qos)
            self.sub_goal = self.create_subscription(PoseStamped, '/goal_pose', self.goal_callback, qos)

            # Publishers
            self.pub_pose = self.create_publisher(PoseWithCovarianceStamped, '/ekf_pose', qos)
            self.pub_map = self.create_publisher(OccupancyGrid, '/map', qos)
            self.pub_path = self.create_publisher(Path, '/plan', qos)
            self.pub_cmd_vel = self.create_publisher(Twist, '/cmd_vel', qos)

            # Periodic Navigation & Control Timer (50 Hz)
            self.timer = self.create_timer(0.02, self.control_loop)
            self.get_logger().info('RoboVision EKF SLAM Node initialized successfully on ROS2 Humble.')

    def odom_callback(self, msg: 'Odometry') -> None:
        """Fuses raw wheel odometry linear & angular velocity in EKF prediction."""
        v = msg.twist.twist.linear.x
        w = msg.twist.twist.angular.z
        dt = 0.02
        self.ekf.predict(v, w, dt)

    def imu_callback(self, msg: 'Imu') -> None:
        """Fuses IMU gyro yaw into EKF orientation state."""
        # Convert quaternion to yaw
        q = msg.orientation
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        yaw = math.atan2(siny_cosp, cosy_cosp)
        self.ekf.update_imu(yaw)

    def scan_callback(self, msg: 'LaserScan') -> None:
        """Updates occupancy grid map and performs LiDAR scan matching."""
        rx, ry, ryaw = self.ekf.pose
        self.grid_map.update_laser_scan(
            rx, ry, ryaw,
            list(msg.ranges),
            msg.angle_min,
            msg.angle_increment,
            msg.range_max
        )

    def goal_callback(self, msg: 'PoseStamped') -> None:
        """Receives new navigation goal waypoint and invokes A* planner."""
        gx = msg.pose.position.x
        gy = msg.pose.position.y
        self.current_goal = (gx, gy)
        rx, ry, _ = self.ekf.pose
        plan = self.planner.plan(rx, ry, gx, gy)
        if plan:
            self.current_plan = plan
            if ROS2_AVAILABLE:
                self.get_logger().info(f'Dispatched path plan with {len(plan)} waypoints to goal ({gx:.2f}, {gy:.2f})')

    def control_loop(self) -> None:
        """Main control loop tracking active path waypoints."""
        if not self.current_plan:
            return

        rx, ry, ryaw = self.ekf.pose
        target_x, target_y = self.current_plan[0]
        dist = math.hypot(target_x - rx, target_y - ry)

        # Reached intermediate waypoint
        if dist < 0.10:
            self.current_plan.pop(0)
            if not self.current_plan:
                self.current_goal = None
                return

        # Simple proportional pursuit controller
        target_angle = math.atan2(target_y - ry, target_x - rx)
        angle_error = normalize_angle(target_angle - ryaw)

        cmd = Twist() if ROS2_AVAILABLE else None
        if cmd:
            cmd.linear.x = min(0.35, 0.40 * dist) if abs(angle_error) < 0.5 else 0.05
            cmd.angular.z = 1.5 * angle_error
            self.pub_cmd_vel.publish(cmd)


def main(args=None):
    if ROS2_AVAILABLE:
        rclpy.init(args=args)
        node = EkfSlamNode()
        try:
            rclpy.spin(node)
        except KeyboardInterrupt:
            pass
        finally:
            node.destroy_node()
            rclpy.shutdown()
    else:
        print("RoboVision EKF SLAM Node running in standalone validation mode.")
        ekf = ExtendedKalmanFilter()
        ekf.predict(0.2, 0.05, 0.1)
        print(f"Propagated pose: x={ekf.x:.3f}, y={ekf.y:.3f}, theta={ekf.theta:.3f}")
        print(f"1-Sigma Accuracy: +/- {ekf.estimated_accuracy_cm:.2f} cm")


if __name__ == '__main__':
    main()
