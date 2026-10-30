const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const ROOT_DIR = path.resolve(__dirname, '..');

function importTs(relPath) {
  return import(pathToFileURL(path.join(ROOT_DIR, relPath)).href);
}

function readIfExists(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return null;
}

describe('NexusPulse Project 2: Next.js/TypeScript/GraphQL Source Code & Interactive Simulator Verification', () => {

  // =========================================================================
  // R1: Real Next.js, TypeScript & GraphQL Source Code
  // =========================================================================
  describe('R1: Real Next.js, TypeScript & GraphQL Codebase in projects/nexus-pulse-saas/', () => {
    it('package.json exists, is valid JSON, and defines Next.js, React, GraphQL & Jose dependencies', () => {
      const raw = readIfExists('projects/nexus-pulse-saas/package.json');
      assert.ok(raw, 'package.json must exist');
      const pkg = JSON.parse(raw);
      assert.strictEqual(pkg.name, 'nexus-pulse-saas');
      assert.strictEqual(pkg.type, 'module');
      assert.ok(pkg.dependencies.next, 'Must depend on next');
      assert.ok(pkg.dependencies.react, 'Must depend on react');
      assert.ok(pkg.dependencies.graphql, 'Must depend on graphql');
      assert.ok(pkg.dependencies.jose, 'Must depend on jose');
      assert.match(pkg.author, /Mohamed Seddik Feki/);
      assert.match(pkg.author, /seddikfeki15@gmail\.com/);
    });

    it('tsconfig.json exists, is valid JSON, and specifies strict TypeScript compiler options', () => {
      const raw = readIfExists('projects/nexus-pulse-saas/tsconfig.json');
      assert.ok(raw, 'tsconfig.json must exist');
      const tsconfig = JSON.parse(raw);
      assert.strictEqual(tsconfig.compilerOptions.strict, true);
      assert.strictEqual(tsconfig.compilerOptions.noEmit, true);
      assert.strictEqual(tsconfig.compilerOptions.moduleResolution, 'bundler');
      assert.strictEqual(tsconfig.compilerOptions.allowImportingTsExtensions, true);
    });

    it('src/lib/timeseries-engine.ts implements TimeSeriesEngine and lttbDownsample', () => {
      const engineSrc = readIfExists('projects/nexus-pulse-saas/src/lib/timeseries-engine.ts');
      assert.ok(engineSrc, 'timeseries-engine.ts must exist');
      assert.match(engineSrc, /export\s+interface\s+DataPoint/);
      assert.match(engineSrc, /export\s+interface\s+MetricSummary/);
      assert.match(engineSrc, /export\s+interface\s+DownsampleResult/);
      assert.match(engineSrc, /export\s+function\s+lttbDownsample\s*\(/);
      assert.match(engineSrc, /export\s+class\s+TimeSeriesEngine/);
      assert.match(engineSrc, /generateSyntheticDataset/);
      assert.match(engineSrc, /getDownsampled/);
      assert.match(engineSrc, /computeSummary/);
    });

    it('Executes real LTTB downsampling unit test on 50,000 points via Node strip-types', async () => {
      const engineModule = await importTs('projects/nexus-pulse-saas/src/lib/timeseries-engine.ts');
      const engine = new engineModule.TimeSeriesEngine('api_throughput_rps', 100000);

      const t0 = performance.now();
      engine.generateSyntheticDataset(50000, 1000, 1420.0);
      const tGen = performance.now();
      assert.strictEqual(engine.length, 50000, 'Must contain 50,000 points');

      const downsampleRes = engine.getDownsampled(1000);
      const tDown = performance.now();

      assert.strictEqual(downsampleRes.originalCount, 50000);
      assert.strictEqual(downsampleRes.sampledCount, 1000);
      assert.strictEqual(downsampleRes.compressionRatio, 50);
      assert.ok(downsampleRes.durationMs < 20, `LTTB downsampling duration must be fast (got ${downsampleRes.durationMs}ms)`);

      const summary = engine.computeSummary();
      assert.strictEqual(summary.totalPoints, 50000);
      assert.ok(summary.min < summary.avg, 'Min must be below average');
      assert.ok(summary.max > summary.avg, 'Max must be above average');
      assert.ok(summary.p95 <= summary.p99, 'P95 must be <= P99');
    });

    it('lttbDownsample correctly handles boundary conditions (small datasets and invalid thresholds)', async () => {
      const { lttbDownsample } = await importTs('projects/nexus-pulse-saas/src/lib/timeseries-engine.ts');
      const smallData = [
        { timestamp: 1000, value: 10 },
        { timestamp: 2000, value: 25 },
        { timestamp: 3000, value: 15 }
      ];

      // Threshold >= length should return copy
      const copyRes = lttbDownsample(smallData, 5);
      assert.strictEqual(copyRes.length, 3);

      // Threshold <= 2 should return copy
      const minRes = lttbDownsample(smallData, 2);
      assert.strictEqual(minRes.length, 3);

      // Float thresholds, NaN, zero and negative values must never throw RangeError
      assert.doesNotThrow(() => lttbDownsample(smallData, 2.5));
      assert.doesNotThrow(() => lttbDownsample(smallData, NaN));
      assert.doesNotThrow(() => lttbDownsample(smallData, 0));
      assert.doesNotThrow(() => lttbDownsample(smallData, -10));
    });

    it('generateSyntheticDataset handles boundary and invalid point counts safely without RangeError', async () => {
      const { TimeSeriesEngine } = await importTs('projects/nexus-pulse-saas/src/lib/timeseries-engine.ts');
      const engine = new TimeSeriesEngine();
      assert.doesNotThrow(() => engine.generateSyntheticDataset(0));
      assert.strictEqual(engine.length, 0);
      assert.doesNotThrow(() => engine.generateSyntheticDataset(-10));
      assert.strictEqual(engine.length, 0);
      assert.doesNotThrow(() => engine.generateSyntheticDataset(NaN));
      assert.strictEqual(engine.length, 0);
    });

    it('src/lib/rbac-jwt.ts implements granular RBAC matrix and JWT token rotation engine', () => {
      const rbacSrc = readIfExists('projects/nexus-pulse-saas/src/lib/rbac-jwt.ts');
      assert.ok(rbacSrc, 'rbac-jwt.ts must exist');
      assert.match(rbacSrc, /export\s+type\s+Role\s*=\s*'ADMIN'\s*\|\s*'ENGINEER'\s*\|\s*'VIEWER'/);
      assert.match(rbacSrc, /export\s+const\s+ROLE_PERMISSIONS/);
      assert.match(rbacSrc, /export\s+function\s+hasPermission/);
      assert.match(rbacSrc, /export\s+function\s+assertAuthorized/);
      assert.match(rbacSrc, /export\s+class\s+AuthService/);
      assert.match(rbacSrc, /createSession/);
      assert.match(rbacSrc, /rotateTokens/);
      assert.match(rbacSrc, /verifyToken/);
      assert.match(rbacSrc, /revokeFamily/);
    });

    it('Executes real RBAC and JWT token rotation unit tests via Node strip-types', async () => {
      const {
        ROLE_PERMISSIONS,
        hasPermission,
        assertAuthorized,
        AuthService
      } = await importTs('projects/nexus-pulse-saas/src/lib/rbac-jwt.ts');

      // RBAC Permission checks
      assert.strictEqual(hasPermission('VIEWER', 'telemetry:read'), true);
      assert.strictEqual(hasPermission('VIEWER', 'nodes:restart_service'), false);
      assert.strictEqual(hasPermission('VIEWER', 'system:purge_telemetry'), false);

      assert.strictEqual(hasPermission('ENGINEER', 'nodes:restart_service'), true);
      assert.strictEqual(hasPermission('ENGINEER', 'timeseries:downsample'), true);
      assert.strictEqual(hasPermission('ENGINEER', 'system:purge_telemetry'), false);

      assert.strictEqual(hasPermission('ADMIN', 'system:purge_telemetry'), true);
      assert.strictEqual(hasPermission('ADMIN', 'tokens:revoke_all'), true);
      assert.strictEqual(hasPermission('ADMIN', 'api_keys:rotate'), true);

      // JWT Session Creation & Verification
      const auth = new AuthService('test-secret-key-397fd314');
      const testUser = {
        id: 'usr-test-01',
        email: 'seddikfeki15@gmail.com',
        name: 'Mohamed Seddik Feki',
        role: 'ADMIN'
      };

      const session = auth.createSession(testUser);
      assert.ok(session.accessToken, 'Access token must be generated');
      assert.ok(session.refreshToken, 'Refresh token must be generated');
      assert.strictEqual(session.tokenType, 'Bearer');

      const verifiedAccess = auth.verifyToken(session.accessToken);
      assert.strictEqual(verifiedAccess.sub, 'usr-test-01');
      assert.strictEqual(verifiedAccess.role, 'ADMIN');

      const verifiedRefresh = auth.verifyToken(session.refreshToken);
      assert.strictEqual(verifiedRefresh.version, 1);

      // Token Rotation (Version 1 -> Version 2)
      const rotated = auth.rotateTokens(session.refreshToken, testUser);
      assert.ok(rotated.accessToken, 'New access token must be generated');
      assert.ok(rotated.refreshToken, 'New refresh token must be generated');
      const verifiedRotatedRefresh = auth.verifyToken(rotated.refreshToken);
      assert.strictEqual(verifiedRotatedRefresh.version, 2);

      // Replay Attack Detection: Submitting the retired version 1 token must fail & revoke family
      assert.throws(
        () => auth.rotateTokens(session.refreshToken, testUser),
        /Replay attack detected|revoked/i,
        'Must detect token replay attack and revoke family'
      );

      // Cross-Tenant / User Family Ownership Check
      const userA = { id: 'usr-tenant-a', email: 'a@nexus-pulse.io', name: 'User A', role: 'ENGINEER' };
      const freshSessionA = auth.createSession(userA);
      const userAttacker = {
        id: 'usr-attacker-99',
        email: 'attacker@malicious.com',
        name: 'Attacker',
        role: 'ADMIN'
      };
      assert.throws(
        () => auth.rotateTokens(freshSessionA.refreshToken, userAttacker),
        /Unauthorized token rotation/i,
        'Must reject token rotation for non-owner user'
      );

      // Signature Tampering Detection
      const tamperedParts = session.accessToken.split('.');
      const tamperedToken = tamperedParts[0] + '.' + tamperedParts[1] + '.invalidsignature123';
      assert.throws(
        () => auth.verifyToken(tamperedToken),
        /JWT Signature verification failed/i,
        'Must reject tampered signature'
      );

      // Unknown / Invalid Role Defensive Guards
      assert.throws(
        () => auth.createSession({ id: 'bad-user', email: 'bad@test.com', name: 'Bad', role: 'INVALID_ROLE' }),
        /unknown role/i,
        'Must reject unknown role in createSession'
      );
      const freshSessionForRole = auth.createSession({ id: 'usr-role-test', email: 'role@test.com', name: 'Role', role: 'ADMIN' });
      assert.throws(
        () => auth.rotateTokens(freshSessionForRole.refreshToken, { id: 'usr-role-test', email: 'role@test.com', name: 'Role', role: 'INVALID_ROLE' }),
        /unknown role/i,
        'Must reject unknown role in rotateTokens'
      );
    });

    it('src/graphql/schema.ts implements SDL typeDefs, resolvers, and in-process query executor', () => {
      const schemaSrc = readIfExists('projects/nexus-pulse-saas/src/graphql/schema.ts');
      assert.ok(schemaSrc, 'schema.ts must exist');
      assert.match(schemaSrc, /export\s+const\s+typeDefs/);
      assert.match(schemaSrc, /enum\s+Role/);
      assert.match(schemaSrc, /type\s+TelemetrySeries/);
      assert.match(schemaSrc, /type\s+ClusterNode/);
      assert.match(schemaSrc, /type\s+Query/);
      assert.match(schemaSrc, /type\s+Mutation/);
      assert.match(schemaSrc, /export\s+const\s+resolvers/);
      assert.match(schemaSrc, /export\s+async\s+function\s+executeGraphQLQuery/);
    });

    it('Executes real GraphQL queries against in-process schema and enforces RBAC authorization', async () => {
      const { executeGraphQLQuery } = await importTs('projects/nexus-pulse-saas/src/graphql/schema.ts');

      // Query: me
      const meRes = await executeGraphQLQuery('{ me { id email role permissions } }');
      assert.ok(meRes.data && meRes.data.me, 'me query must resolve');
      assert.strictEqual(meRes.data.me.email, 'seddikfeki15@gmail.com');
      assert.ok(Array.isArray(meRes.data.me.permissions));

      // Query: getTelemetry
      const telemetryRes = await executeGraphQLQuery(`
        query {
          getTelemetry(metric: "api_throughput_rps", pointCount: 10000, targetResolution: 500) {
            metricName
            originalCount
            sampledCount
            compressionRatio
            durationMs
            summary { min max avg latestValue }
          }
        }
      `);
      assert.ok(telemetryRes.data && telemetryRes.data.getTelemetry);
      assert.strictEqual(telemetryRes.data.getTelemetry.originalCount, 10000);
      assert.strictEqual(telemetryRes.data.getTelemetry.sampledCount, 500);

      // Query: getClusterHealth
      const clusterRes = await executeGraphQLQuery('{ getClusterHealth { id name region status cpuUsagePercent } }');
      assert.ok(clusterRes.data && clusterRes.data.getClusterHealth);
      assert.ok(clusterRes.data.getClusterHealth.length >= 3);

      // Mutation: restartNode RBAC Check for VIEWER (must fail)
      const viewerFail = await executeGraphQLQuery(
        'mutation { restartNode(nodeId: "nexus-edge-ap-southeast") { id status } }',
        {},
        { userRole: 'VIEWER' }
      );
      assert.ok(viewerFail.errors && viewerFail.errors.length > 0);
      assert.match(viewerFail.errors[0].message, /Permission Denied|nodes:restart_service/i);

      // Mutation: restartNode RBAC Check for ENGINEER (must succeed)
      const engineerOk = await executeGraphQLQuery(
        'mutation { restartNode(nodeId: "nexus-edge-ap-southeast") { id status } }',
        {},
        { userRole: 'ENGINEER' }
      );
      assert.ok(engineerOk.data && engineerOk.data.restartNode);
      assert.strictEqual(engineerOk.data.restartNode.status, 'ONLINE');

      // Multi-field query execution (as used by Next.js SSR dashboard)
      const multiRes = await executeGraphQLQuery(`
        query DashboardInitialData {
          getTelemetry(metric: "api_throughput_rps", pointCount: 10000, targetResolution: 500) {
            metricName
            originalCount
          }
          getClusterHealth {
            id
            status
          }
          me {
            id
            role
          }
        }
      `);
      assert.ok(multiRes.data, 'Multi-field query must return data');
      assert.ok(multiRes.data.getTelemetry, 'Must resolve getTelemetry');
      assert.ok(multiRes.data.getClusterHealth, 'Must resolve getClusterHealth');
      assert.ok(multiRes.data.me, 'Must resolve me');
      assert.strictEqual(multiRes.data.getTelemetry.originalCount, 10000);
      assert.ok(multiRes.data.getClusterHealth.length >= 3);
      assert.strictEqual(multiRes.data.me.role, 'ADMIN');
    });

    it('executeGraphQLQuery extracts inline parameters for triggerLttbDownsample and switchRole with quotes', async () => {
      const { executeGraphQLQuery } = await importTs('projects/nexus-pulse-saas/src/graphql/schema.ts');

      // Test triggerLttbDownsample inline arguments
      const sampleRes = await executeGraphQLQuery(
        'mutation { triggerLttbDownsample(pointCount: 15000, targetResolution: 300) { originalCount sampledCount } }'
      );
      assert.ok(sampleRes.data && sampleRes.data.triggerLttbDownsample);
      assert.strictEqual(sampleRes.data.triggerLttbDownsample.originalCount, 15000);
      assert.strictEqual(sampleRes.data.triggerLttbDownsample.sampledCount, 300);

      // Test switchRole with quoted enum string
      const roleRes = await executeGraphQLQuery('mutation { switchRole(role: "VIEWER") { user { role } } }');
      assert.ok(roleRes.data && roleRes.data.switchRole);
      assert.strictEqual(roleRes.data.switchRole.user.role, 'VIEWER');

      // Test switchRole with invalid role (must reject with validation error)
      const invalidRoleRes = await executeGraphQLQuery('mutation { switchRole(role: "SUPERADMIN") { user { role } } }');
      assert.ok(invalidRoleRes.errors && invalidRoleRes.errors.length > 0);
      assert.match(invalidRoleRes.errors[0].message, /Invalid role "SUPERADMIN"/i);

      // Test rotateTokens mutation
      const rotateRes = await executeGraphQLQuery('mutation { rotateTokens { accessToken refreshToken expiresInSeconds } }');
      assert.ok(rotateRes.data && rotateRes.data.rotateTokens);
      assert.ok(rotateRes.data.rotateTokens.accessToken);
      assert.ok(rotateRes.data.rotateTokens.refreshToken);
    });

    it('src/app/page.tsx implements SSR Next.js dashboard view with KPI widgets and canvas preview', () => {
      const pageSrc = readIfExists('projects/nexus-pulse-saas/src/app/page.tsx');
      assert.ok(pageSrc, 'page.tsx must exist');
      assert.match(pageSrc, /export\s+default\s+async\s+function\s+NexusPulseDashboardPage/);
      assert.match(pageSrc, /executeGraphQLQuery/);
      assert.match(pageSrc, /Throughput/);
      assert.match(pageSrc, /LTTB Downsampling Latency/);
      assert.match(pageSrc, /60\.0 FPS/);
      assert.match(pageSrc, /Distributed Edge Nodes/);
      assert.match(pageSrc, /RBAC Security Status/);
      assert.match(pageSrc, /href=["']\.\/demo\/index\.html["']/);
    });

    it('README.md provides complete technical architecture documentation', () => {
      const readme = readIfExists('projects/nexus-pulse-saas/README.md');
      assert.ok(readme, 'README.md must exist');
      assert.match(readme, /NexusPulse/i);
      assert.match(readme, /Mohamed Seddik Feki/);
      assert.match(readme, /Largest-Triangle-Three-Buckets/i);
      assert.match(readme, /LTTB/);
      assert.match(readme, /Role-Based Access Control/i);
      assert.match(readme, /Refresh Token Rotation/i);
      assert.match(readme, /Token Family/i);
    });
  });

  // =========================================================================
  // R2: Live Interactive Browser SaaS Dashboard & 50k-Point 60 FPS Demo
  // =========================================================================
  describe('R2: Live Interactive Browser SaaS Dashboard (demo/index.html)', () => {
    it('demo/index.html exists and is standalone zero-dependency', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.ok(demoHtml, 'demo/index.html must exist');
      assert.match(demoHtml, /<!DOCTYPE html>/i);
      assert.doesNotMatch(demoHtml, /<script[^>]*src=["']https?:\/\//i);
      assert.doesNotMatch(demoHtml, /<link[^>]*href=["']https?:\/\//i);
    });

    it('demo/index.html contains 50k-point canvas chart, dataset toggles, and live telemetry bar', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /id=["']timeseriesCanvas["']/);
      assert.match(demoHtml, /id=["']canvasWrapper["']/);
      assert.match(demoHtml, /id=["']canvasTooltip["']/);
      assert.match(demoHtml, /setDatasetSize\(10000\)/);
      assert.match(demoHtml, /setDatasetSize\(50000\)/);
      assert.match(demoHtml, /setDatasetSize\(100000\)/);
      assert.match(demoHtml, /id=["']zoomRange["']/);
      assert.match(demoHtml, /id=["']panRange["']/);
      assert.match(demoHtml, /id=["']kpiFps["']/);
      assert.match(demoHtml, /id=["']kpiDownsampleTime["']/);
      assert.match(demoHtml, /id=["']telemetryBudgetPct["']/);
    });

    it('demo/index.html contains interactive RBAC role switcher and JWT rotation inspector', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /id=["']btnRoleAdmin["']/);
      assert.match(demoHtml, /id=["']btnRoleEngineer["']/);
      assert.match(demoHtml, /id=["']btnRoleViewer["']/);
      assert.match(demoHtml, /id=["']permsMatrixTitle["']/);
      assert.match(demoHtml, /id=["']permissionsList["']/);
      assert.match(demoHtml, /rotateTokens\(\)/);
      assert.match(demoHtml, /simulateReplayAttack\(\)/);
      assert.match(demoHtml, /resetAuthSession\(\)/);
      assert.match(demoHtml, /id=["']rawJwtDisplay["']/);
      assert.match(demoHtml, /id=["']jwtPayloadDisplay["']/);
      assert.match(demoHtml, /id=["']familyStatusBadge["']/);
    });

    it('demo/index.html implements sensitive control masking for lower roles and accessibility labels', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /data-permission=["']system:purge_telemetry["']/);
      assert.match(demoHtml, /data-min-role=["']Admin["']/);
      assert.match(demoHtml, /\.ops-row\.masked/);
      assert.match(demoHtml, /\.action-btn\.masked-btn/);
      assert.match(demoHtml, /aria-label=["']Zoom time window["']/);
      assert.match(demoHtml, /aria-label=["']Pan time offset["']/);
      assert.match(demoHtml, /aria-label=["']GraphQL query editor["']/);
    });

    it('demo/index.html contains interactive GraphQL query runner with sample queries and response viewer', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /loadSampleQuery\('telemetry'\)/);
      assert.match(demoHtml, /loadSampleQuery\('cluster'\)/);
      assert.match(demoHtml, /loadSampleQuery\('restart'\)/);
      assert.match(demoHtml, /loadSampleQuery\('me'\)/);
      assert.match(demoHtml, /id=["']graphqlEditor["']/);
      assert.match(demoHtml, /id=["']graphqlResult["']/);
      assert.match(demoHtml, /runGraphqlQuery\(\)/);
    });

    it('demo/index.html back button and portfolio return link resolve cleanly to portfolio index.html', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /href=["']\.\.\/\.\.\/\.\.\/index\.html["']/);
      assert.doesNotMatch(demoHtml, /href=["']\.\.\/\.\.\/index\.html["']/);

      const demoDir = path.join(ROOT_DIR, 'projects', 'nexus-pulse-saas', 'demo');
      const resolved = path.resolve(demoDir, '../../../index.html');
      assert.ok(fs.existsSync(resolved), `Back link resolved to non-existent file: ${resolved}`);
      assert.strictEqual(resolved, path.join(ROOT_DIR, 'index.html'));
    });

    it('demo/index.html embeds 100% full-fidelity TypeScript, Next.js & documentation source files', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      const engineFile = readIfExists('projects/nexus-pulse-saas/src/lib/timeseries-engine.ts');
      const rbacFile = readIfExists('projects/nexus-pulse-saas/src/lib/rbac-jwt.ts');
      const schemaFile = readIfExists('projects/nexus-pulse-saas/src/graphql/schema.ts');
      const pageFile = readIfExists('projects/nexus-pulse-saas/src/app/page.tsx');
      const packageFile = readIfExists('projects/nexus-pulse-saas/package.json');
      const tsconfigFile = readIfExists('projects/nexus-pulse-saas/tsconfig.json');
      const readmeFile = readIfExists('projects/nexus-pulse-saas/README.md');

      assert.ok(demoHtml.includes(JSON.stringify(engineFile)), 'Full timeseries-engine.ts must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(rbacFile)), 'Full rbac-jwt.ts must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(schemaFile)), 'Full schema.ts must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(pageFile)), 'Full page.tsx must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(packageFile)), 'Full package.json must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(tsconfigFile)), 'Full tsconfig.json must be embedded');
      assert.ok(demoHtml.includes(JSON.stringify(readmeFile)), 'Full README.md must be embedded');
    });

    it('demo/index.html declares and exports functions to window avoiding strict mode ReferenceErrors', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /window\.setRole\s*=\s*setRole/);
      assert.match(demoHtml, /window\.rotateTokens\s*=\s*rotateTokens/);
      assert.match(demoHtml, /window\.simulateReplayAttack\s*=\s*simulateReplayAttack/);
      assert.match(demoHtml, /window\.resetAuthSession\s*=\s*resetAuthSession/);
      assert.match(demoHtml, /window\.executeGatedAction\s*=\s*executeGatedAction/);
      assert.match(demoHtml, /window\.loadSampleQuery\s*=\s*loadSampleQuery/);
      assert.match(demoHtml, /window\.runGraphqlQuery\s*=\s*runGraphqlQuery/);
      assert.match(demoHtml, /window\.copyQueryResult\s*=\s*copyQueryResult/);
      assert.match(demoHtml, /window\.viewSourceFile\s*=\s*viewSourceFile/);
      assert.match(demoHtml, /window\.copyCurrentSourceFile\s*=\s*copyCurrentSourceFile/);
      assert.match(demoHtml, /window\.switchNavTab\s*=\s*switchNavTab/);
      assert.match(demoHtml, /window\.setDatasetSize\s*=\s*setDatasetSize/);
      assert.match(demoHtml, /window\.setBuckets\s*=\s*setBuckets/);
      assert.match(demoHtml, /window\.handleZoomChange\s*=\s*handleZoomChange/);
      assert.match(demoHtml, /window\.handlePanChange\s*=\s*handlePanChange/);
      assert.match(demoHtml, /window\.toggleStreaming\s*=\s*toggleStreaming/);
    });

    it('demo/index.html embedded simulation script compiles with zero syntax errors via vm.Script', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      const match = demoHtml.match(/<script>([\s\S]*?)<\/script>/);
      assert.ok(match, 'Must have script tag');
      const scriptCode = match[1];
      assert.doesNotThrow(() => {
        new vm.Script(scriptCode);
      }, 'Script must compile without syntax errors');
    });

    it('demo/index.html base64UrlEncode safely handles Unicode strings and special characters', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      // Assert that base64UrlEncode uses encodeURIComponent for UTF-8 safety
      assert.match(demoHtml, /encodeURIComponent\(str\)/, 'Must be UTF-8 safe');
    });

    it('demo/index.html updateRbacUi sets aria-pressed and aria-disabled accessibility attributes', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /setAttribute\(['"]aria-pressed['"]/);
      assert.match(demoHtml, /setAttribute\(['"]aria-disabled['"]/);
    });

    it('demo/index.html runGraphqlQuery handles rotateTokens, custom query arguments, and role validation', () => {
      const demoHtml = readIfExists('projects/nexus-pulse-saas/demo/index.html');
      assert.match(demoHtml, /query\.indexOf\(['"]rotateTokens['"]\)/);
      assert.match(demoHtml, /dataObj\.rotateTokens\s*=/);
      assert.match(demoHtml, /query\.match\(\/metric\\s\*:\\s\*\["\'\]\(\[\^"\'\]\+\)\["\'\]\/\)/);
      assert.match(demoHtml, /query\.match\(\/nodeId\\s\*:\\s\*\["\'\]\(\[\^"\'\]\+\)\["\'\]\/\)/);
    });
  });

  // =========================================================================
  // R3: Portfolio Integration
  // =========================================================================
  describe('R3: Portfolio Integration in index.html & portfolio-data.js', () => {
    it('index.html Project Card 2 links directly to projects/nexus-pulse-saas/demo/index.html', () => {
      const indexHtml = readIfExists('index.html');
      assert.ok(indexHtml, 'index.html must exist');
      assert.match(indexHtml, /href=["']projects\/nexus-pulse-saas\/demo\/index\.html["']/);
      assert.match(indexHtml, /data-testid=["']nexus-pulse-demo-link["']/);
      assert.match(indexHtml, /⚡ Live Interactive Demo/);
    });

    it('data/portfolio-data.js Project 2 demo link points to projects/nexus-pulse-saas/demo/index.html', () => {
      const data = require(path.join(ROOT_DIR, 'data', 'portfolio-data.js'));
      const projects = data.showcaseProjects || data.projects;
      const nexus = projects.find(p => /nexus/i.test(p.title + ' ' + (p.fullTitle || '')));
      assert.ok(nexus, 'NexusPulse project entry must exist in portfolio-data.js');
      assert.strictEqual(nexus.links.demo, 'projects/nexus-pulse-saas/demo/index.html');
    });
  });

  // =========================================================================
  // Zero Placeholder Audit across all NexusPulse files
  // =========================================================================
  describe('Zero Placeholder Audit across NexusPulse files', () => {
    const filesToCheck = [
      'projects/nexus-pulse-saas/package.json',
      'projects/nexus-pulse-saas/tsconfig.json',
      'projects/nexus-pulse-saas/README.md',
      'projects/nexus-pulse-saas/src/lib/timeseries-engine.ts',
      'projects/nexus-pulse-saas/src/lib/rbac-jwt.ts',
      'projects/nexus-pulse-saas/src/graphql/schema.ts',
      'projects/nexus-pulse-saas/src/app/page.tsx',
      'projects/nexus-pulse-saas/demo/index.html'
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
