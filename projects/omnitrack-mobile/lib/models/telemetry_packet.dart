import 'dart:convert';

/// Represents an immutable high-frequency GPS telemetry and dispatch packet
/// captured by the OmniTrack mobile client.
///
/// Designed with dual serialization paths:
/// 1. SQLite tabular mapping for local offline durability (`toSqliteMap` / `fromSqliteMap`).
/// 2. Firebase Firestore document structure for cloud aggregation (`toFirestore` / `fromFirestore`).
class TelemetryPacket {
  /// Local SQLite database auto-incrementing row ID. Null when unsaved.
  final int? id;

  /// Unique fleet vehicle identifier (e.g., 'TRK-101', 'VAN-204', 'EV-309', 'DRN-412').
  final String vehicleId;

  /// Geographic latitude in decimal degrees (-90.0 to 90.0).
  final double latitude;

  /// Geographic longitude in decimal degrees (-180.0 to 180.0).
  final double longitude;

  /// Instantaneous ground speed in kilometers per hour (km/h).
  final double speedKmh;

  /// Compass heading in degrees (0.0 to 359.9, where 0.0 is True North).
  final double heading;

  /// Battery state of charge or vehicle fuel/power percentage (0.0 to 100.0).
  final double batteryLevel;

  /// Milliseconds since Unix epoch representing the exact hardware GPS fix timestamp.
  final int timestamp;

  /// Local synchronization state flag: true once successfully acknowledged by Firebase.
  final bool isSynced;

  /// Number of cloud transmission attempts executed during offline flush recovery.
  final int retryCount;

  /// Semantic packet classification: 'periodic_telemetry', 'dispatch_ack', 'sos_alert', 'geofence_cross'.
  final String eventType;

  /// Optional JSON-encoded auxiliary diagnostics (e.g., engine temperature, tire pressure).
  final String? payloadJson;

  const TelemetryPacket({
    this.id,
    required this.vehicleId,
    required this.latitude,
    required this.longitude,
    required this.speedKmh,
    required this.heading,
    required this.batteryLevel,
    required this.timestamp,
    this.isSynced = false,
    this.retryCount = 0,
    this.eventType = 'periodic_telemetry',
    this.payloadJson,
  });

  /// Factory constructor to instantiate a telemetry packet from current system sensors.
  factory TelemetryPacket.fromCurrentSensorFix({
    required String vehicleId,
    required double latitude,
    required double longitude,
    required double speedKmh,
    required double heading,
    required double batteryLevel,
    String eventType = 'periodic_telemetry',
    Map<String, dynamic>? auxiliaryData,
  }) {
    return TelemetryPacket(
      vehicleId: vehicleId,
      latitude: latitude,
      longitude: longitude,
      speedKmh: speedKmh,
      heading: heading,
      batteryLevel: batteryLevel,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      isSynced: false,
      retryCount: 0,
      eventType: eventType,
      payloadJson: auxiliaryData != null ? jsonEncode(auxiliaryData) : null,
    );
  }

  /// Creates a copy of this packet with specified fields substituted.
  TelemetryPacket copyWith({
    int? id,
    String? vehicleId,
    double? latitude,
    double? longitude,
    double? speedKmh,
    double? heading,
    double? batteryLevel,
    int? timestamp,
    bool? isSynced,
    int? retryCount,
    String? eventType,
    String? payloadJson,
  }) {
    return TelemetryPacket(
      id: id ?? this.id,
      vehicleId: vehicleId ?? this.vehicleId,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speedKmh: speedKmh ?? this.speedKmh,
      heading: heading ?? this.heading,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      timestamp: timestamp ?? this.timestamp,
      isSynced: isSynced ?? this.isSynced,
      retryCount: retryCount ?? this.retryCount,
      eventType: eventType ?? this.eventType,
      payloadJson: payloadJson ?? this.payloadJson,
    );
  }

  /// Serializes telemetry packet into an SQLite compatible map.
  /// SQLite does not have native boolean types, storing [isSynced] as 0 or 1.
  Map<String, dynamic> toSqliteMap() {
    final map = <String, dynamic>{
      'vehicle_id': vehicleId,
      'latitude': latitude,
      'longitude': longitude,
      'speed_kmh': speedKmh,
      'heading': heading,
      'battery_level': batteryLevel,
      'timestamp': timestamp,
      'is_synced': isSynced ? 1 : 0,
      'retry_count': retryCount,
      'event_type': eventType,
      'payload_json': payloadJson,
    };
    if (id != null) {
      map['id'] = id;
    }
    return map;
  }

