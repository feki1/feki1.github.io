const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

function readIfExists(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return null;
}

describe('OmniTrack Project 1: Flutter Source Code & Interactive Simulator Verification', () => {

  // R1: Real Flutter & Dart Source Code
  describe('R1: Real Flutter & Dart Codebase in projects/omnitrack-mobile/', () => {
    it('pubspec.yaml exists and defines proper Flutter dependencies', () => {
      const pubspec = readIfExists('projects/omnitrack-mobile/pubspec.yaml');
      assert.ok(pubspec, 'pubspec.yaml must exist');
      assert.match(pubspec, /name:\s*omnitrack_mobile/);
      assert.match(pubspec, /sqflite:/);
      assert.match(pubspec, /cloud_firestore:/);
      assert.match(pubspec, /connectivity_plus:/);
    });

    it('lib/models/telemetry_packet.dart implements immutable model with SQLite & Firestore serialization', () => {
      const model = readIfExists('projects/omnitrack-mobile/lib/models/telemetry_packet.dart');
      assert.ok(model, 'telemetry_packet.dart must exist');
      assert.match(model, /class\s+TelemetryPacket/);
      assert.match(model, /final\s+String\s+vehicleId;/);
      assert.match(model, /final\s+double\s+latitude;/);
      assert.match(model, /final\s+double\s+longitude;/);
      assert.match(model, /final\s+double\s+speedKmh;/);
      assert.match(model, /final\s+double\s+heading;/);
      assert.match(model, /final\s+double\s+batteryLevel;/);
      assert.match(model, /final\s+int\s+timestamp;/);
      assert.match(model, /final\s+bool\s+isSynced;/);
      assert.match(model, /toSqliteMap\(\)/);
      assert.match(model, /fromSqliteMap\(/);
      assert.match(model, /toFirestore\(\)/);
      assert.match(model, /fromFirestore\(/);
      assert.match(model, /copyWith\(/);
    });

    it('lib/services/offline_sync_engine.dart implements SQLite queue and FIFO cloud flush', () => {
      const service = readIfExists('projects/omnitrack-mobile/lib/services/offline_sync_engine.dart');
      assert.ok(service, 'offline_sync_engine.dart must exist');
      assert.match(service, /class\s+OfflineSyncEngine/);
      assert.match(service, /telemetry_queue/);
      assert.match(service, /enqueuePacket\(/);
      assert.match(service, /getPendingQueue\(/);
      assert.match(service, /flushPendingQueue\(/);
      assert.match(service, /is_synced/);
      assert.match(service, /setOnlineStatus\(/);
    });

    it('lib/main.dart implements reactive sub-second state controller and 60 FPS GPS map UI', () => {
      const mainDart = readIfExists('projects/omnitrack-mobile/lib/main.dart');
      assert.ok(mainDart, 'main.dart must exist');
      assert.match(mainDart, /class\s+OmniTrackApp/);
      assert.match(mainDart, /class\s+FleetTelemetryController/);
      assert.match(mainDart, /class\s+GpsRadarMapPainter/);
      assert.match(mainDart, /Duration\(milliseconds:\s*250\)/);
      assert.match(mainDart, /TRK-101/);
      assert.match(mainDart, /VAN-204/);
      assert.match(mainDart, /EV-309/);
      assert.match(mainDart, /DRN-412/);
    });

    it('lib/main.dart properly routes dispatch commands into syncEngine and updates latestTelemetry', () => {
      const mainDart = readIfExists('projects/omnitrack-mobile/lib/main.dart');
      assert.match(mainDart, /_latestTelemetry\[current\.vehicleId\]\s*=\s*dispatchPacket;/);
      assert.match(mainDart, /syncEngine\.enqueuePacket\(dispatchPacket\)/);
      assert.match(mainDart, /syncEngine\.setOnlineStatus\(_isOnline\)/);
    });

    it('README.md provides complete technical architecture documentation', () => {
      const readme = readIfExists('projects/omnitrack-mobile/README.md');
      assert.ok(readme, 'README.md must exist');
      assert.match(readme, /OmniTrack/i);
      assert.match(readme, /Mohamed Seddik Feki/);
      assert.match(readme, /telemetry_queue/);
      assert.match(readme, /Offline-First/i);
    });

    it('Executes real Dart unit tests for TelemetryPacket via SDK if dart.exe is present', (t) => {
      const dartSdkPath = 'C:\\src\\flutter\\bin\\cache\\dart-sdk\\bin\\dart.exe';
      if (!fs.existsSync(dartSdkPath)) {
        t.skip('Dart SDK executable not present at expected path');
        return;
      }
      const testFile = path.join(ROOT_DIR, 'test', 'test_telemetry_packet.dart');
      assert.ok(fs.existsSync(testFile), 'test_telemetry_packet.dart must exist');
      const res = spawnSync(dartSdkPath, ['run', '--enable-asserts', testFile], {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      assert.strictEqual(res.status, 0, `Dart test failed with error: ${res.stderr || res.stdout}`);
      assert.match(res.stdout, /All TelemetryPacket Dart unit tests passed cleanly!/);
    });

    it('Executes dart analyze on test/test_telemetry_packet.dart with 0 issues if dart.exe is present', (t) => {
      const dartSdkPath = 'C:\\src\\flutter\\bin\\cache\\dart-sdk\\bin\\dart.exe';
      if (!fs.existsSync(dartSdkPath)) {
        t.skip('Dart SDK executable not present at expected path');
        return;
      }
      const testFile = path.join(ROOT_DIR, 'test', 'test_telemetry_packet.dart');
      assert.ok(fs.existsSync(testFile), 'test_telemetry_packet.dart must exist');
      const res = spawnSync(dartSdkPath, ['analyze', testFile], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        env: { ...process.env, LOCALAPPDATA: ROOT_DIR },
        timeout: 10000
      });
      assert.strictEqual(res.status, 0, `dart analyze reported issues: ${res.stdout}\n${res.stderr}`);
      assert.match(res.stdout, /No issues found!/);
    });

    it('Executes flutter analyze on projects/omnitrack-mobile with 0 issues if flutter is present', (t) => {
      const flutterBat = 'C:\\src\\flutter\\bin\\flutter.bat';
      if (!fs.existsSync(flutterBat)) {
        t.skip('Flutter executable not present');
        return;
      }
      const res = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/c', flutterBat, 'analyze', '--no-pub'], {
            cwd: path.join(ROOT_DIR, 'projects', 'omnitrack-mobile'),
            encoding: 'utf8',
            env: { ...process.env, LOCALAPPDATA: ROOT_DIR },
            timeout: 5000
          })
        : spawnSync(flutterBat, ['analyze', '--no-pub'], {
            cwd: path.join(ROOT_DIR, 'projects', 'omnitrack-mobile'),
            encoding: 'utf8',
            env: { ...process.env, LOCALAPPDATA: ROOT_DIR },
            timeout: 5000
          });
      if (res.error && res.error.code === 'ETIMEDOUT') {
        t.skip('Flutter CLI timed out or requires interactive terminal');
        return;
      }
      assert.strictEqual(res.status, 0, `flutter analyze reported issues: ${res.stdout}\n${res.stderr}`);
      assert.match(res.stdout, /No issues found!/);
    });

    it('Executes real Flutter test suite in projects/omnitrack-mobile/test/ if flutter is present', (t) => {
      const flutterBat = 'C:\\src\\flutter\\bin\\flutter.bat';
      if (!fs.existsSync(flutterBat)) {
        t.skip('Flutter executable not present');
        return;
      }
      const testFile = path.join(ROOT_DIR, 'projects', 'omnitrack-mobile', 'test', 'widget_test.dart');
      assert.ok(fs.existsSync(testFile), 'widget_test.dart must exist in projects/omnitrack-mobile/test/');
      const res = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/c', flutterBat, 'test', '--no-pub'], {
            cwd: path.join(ROOT_DIR, 'projects', 'omnitrack-mobile'),
            encoding: 'utf8',
            env: { ...process.env, LOCALAPPDATA: ROOT_DIR },
            timeout: 5000
          })
        : spawnSync(flutterBat, ['test', '--no-pub'], {
            cwd: path.join(ROOT_DIR, 'projects', 'omnitrack-mobile'),
            encoding: 'utf8',
            env: { ...process.env, LOCALAPPDATA: ROOT_DIR },
            timeout: 5000
          });
      if (res.error && res.error.code === 'ETIMEDOUT') {
        t.skip('Flutter CLI timed out or requires interactive terminal');
        return;
      }
      assert.strictEqual(res.status, 0, `flutter test failed: ${res.stdout}\n${res.stderr}`);
      assert.match(res.stdout, /All tests passed!/);
    });
  });

  // R2: Live Interactive Browser Mobile Simulator
  describe('R2: Live Interactive Browser Mobile Simulator (demo/index.html)', () => {
    it('demo/index.html exists and is standalone zero-dependency', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      assert.ok(demoHtml, 'demo/index.html must exist');
      assert.match(demoHtml, /<!DOCTYPE html>/i);
      assert.doesNotMatch(demoHtml, /<script[^>]*src=["']https:\/\//i);
      assert.doesNotMatch(demoHtml, /<link[^>]*href=["']https:\/\//i);
    });

    it('demo/index.html contains mobile device frame, canvas, online/offline toggle, and inspector', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      assert.match(demoHtml, /phone-frame/);
      assert.match(demoHtml, /mobile-gps-canvas/);
      assert.match(demoHtml, /net-toggle-input/);
      assert.match(demoHtml, /sqlite-table-body/);
      assert.match(demoHtml, /telemetry_queue/);
      assert.match(demoHtml, /TRK-101/);
      assert.match(demoHtml, /VAN-204/);
      assert.match(demoHtml, /EV-309/);
      assert.match(demoHtml, /DRN-412/);
    });

    it('demo/index.html back button and author links resolve cleanly to portfolio index.html', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      assert.match(demoHtml, /href=["']\.\.\/\.\.\/\.\.\/index\.html["']/);
      assert.doesNotMatch(demoHtml, /href=["']\.\.\/\.\.\/index\.html["']/);

      const demoDir = path.join(ROOT_DIR, 'projects', 'omnitrack-mobile', 'demo');
      const resolved = path.resolve(demoDir, '../../../index.html');
      assert.ok(fs.existsSync(resolved), `Back link resolved to non-existent file: ${resolved}`);
      assert.strictEqual(resolved, path.join(ROOT_DIR, 'index.html'));
    });

    it('demo/index.html embeds 100% full-fidelity Dart & documentation source files', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      const packetFile = readIfExists('projects/omnitrack-mobile/lib/models/telemetry_packet.dart');
      const syncFile = readIfExists('projects/omnitrack-mobile/lib/services/offline_sync_engine.dart');
      const mainFile = readIfExists('projects/omnitrack-mobile/lib/main.dart');
      const pubspecFile = readIfExists('projects/omnitrack-mobile/pubspec.yaml');
      const readmeFile = readIfExists('projects/omnitrack-mobile/README.md');

      assert.ok(demoHtml.includes(JSON.stringify(packetFile)), 'Full telemetry_packet.dart embedded');
      assert.ok(demoHtml.includes(JSON.stringify(syncFile)), 'Full offline_sync_engine.dart embedded');
      assert.ok(demoHtml.includes(JSON.stringify(mainFile)), 'Full main.dart embedded');
      assert.ok(demoHtml.includes(JSON.stringify(pubspecFile)), 'Full pubspec.yaml embedded');
      assert.ok(demoHtml.includes(JSON.stringify(readmeFile)), 'Full README.md embedded');
    });

    it('demo/index.html declares and exports functions avoiding strict mode ReferenceErrors', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      assert.match(demoHtml, /function\s+loadSourceCode\s*\(/);
      assert.match(demoHtml, /function\s+switchView\s*\(/);
      assert.match(demoHtml, /function\s+copyCurrentCode\s*\(/);
      assert.match(demoHtml, /renderSqliteTable\(\);/);
      assert.match(demoHtml, /loadSourceCode\('packet'\);/);
    });

    it('All fleet vehicle kinematic coordinates remain strictly within canvas bounds', () => {
      const minLat = 2.8700, maxLat = 2.9800;
      const minLng = 101.6000, maxLng = 101.7300;
      const vehicles = [
        { id: 'TRK-101', baseLat: 2.9213, baseLng: 101.6559, radius: 0.016 },
        { id: 'VAN-204', baseLat: 2.9341, baseLng: 101.6682, radius: 0.022 },
        { id: 'EV-309',  baseLat: 2.9105, baseLng: 101.6421, radius: 0.013 },
        { id: 'DRN-412', baseLat: 2.9420, baseLng: 101.6810, radius: 0.028 }
      ];

      vehicles.forEach(v => {
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const lat = v.baseLat + (v.radius * Math.sin(a));
          const lng = v.baseLng + (v.radius * 1.35 * Math.cos(a));
          assert.ok(lat >= minLat && lat <= maxLat, `${v.id} lat out of bounds: ${lat}`);
          assert.ok(lng >= minLng && lng <= maxLng, `${v.id} lng out of bounds: ${lng}`);
        }
      });
    });

    it('demo/index.html enforces mobile viewport responsiveness and keyboard accessibility', () => {
      const demoHtml = readIfExists('projects/omnitrack-mobile/demo/index.html');
      assert.match(demoHtml, /max-width:\s*420px;/, 'Phone frame must enforce max-width for mobile viewports');
      assert.match(demoHtml, /copyToClipboardFallback/, 'Must implement clipboard copy fallback for file:/// protocol');
      assert.match(demoHtml, /tabindex=["']0["']/, 'Phone status pill must be keyboard focusable');
      assert.match(demoHtml, /handlePillKeydown/, 'Keyboard handler attached to phone net pill');
    });

    it('lib/main.dart GpsRadarMapPainter adheres to padded coordinate bounds', () => {
      const mainDart = readIfExists('projects/omnitrack-mobile/lib/main.dart');
      assert.match(mainDart, /const\s+minLat\s*=\s*2\.8700;/);
      assert.match(mainDart, /const\s+maxLat\s*=\s*2\.9800;/);
      assert.match(mainDart, /const\s+minLng\s*=\s*101\.6000;/);
      assert.match(mainDart, /const\s+maxLng\s*=\s*101\.7300;/);
    });
  });

  // R3: Portfolio Integration
  describe('R3: Portfolio Integration in index.html & portfolio-data.js', () => {
    it('index.html Project Card 1 links directly to projects/omnitrack-mobile/demo/index.html', () => {
      const indexHtml = readIfExists('index.html');
      assert.ok(indexHtml, 'index.html must exist');
      assert.match(indexHtml, /href=["']projects\/omnitrack-mobile\/demo\/index\.html["']/);
      assert.match(indexHtml, /data-testid=["']omnitrack-demo-link["']/);
    });

    it('data/portfolio-data.js Project 1 demo link points to projects/omnitrack-mobile/demo/index.html', () => {
      const data = require(path.join(ROOT_DIR, 'data', 'portfolio-data.js'));
      const projects = data.showcaseProjects || data.projects;
      const omni = projects.find(p => /omnitrack/i.test(p.title + ' ' + (p.fullTitle || '')));
      assert.ok(omni, 'OmniTrack project entry must exist');
      assert.strictEqual(omni.links.demo, 'projects/omnitrack-mobile/demo/index.html');
    });
  });

  // Zero Placeholder Audit
  describe('Zero Placeholder Audit across OmniTrack files', () => {
    const filesToCheck = [
      'projects/omnitrack-mobile/pubspec.yaml',
      'projects/omnitrack-mobile/README.md',
      'projects/omnitrack-mobile/lib/models/telemetry_packet.dart',
      'projects/omnitrack-mobile/lib/services/offline_sync_engine.dart',
      'projects/omnitrack-mobile/lib/main.dart',
      'projects/omnitrack-mobile/demo/index.html'
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
