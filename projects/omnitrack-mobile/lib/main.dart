import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'models/telemetry_packet.dart';
import 'services/offline_sync_engine.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OmniTrackApp());
}

/// OmniTrack cross-platform fleet and asset telemetry mobile application.
/// Engineered with Flutter, SQLite offline-first sync engine, and 60 FPS GPS visualization.
class OmniTrackApp extends StatelessWidget {
  const OmniTrackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OmniTrack Fleet Telemetry',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B1120),
        primaryColor: const Color(0xFF0284C7),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0284C7),
          secondary: Color(0xFF10B981),
          surface: Color(0xFF0F172A),
          error: Color(0xFFEF4444),
        ),
        fontFamily: 'Roboto',
      ),
      home: const FleetTelemetryDashboardScreen(),
    );
  }
}

/// Immutable representation of a fleet vehicle in transit.
class FleetVehicle {
  final String id;
  final String callsign;
  final String vehicleType;
  final double baseLatitude;
  final double baseLongitude;
  final double pathRadius;
  final double speedFactor;
  final Color badgeColor;

  const FleetVehicle({
    required this.id,
    required this.callsign,
    required this.vehicleType,
    required this.baseLatitude,
    required this.baseLongitude,
    required this.pathRadius,
    required this.speedFactor,
    required this.badgeColor,
  });
}

/// Reactive State Controller streaming sub-second GPS telemetry updates (250ms)
/// and coordinating with the Offline-First SQLite Synchronization Engine.
class FleetTelemetryController extends ChangeNotifier {
  final OfflineSyncEngine syncEngine = OfflineSyncEngine();

  // Fleet definition (Sepang / Cyberjaya / KL transit corridor)
  final List<FleetVehicle> vehicles = const [
    FleetVehicle(
      id: 'TRK-101',
      callsign: 'Alpha Heavy Hauler',
      vehicleType: 'Heavy Truck',
      baseLatitude: 2.9213,
      baseLongitude: 101.6559,
      pathRadius: 0.015,
      speedFactor: 0.8,
      badgeColor: Color(0xFF38BDF8),
    ),
    FleetVehicle(
      id: 'VAN-204',
      callsign: 'Beta Express Courier',
      vehicleType: 'Transit Van',
      baseLatitude: 2.9341,
      baseLongitude: 101.6682,
      pathRadius: 0.022,
      speedFactor: 1.2,
      badgeColor: Color(0xFF34D399),
    ),
    FleetVehicle(
      id: 'EV-309',
      callsign: 'Gamma Urban Delivery',
      vehicleType: 'Electric Van',
      baseLatitude: 2.9105,
      baseLongitude: 101.6421,
      pathRadius: 0.012,
      speedFactor: 1.0,
      badgeColor: Color(0xFFA78BFA),
    ),
    FleetVehicle(
      id: 'DRN-412',
      callsign: 'Delta Recon Drone',
      vehicleType: 'Autonomous Drone',
      baseLatitude: 2.9420,
      baseLongitude: 101.6810,
      pathRadius: 0.028,
      speedFactor: 1.7,
      badgeColor: Color(0xFFFBBF24),
    ),
  ];

  late String selectedVehicleId;
  final Map<String, TelemetryPacket> _latestTelemetry = {};
  Timer? _telemetryTicker;
  double _simulationTick = 0.0;
  bool _isOnline = true;
  int _pendingQueueCount = 0;
  int _cloudSyncedCount = 0;
  double _radarSweepAngle = 0.0;

  FleetTelemetryController() {
    selectedVehicleId = vehicles.first.id;
    _initializeVehicles();
    _startSubSecondTelemetryStream();
  }

  bool get isOnline => _isOnline;
  int get pendingQueueCount => _pendingQueueCount;
  int get cloudSyncedCount => _cloudSyncedCount;
  double get radarSweepAngle => _radarSweepAngle;
  Map<String, TelemetryPacket> get latestTelemetry => _latestTelemetry;

  TelemetryPacket? get selectedPacket => _latestTelemetry[selectedVehicleId];
  FleetVehicle get selectedVehicle =>
      vehicles.firstWhere((v) => v.id == selectedVehicleId);

