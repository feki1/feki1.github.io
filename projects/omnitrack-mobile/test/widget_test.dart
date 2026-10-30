import 'package:flutter_test/flutter_test.dart';
import 'package:omnitrack_mobile/main.dart';
import 'package:omnitrack_mobile/models/telemetry_packet.dart';
import 'package:omnitrack_mobile/services/offline_sync_engine.dart';

void main() {
  group('TelemetryPacket Unit Tests', () {
    test('instantiates packet and verifies calculated getters', () {
      final packet = TelemetryPacket(
        id: 101,
        vehicleId: 'TRK-101',
        latitude: 2.9213,
        longitude: 101.6559,
        speedKmh: 80.0,
        heading: 90.0,
        batteryLevel: 15.0,
        timestamp: 1709000000000,
        isSynced: false,
      );

      expect(packet.id, 101);
      expect(packet.vehicleId, 'TRK-101');
      expect(packet.isBatteryCritical, isTrue);
      expect(packet.speedMph, closeTo(49.71, 0.05));
      expect(packet.isoString, contains('2024-'));
    });

    test('round-trips SQLite serialization faithfully', () {
      final packet = TelemetryPacket(
        id: 202,
        vehicleId: 'VAN-204',
        latitude: 2.9341,
        longitude: 101.6682,
        speedKmh: 55.0,
        heading: 180.0,
        batteryLevel: 85.0,
        timestamp: 1709000001000,
        isSynced: false,
        retryCount: 1,
        eventType: 'checkpoint_logged',
        payloadJson: '{"zone":"A"}',
      );

      final map = packet.toSqliteMap();
      expect(map['vehicle_id'], 'VAN-204');
      expect(map['is_synced'], 0);

      final restored = TelemetryPacket.fromSqliteMap(map);
      expect(restored.id, 202);
      expect(restored.vehicleId, 'VAN-204');
      expect(restored.isSynced, isFalse);
      expect(restored.eventType, 'checkpoint_logged');
      expect(restored.payloadJson, '{"zone":"A"}');
    });

    test('round-trips Firestore serialization faithfully', () {
      final packet = TelemetryPacket(
        vehicleId: 'EV-309',
        latitude: 2.9105,
        longitude: 101.6421,
        speedKmh: 40.0,
        heading: 270.0,
        batteryLevel: 92.0,
        timestamp: 1709000002000,
        isSynced: false,
        eventType: 'route_reroute_req',
        payloadJson: '{"speedLimit":50}',
      );

      final firestoreData = packet.toFirestore();
      expect(firestoreData['vehicleId'], 'EV-309');
      expect(firestoreData['isSynced'], isTrue);
      expect(firestoreData['payload']['speedLimit'], 50);

      final restored = TelemetryPacket.fromFirestore(firestoreData);
      expect(restored.vehicleId, 'EV-309');
      expect(restored.isSynced, isTrue);
      expect(restored.eventType, 'route_reroute_req');
    });

    test('verifies copyWith and equality behavior', () {
      final p1 = TelemetryPacket(
        id: 1,
        vehicleId: 'DRN-412',
        latitude: 2.9420,
        longitude: 101.6810,
        speedKmh: 65.0,
        heading: 315.0,
        batteryLevel: 75.0,
        timestamp: 1709000003000,
      );

      final p2 = p1.copyWith(isSynced: true);
      expect(p2.isSynced, isTrue);
      expect(p2.vehicleId, 'DRN-412');

      final p3 = p1.copyWith();
      expect(p1, equals(p3));
      expect(p1.hashCode, equals(p3.hashCode));
    });
  });

  group('SyncEngineState Tests', () {
    test('verifies immutable state copyWith updates', () {
      const state = SyncEngineState(
        isOnline: false,
        pendingCount: 5,
        syncedCount: 12,
        isFlushing: false,
      );

      final updated = state.copyWith(isOnline: true, pendingCount: 0, syncedCount: 17);
      expect(updated.isOnline, isTrue);
      expect(updated.pendingCount, 0);
      expect(updated.syncedCount, 17);
      expect(updated.isFlushing, isFalse);
    });
  });

  group('OmniTrack Flutter Widget Tests', () {
    testWidgets('renders OmniTrackApp mobile dashboard cleanly', (tester) async {
      await tester.pumpWidget(const OmniTrackApp());
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('OMNITRACK'), findsOneWidget);
      expect(find.text('Fleet GPS Live'), findsOneWidget);
      expect(find.text('TRK-101'), findsWidgets);
      expect(find.text('5G ONLINE'), findsOneWidget);
    });
  });
}
