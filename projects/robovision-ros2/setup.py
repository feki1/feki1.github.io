from setuptools import setup, find_packages
import os
from glob import glob

package_name = 'robovision_ros2'

setup(
    name=package_name,
    version='1.0.0',
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name] if os.path.exists('resource/' + package_name) else []),
        ('share/' + package_name, ['package.xml']),
        (os.path.join('share', package_name, 'launch'), glob('launch/*.py')),
    ],
    install_requires=['setuptools', 'numpy', 'scipy', 'websockets'],
    zip_safe=True,
    maintainer='Mohamed Seddik Feki',
    maintainer_email='seddikfeki15@gmail.com',
    description='RoboVision: ROS2 & ESP32 Autonomous Mobile Robot with 2D LiDAR SLAM, EKF Sensor Fusion & Telemetry Dashboard',
    license='Apache-2.0',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'ekf_slam_node = ekf_slam_node:main',
            'websocket_bridge = websocket_bridge:main',
        ],
    },
)