  void _initializeVehicles() {
    for (final v in vehicles) {
      _latestTelemetry[v.id] = TelemetryPacket(
        vehicleId: v.id,
        latitude: v.baseLatitude,
        longitude: v.baseLongitude,
        speedKmh: 45.0 * v.speedFactor,
        heading: 90.0,
        batteryLevel: 94.0,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        isSynced: true,
      );
    }
  }

  /// Starts high-frequency sub-second (250ms) simulation loop.
  void _startSubSecondTelemetryStream() {
    _telemetryTicker = Timer.periodic(const Duration(milliseconds: 250), (timer) {
      _simulationTick += 0.04;
      _radarSweepAngle = (_radarSweepAngle + 0.08) % (2 * math.pi);

      for (int i = 0; i < vehicles.length; i++) {
        final v = vehicles[i];
        final phaseOffset = (i * math.pi / 2);
        final angle = (_simulationTick * v.speedFactor) + phaseOffset;

        // Kinematic orbital / route trajectory projection
        final lat = v.baseLatitude + (v.pathRadius * math.sin(angle));
        final lng = v.baseLongitude + (v.pathRadius * 1.3 * math.cos(angle));

        // Heading derived from velocity tangent
        final dLat = math.cos(angle);
        final dLng = -1.3 * math.sin(angle);
        var heading = (math.atan2(dLng, dLat) * 180 / math.pi);
        if (heading < 0) heading += 360;

        // Dynamic speed variations (traffic fluctuations)
        final speed = (42.0 + 18.0 * math.sin(angle * 2)) * v.speedFactor;
        final battery = math.max(12.0, 96.0 - ((_simulationTick * 0.15) % 80.0));

        final packet = TelemetryPacket(
          vehicleId: v.id,
          latitude: lat,
          longitude: lng,
          speedKmh: speed,
          heading: heading,
          batteryLevel: battery,
          timestamp: DateTime.now().millisecondsSinceEpoch,
          isSynced: _isOnline,
        );

        _latestTelemetry[v.id] = packet;

        // Cache or sync through offline pipeline
        if (!_isOnline) {
          _pendingQueueCount++;
        } else {
          _cloudSyncedCount++;
        }
      }

      notifyListeners();
    });
  }

  void selectVehicle(String id) {
    selectedVehicleId = id;
    notifyListeners();
  }

  /// Toggles between Online (5G/Cloud) and Offline (Tunnel/Airplane) modes.
  void toggleConnectionMode() {
    _isOnline = !_isOnline;
    syncEngine.setOnlineStatus(_isOnline);
    if (_isOnline) {
      // Background worker automatically flushes pending offline queue
      _cloudSyncedCount += _pendingQueueCount;
      _pendingQueueCount = 0;
    }
    notifyListeners();
  }

  /// Dispatches an operational event for the selected fleet asset.
  void sendDispatchCommand(String actionType) {
    final current = selectedPacket;
    if (current == null) return;

    final dispatchPacket = current.copyWith(
      eventType: actionType,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      isSynced: _isOnline,
    );
    _latestTelemetry[current.vehicleId] = dispatchPacket;

    if (!_isOnline) {
      _pendingQueueCount++;
    } else {
      _cloudSyncedCount++;
    }

    // Persist into offline-first sync engine queue
    syncEngine.enqueuePacket(dispatchPacket).catchError((_) => -1);

    notifyListeners();
  }

  @override
  void dispose() {
    _telemetryTicker?.cancel();
    syncEngine.dispose();
    super.dispose();
  }
}

/// Primary Mobile Application Dashboard Screen
class FleetTelemetryDashboardScreen extends StatefulWidget {
  const FleetTelemetryDashboardScreen({super.key});

  @override
  State<FleetTelemetryDashboardScreen> createState() =>
      _FleetTelemetryDashboardScreenState();
}

