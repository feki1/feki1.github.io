import '../projects/omnitrack-mobile/lib/models/telemetry_packet.dart';

void main() {
  print('Running TelemetryPacket unit tests...');

  // Test 1: Instantiation & getters
  final p1 = TelemetryPacket(
    id: 42,
    vehicleId: 'TRK-101',
    latitude: 2.9213,
    longitude: 101.6559,
    speedKmh: 75.5,
    heading: 180.0,
    batteryLevel: 15.0,
    timestamp: 1709000000000,
    isSynced: false,
    retryCount: 2,
    eventType: 'dispatch_ack',
    payloadJson: '{"door":"locked"}',
  );

  assert(p1.id == 42);
  assert(p1.vehicleId == 'TRK-101');
  assert(p1.isBatteryCritical == true, 'Battery 15% should be critical');
  assert((p1.speedMph - 46.9135).abs() < 0.01, 'Speed MPH conversion correct');
  assert(p1.isoString.startsWith('2024-'), 'ISO string generated');

  // Test 2: SQLite Round-trip
  final sqliteMap = p1.toSqliteMap();
  assert(sqliteMap['id'] == 42);
  assert(sqliteMap['is_synced'] == 0);
  assert(sqliteMap['vehicle_id'] == 'TRK-101');

  final p1FromSqlite = TelemetryPacket.fromSqliteMap(sqliteMap);
  assert(p1FromSqlite.id == p1.id);
  assert(p1FromSqlite.vehicleId == p1.vehicleId);
  assert(p1FromSqlite.latitude == p1.latitude);
  assert(p1FromSqlite.isSynced == false);
  assert(p1FromSqlite.retryCount == 2);
  assert(p1FromSqlite.payloadJson == '{"door":"locked"}');

  // Test 3: Firestore Round-trip
  final firestoreMap = p1.toFirestore();
  assert(firestoreMap['vehicleId'] == 'TRK-101');
  assert(firestoreMap['isSynced'] == true);
  assert(firestoreMap['payload']['door'] == 'locked');

  final p1FromFirestore = TelemetryPacket.fromFirestore(firestoreMap);
  assert(p1FromFirestore.vehicleId == 'TRK-101');
  assert(p1FromFirestore.latitude == p1.latitude);
  assert(p1FromFirestore.isSynced == true);

  // Test 4: copyWith
  final p2 = p1.copyWith(
    isSynced: true,
    batteryLevel: 90.0,
  );
  assert(p2.isSynced == true);
  assert(p2.batteryLevel == 90.0);
  assert(p2.vehicleId == 'TRK-101');
  assert(p2.isBatteryCritical == false);

  // Test 5: Equality & hashCode
  final p3 = p1.copyWith();
  assert(p1 == p3, 'Identical copy should be equal');
  assert(p1.hashCode == p3.hashCode, 'Hash codes should match');

  // Test 6: Factory fromCurrentSensorFix
  final pSensor = TelemetryPacket.fromCurrentSensorFix(
    vehicleId: 'VAN-204',
    latitude: 2.9341,
    longitude: 101.6682,
    speedKmh: 45.0,
    heading: 45.0,
    batteryLevel: 98.0,
    auxiliaryData: {'temperatureC': 24.5},
  );
  assert(pSensor.vehicleId == 'VAN-204');
  assert(pSensor.payloadJson!.contains('temperatureC'));

  print('All TelemetryPacket Dart unit tests passed cleanly!');
}
