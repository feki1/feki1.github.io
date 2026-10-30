/**
 * Automated E2E Test Runner (test/run-e2e.js)
 * Executes all 4 test tiers (120 assertions) using Node.js native test runner.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const testFiles = [
  path.join(__dirname, 'tier1-features.test.js'),
  path.join(__dirname, 'tier2-boundary.test.js'),
  path.join(__dirname, 'tier3-pairwise.test.js'),
  path.join(__dirname, 'tier4-scenarios.test.js')
];

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit'
});

process.exit(result.status ?? 0);