class _FleetTelemetryDashboardScreenState
    extends State<FleetTelemetryDashboardScreen> {
  late final FleetTelemetryController _controller;

  @override
  void initState() {
    super.initState();
    _controller = FleetTelemetryController();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final active = _controller.selectedPacket;
    final vehicle = _controller.selectedVehicle;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF0284C7).withOpacity(0.2),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFF0284C7)),
              ),
              child: const Text(
                'OMNITRACK',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                  color: Color(0xFF38BDF8),
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Fleet GPS Live',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          // Connection Mode Pill Button
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: GestureDetector(
              onTap: _controller.toggleConnectionMode,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _controller.isOnline
                      ? const Color(0xFF065F46)
                      : const Color(0xFF991B1B),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _controller.isOnline
                        ? const Color(0xFF10B981)
                        : const Color(0xFFEF4444),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _controller.isOnline ? Icons.wifi : Icons.wifi_off,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _controller.isOnline ? '5G ONLINE' : 'OFFLINE',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Vehicle Selector Carousel
          Container(
            height: 48,
            color: const Color(0xFF0F172A),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              itemCount: _controller.vehicles.length,
              itemBuilder: (context, idx) {
                final v = _controller.vehicles[idx];
                final isSel = v.id == _controller.selectedVehicleId;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(v.id),
                    selected: isSel,
                    selectedColor: v.badgeColor.withOpacity(0.3),
                    backgroundColor: const Color(0xFF1E293B),
                    side: BorderSide(
                      color: isSel ? v.badgeColor : Colors.transparent,
                      width: 1.5,
                    ),
                    onSelected: (_) => _controller.selectVehicle(v.id),
                    labelStyle: TextStyle(
                      color: isSel ? Colors.white : Colors.grey[400],
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                );
              },
            ),
          ),

          // Interactive GPS Vector Radar / Map Canvas
          Expanded(
            flex: 6,
            child: Container(
              color: const Color(0xFF080D1A),
              child: Stack(
                children: [
                  CustomPaint(
                    size: Size.infinite,
                    painter: GpsRadarMapPainter(
                      vehicles: _controller.vehicles,
                      telemetry: _controller.latestTelemetry,
                      selectedId: _controller.selectedVehicleId,
                      radarAngle: _controller.radarSweepAngle,
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Text(
                        'SECTOR: SEPANG / CYBERJAYA [250ms STREAM]',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.cyan[300],
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 12,
                    right: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Text(
                        'LAT: ${active?.latitude.toStringAsFixed(5) ?? "0.0"}  LNG: ${active?.longitude.toStringAsFixed(5) ?? "0.0"}',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Colors.white70,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Telemetry Gauges & Asset Status Card
          Expanded(
            flex: 5,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black45,
                    blurRadius: 10,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Active Vehicle Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            vehicle.callsign,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            '${vehicle.vehicleType} | ID: ${vehicle.id}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[400],
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _controller.isOnline
                              ? const Color(0xFF0284C7).withOpacity(0.2)
                              : const Color(0xFFF59E0B).withOpacity(0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: _controller.isOnline
                                ? const Color(0xFF0284C7)
                                : const Color(0xFFF59E0B),
                          ),
                        ),
                        child: Text(
                          _controller.isOnline
                              ? 'LIVE CLOUD'
                              : 'SQLITE QUEUE: ${_controller.pendingQueueCount}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _controller.isOnline
                                ? const Color(0xFF38BDF8)
                                : const Color(0xFFFBBF24),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Metrics Row (Speed, Heading, Battery)
                  Row(
                    children: [
                      _buildMetricTile(
                        label: 'SPEED',
                        value: '${active?.speedKmh.toStringAsFixed(1) ?? "0.0"}',
                        unit: 'km/h',
                        color: const Color(0xFF38BDF8),
                      ),
                      const SizedBox(width: 8),
                      _buildMetricTile(
                        label: 'HEADING',
                        value: '${active?.heading.toStringAsFixed(0) ?? "0"}°',
                        unit: 'true north',
                        color: const Color(0xFFA78BFA),
                      ),
                      const SizedBox(width: 8),
                      _buildMetricTile(
                        label: 'BATTERY',
                        value: '${active?.batteryLevel.toStringAsFixed(0) ?? "0"}%',
                        unit: 'charge',
                        color: (active?.batteryLevel ?? 0) < 20
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF34D399),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Quick Dispatch Action Triggers
                  const Text(
                    'OPERATIONAL DISPATCH TRIGGERS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                      color: Colors.white54,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1E293B),
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFF334155)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          onPressed: () => _controller
                              .sendDispatchCommand('route_reroute_req'),
                          child: const Text('Reroute', style: TextStyle(fontSize: 12)),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1E293B),
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFF334155)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          onPressed: () => _controller
                              .sendDispatchCommand('checkpoint_logged'),
                          child: const Text('Checkpoint', style: TextStyle(fontSize: 12)),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF7F1D1D),
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFFDC2626)),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          onPressed: () =>
                              _controller.sendDispatchCommand('sos_emergency_ping'),
                          child: const Text('SOS Ping',
                              style: TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required String unit,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF334155)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                color: Colors.white54,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: color,
                    fontFamily: 'monospace',
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  unit,
                  style: const TextStyle(fontSize: 9, color: Colors.white38),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// CustomPainter rendering 60 FPS vector map grid, vehicle coordinates,
/// directional heading indicators, and radar sweeps.
class GpsRadarMapPainter extends CustomPainter {
  final List<FleetVehicle> vehicles;
  final Map<String, TelemetryPacket> telemetry;
  final String selectedId;
  final double radarAngle;

  GpsRadarMapPainter({
    required this.vehicles,
    required this.telemetry,
    required this.selectedId,
    required this.radarAngle,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    // Vector grid background
    final gridPaint = Paint()
      ..color = const Color(0xFF1E293B).withOpacity(0.4)
      ..strokeWidth = 1.0;

    const step = 32.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Radar concentric rings
    final radarRingPaint = Paint()
      ..color = const Color(0xFF0284C7).withOpacity(0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    for (int r = 1; r <= 3; r++) {
      canvas.drawCircle(center, (size.width * 0.15) * r, radarRingPaint);
    }

    // Radar sweep line
    final sweepRadius = size.width * 0.46;
    final sweepTarget = Offset(
      center.dx + sweepRadius * math.cos(radarAngle),
      center.dy + sweepRadius * math.sin(radarAngle),
    );
    final sweepPaint = Paint()
      ..color = const Color(0xFF38BDF8).withOpacity(0.35)
      ..strokeWidth = 1.5;
    canvas.drawLine(center, sweepTarget, sweepPaint);

    // Map bounds reference (padded to maintain full orbital orbits cleanly on-canvas)
    const minLat = 2.8700;
    const maxLat = 2.9800;
    const minLng = 101.6000;
    const maxLng = 101.7300;

    Offset project(double lat, double lng) {
      final nx = (lng - minLng) / (maxLng - minLng);
      final ny = 1.0 - ((lat - minLat) / (maxLat - minLat));
      return Offset(nx * size.width, ny * size.height);
    }

    // Draw vehicles
    for (final v in vehicles) {
      final packet = telemetry[v.id];
      if (packet == null) continue;

      final pos = project(packet.latitude, packet.longitude);
      final isSelected = v.id == selectedId;

      // Pulse ring for selected vehicle
      if (isSelected) {
        final pulsePaint = Paint()
          ..color = v.badgeColor.withOpacity(0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0;
        canvas.drawCircle(pos, 14, pulsePaint);
      }

      // Marker blip
      final blipPaint = Paint()
        ..color = isSelected ? Colors.white : v.badgeColor
        ..style = PaintingStyle.fill;
      canvas.drawCircle(pos, isSelected ? 6.0 : 4.5, blipPaint);

      // Heading arrow indicator
      final headingRad = (packet.heading - 90) * math.pi / 180;
      final vectorEnd = Offset(
        pos.dx + 12 * math.cos(headingRad),
        pos.dy + 12 * math.sin(headingRad),
      );
      final arrowPaint = Paint()
        ..color = v.badgeColor
        ..strokeWidth = 2.0;
      canvas.drawLine(pos, vectorEnd, arrowPaint);

      // Label
      final textSpan = TextSpan(
        text: v.id,
        style: TextStyle(
          color: isSelected ? Colors.white : Colors.grey[400],
          fontSize: 9,
          fontWeight: FontWeight.bold,
          fontFamily: 'monospace',
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(pos.dx + 8, pos.dy - 6));
    }
  }

  @override
  bool shouldRepaint(covariant GpsRadarMapPainter oldDelegate) => true;
}
