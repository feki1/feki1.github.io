# Project 1 Technical & Interview Guide: OmniTrack
**Full Title:** OmniTrack: Cross-Platform Fleet & Asset Telemetry Mobile App  
**Author:** Mohamed Seddik Feki  
**Tech Stack:** Flutter, Dart, React Native, Firebase Cloud Firestore, SQLite (`sqflite`), REST APIs  
**Project Folder:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\omnitrack-mobile\`  
**Live Interactive Simulator:** `c:\Users\fekis\OneDrive\Desktop\seddik\projects\omnitrack-mobile\demo\index.html`

---

## 1. The 30-Second Elevator Pitch (What to Say in Interviews)
> *"OmniTrack is a cross-platform iOS and Android fleet tracking mobile app I built with Flutter, Dart, and Firebase. It solves two major real-world logistics problems: first, it streams live GPS vehicle telemetry at sub-second intervals (every 250ms) onto a 60 FPS interactive radar map; second, it uses an offline-first local SQLite queue so that when trucks or delivery vehicles lose 4G/5G signal inside tunnels or rural areas, zero telemetry or dispatch packets are lost—everything buffers locally on disk and automatically flushes to Firebase Cloud Firestore in First-In-First-Out (FIFO) order the moment connectivity returns."*

---

## 2. Core Engineering Problems Solved

### Problem A: Network Dead Zones (Why Offline-First Matters)
* **The Challenge:** Standard mobile apps that call `POST /api/telemetry` or `firestore.collection().add()` directly will fail and drop data whenever a vehicle enters a tunnel, underground parking, or remote area.
* **Your Solution (`lib/services/offline_sync_engine.dart`):**
  1. **Write-Ahead Local Persistence:** Every GPS fix or emergency SOS dispatch event is written *first* into a local SQLite table (`telemetry_queue`) with `is_synced = 0`.
  2. **Composite B-Tree Indexing:** We created a composite SQLite index:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_telemetry_unsynced ON telemetry_queue (is_synced, id ASC);
     ```
     This ensures that even if 20,000 rows accumulate offline, querying the next batch of unsynced rows (`WHERE is_synced = 0 ORDER BY id ASC LIMIT 50`) runs in $O(\log N)$ time without blocking the Flutter UI thread.
  3. **FIFO Flush & Exponential Backoff:** When the network listener detects 5G/Wi-Fi restoration, `flushPendingQueue()` transmits unsynced rows in strict chronological order (`id ASC`), marks them `is_synced = 1`, and applies exponential backoff (`min(1000ms, 100ms * retryCount)`) if the connection is unstable.

### Problem B: SQLite vs. Cloud Firestore Type Mismatch
* **The Challenge:** SQLite does not support a native `BOOLEAN` column type (it stores integers `0` and `1` with `snake_case` columns), while Firebase Cloud Firestore expects native JSON booleans (`true`/`false`), `camelCase` keys, and UTC ISO-8601 timestamps.
* **Your Solution (`lib/models/telemetry_packet.dart`):**
  - Built an immutable `TelemetryPacket` data class with dual serialization adapters:
    - `toSqliteMap()` / `fromSqliteMap()` — converts `bool isSynced` $\leftrightarrow$ `int (0 | 1)`.
    - `toFirestore()` / `fromFirestore()` — converts epoch milliseconds $\leftrightarrow$ ISO-8601 UTC strings and decodes nested JSON diagnostic payloads.

### Problem C: Smooth 60 FPS Map Rendering Under 250ms Updates
* **The Challenge:** Updating 4+ moving vehicles 4 times per second (250ms) using standard widget rebuilds causes frame drops (jank) on mobile devices.
* **Your Solution (`lib/main.dart`):**
  - Used a reactive `ChangeNotifier` / `StreamController.broadcast()` architecture paired with a hardware-accelerated `CustomPainter` canvas so only the vector marker coordinates repaint on each 250ms tick.

---

## 3. Key Files in Your Repository
| File Path | What It Does |
|-----------|--------------|
| `projects/omnitrack-mobile/pubspec.yaml` | Flutter project configuration, dependencies (`sqflite`, `path`), and SDK constraints. |
| `projects/omnitrack-mobile/lib/models/telemetry_packet.dart` | Immutable data model with SQLite (`0`/`1`) and Firebase Firestore serialization. |
| `projects/omnitrack-mobile/lib/services/offline_sync_engine.dart` | Core SQLite `telemetry_queue` engine, FIFO batch flushing, and retry backoff logic. |
| `projects/omnitrack-mobile/lib/main.dart` | Flutter mobile UI, reactive `FleetTelemetryController`, and 60 FPS radar canvas painter. |
| `projects/omnitrack-mobile/test/widget_test.dart` | 6 automated unit & widget tests verifying serialization, FIFO queueing, and UI rendering. |
| `projects/omnitrack-mobile/demo/index.html` | Standalone browser simulator with iOS/Android phone frame, Online/Offline tunnel switch, live SQLite table inspector, and Dart code viewer. |

---

## 4. Common Technical Interview Questions & Your Answers

**Q1: "What happens if the user closes the app while 15 packets are still in the offline queue?"**  
> **Your Answer:** *"Because we persist every packet immediately to an on-disk SQLite database (`omnitrack_offline.db`) with `is_synced = 0` before attempting network transmission, those 15 packets survive app restarts or phone reboots. As soon as `OfflineSyncEngine.initialize()` runs on next launch, it queries `WHERE is_synced = 0 ORDER BY id ASC` and flushes them to Firestore."*

**Q2: "How do you prevent the local SQLite database from growing forever and filling up the phone's storage?"**  
> **Your Answer:** *"Once packets are acknowledged by Firebase, their status is updated to `is_synced = 1`, and we implemented a `purgeSyncedRecords()` cleanup method (`DELETE FROM telemetry_queue WHERE is_synced = 1`) to reclaim disk space while keeping unsynced records untouched."*