  /// Deserializes a record retrieved from the local SQLite `telemetry_queue` table.
  factory TelemetryPacket.fromSqliteMap(Map<String, dynamic> map) {
    return TelemetryPacket(
      id: map['id'] as int?,
      vehicleId: map['vehicle_id'] as String,
      latitude: (map['latitude'] as num).toDouble(),
      longitude: (map['longitude'] as num).toDouble(),
      speedKmh: (map['speed_kmh'] as num).toDouble(),
      heading: (map['heading'] as num).toDouble(),
      batteryLevel: (map['battery_level'] as num).toDouble(),
      timestamp: map['timestamp'] as int,
      isSynced: (map['is_synced'] as int? ?? 0) == 1,
      retryCount: (map['retry_count'] as int? ?? 0),
      eventType: map['event_type'] as String? ?? 'periodic_telemetry',
      payloadJson: map['payload_json'] as String?,
    );
  }

  /// Serializes packet for transmission to Firebase Cloud Firestore collections.
  Map<String, dynamic> toFirestore() {
    return {
      'vehicleId': vehicleId,
      'latitude': latitude,
      'longitude': longitude,
      'speedKmh': speedKmh,
      'heading': heading,
      'batteryLevel': batteryLevel,
      'timestamp': timestamp,
      'isoTimestamp': DateTime.fromMillisecondsSinceEpoch(timestamp, isUtc: true).toIso8601String(),
      'isSynced': true,
      'eventType': eventType,
      'payload': payloadJson != null ? jsonDecode(payloadJson!) : null,
      'syncedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  /// Deserializes a document snapshot retrieved from Firebase Cloud Firestore.
  factory TelemetryPacket.fromFirestore(Map<String, dynamic> data, [String? docId]) {
    return TelemetryPacket(
      id: null,
      vehicleId: data['vehicleId'] as String? ?? 'UNKNOWN',
      latitude: (data['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (data['longitude'] as num?)?.toDouble() ?? 0.0,
      speedKmh: (data['speedKmh'] as num?)?.toDouble() ?? 0.0,
      heading: (data['heading'] as num?)?.toDouble() ?? 0.0,
      batteryLevel: (data['batteryLevel'] as num?)?.toDouble() ?? 0.0,
      timestamp: data['timestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      isSynced: true,
      retryCount: 0,
      eventType: data['eventType'] as String? ?? 'periodic_telemetry',
      payloadJson: data['payload'] != null ? jsonEncode(data['payload']) : null,
    );
  }

  /// Convenience getter for human-readable ISO 8601 UTC timestamp.
  String get isoString =>
      DateTime.fromMillisecondsSinceEpoch(timestamp, isUtc: true).toIso8601String();

  /// Speed converted to miles per hour for international dispatchers.
  double get speedMph => speedKmh * 0.621371;

  /// Checks if vehicle battery is below warning threshold (20%).
  bool get isBatteryCritical => batteryLevel < 20.0;

  @override
  String toString() {
    return 'TelemetryPacket(id: $id, vehicle: $vehicleId, lat: ${latitude.toStringAsFixed(4)}, '
        'lng: ${longitude.toStringAsFixed(4)}, speed: ${speedKmh.toStringAsFixed(1)} km/h, '
        'battery: ${batteryLevel.toStringAsFixed(0)}%, synced: $isSynced)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TelemetryPacket &&
        other.id == id &&
        other.vehicleId == vehicleId &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.speedKmh == speedKmh &&
        other.heading == heading &&
        other.batteryLevel == batteryLevel &&
        other.timestamp == timestamp &&
        other.isSynced == isSynced &&
        other.retryCount == retryCount &&
        other.eventType == eventType;
  }

  @override
  int get hashCode => Object.hash(
        id,
        vehicleId,
        latitude,
        longitude,
        speedKmh,
        heading,
        batteryLevel,
        timestamp,
        isSynced,
        retryCount,
        eventType,
      );
}
