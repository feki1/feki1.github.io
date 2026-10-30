/**
 * Tier 4: Real-World Scenarios Test Suite
 *
 * Requirements: End-to-end user journeys:
 * 1. Freelance Client Conversion Journey
 * 2. International Internship Recruiter Credential Verification & CV Print Journey
 * 3. Offline / Standalone Evaluation Journey (`file:///` execution)
 *
 * Uses Node.js native `node:test` and `node:assert`. Zero external npm dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function readIfExists(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return null;
}

function loadDataCore() {
  const dataPath = path.join(ROOT_DIR, 'data', 'portfolio-data.js');
  if (!fs.existsSync(dataPath)) {
    return null;
  }
  try {
    delete require.cache[require.resolve(dataPath)];
    return require(dataPath);
  } catch (err) {
    return null;
  }
}

function hasTestId(html, testId) {
  if (!html) return false;
  const regex = new RegExp(`data-testid=["']${testId}["']`, 'i');
  return regex.test(html);
}

describe('Tier 4: Real-World Scenarios', () => {

  // =========================================================================
  // Journey 1: Freelance Client Conversion Journey (5 Tests)
  // =========================================================================
  describe('Journey 1: Freelance Client Conversion Journey', () => {
    it('TC-4.1.1: Client lands on Hero and immediately observes full-stack and mobile service positioning', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.match(data.personal.headline, /Software,\s*Web\s*&\s*Mobile\s*App\s*Developer/i);

      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'hero-section'), 'Hero section must exist');
      assert.ok(hasTestId(html, 'hero-availability-badge'), 'Availability badge must exist');
    });

    it('TC-4.1.2: Client inspects Services section with 4 clear commercial deliverables', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.strictEqual(data.services.length, 4, 'Must provide 4 client service cards');
      data.services.forEach(s => {
        assert.ok(s.deliverables && s.deliverables.length >= 2, `Service ${s.id} must list concrete deliverables`);
      });

      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'services-grid'), 'Services grid must exist');
    });

    it('TC-4.1.3: Client filters portfolio to Web or Mobile to evaluate past production work', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      const webProjects = projects.filter(p => p.category === 'web');
      const mobileProjects = projects.filter(p => p.category === 'mobile');
      assert.ok(webProjects.length >= 1, 'At least 1 web project must be showcase-ready');
      assert.ok(mobileProjects.length >= 1, 'At least 1 mobile project must be showcase-ready');

      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'filter-tab-web'), 'Web filter tab must exist');
      assert.ok(hasTestId(html, 'filter-tab-mobile'), 'Mobile filter tab must exist');
    });

    it('TC-4.1.4: Client verifies multilingual fluency for international engagement', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const languages = data.languages.map(l => l.language).join(', ');
      assert.match(languages, /English/i);
      assert.match(languages, /French/i);
      assert.match(languages, /Arabic/i);
      assert.match(languages, /Italian/i);
      assert.match(languages, /Spanish/i);
    });

    it('TC-4.1.5: Client executes conversion action (WhatsApp message link, 1-click email copy, or form)', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'contact-whatsapp-link'), 'WhatsApp conversion link must exist');
      assert.ok(hasTestId(html, 'quick-copy-email-btn') || hasTestId(html, 'copy-email-btn'),
        'Copy email conversion trigger must exist');
      assert.ok(hasTestId(html, 'contact-form'), 'Inquiry form must exist');
    });
  });

  // =========================================================================
  // Journey 2: Internship Recruiter Credential Verification & CV Print (5 Tests)
  // =========================================================================
  describe('Journey 2: Internship Recruiter Credential Verification & CV Print', () => {
    it('TC-4.2.1: Recruiter verifies XMUM pedigree and 50% Academic Merit Scholarship', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const edu = Array.isArray(data.education) ? data.education[0] : data.education;
      assert.match(edu.institution, /Xiamen University Malaysia/i);
      assert.match(edu.degree, /Bachelor of Robotics and Automation Engineering/i);
      const scholarship = edu.honors || edu.meritScholarship || '';
      assert.match(scholarship, /50%\s*(Academic\s*)?Merit\s*Scholarship/i);
    });

    it('TC-4.2.2: Recruiter verifies global mobility badges for Summer Internship relocation', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const badges = data.personal.mobilityBadges || data.mobility || [];
      const reloc = badges.find(b => /relocation|summer/i.test(b.label + ' ' + b.sublabel));
      assert.ok(reloc, 'Recruiter must find global summer relocation badge');
    });

    it('TC-4.2.3: Recruiter audits cross-disciplinary depth in both software and robotics', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const skills = data.technicalSkills || data.skills;
      const allSkills = skills.flatMap(s => s.skills).join(' ');
      // Software stack check
      assert.match(allSkills, /React|Next\.js|TypeScript|Flutter/i);
      // Robotics & hardware stack check
      assert.match(allSkills, /ROS|ESP32|Python|C\+\+/i);
    });

    it('TC-4.2.4: Recruiter verifies authentic math excellence and 3-year leadership', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const bac = data.baccalaureate || (Array.isArray(data.education) && data.education[1]);
      assert.ok(bac, 'Baccalaureate credential must be documented');
      assert.match(JSON.stringify(bac), /19\.75/);

      const exp = JSON.stringify(data.experience) + JSON.stringify(data.community || []);
      assert.match(exp, /Red Crescent/i);
    });

    it('TC-4.2.5: Recruiter opens dedicated cv.html and triggers print without web navigation clutter', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.ok(hasTestId(html, 'resume-header'), 'cv.html must contain resume-header');
      assert.ok(hasTestId(html, 'candidate-name'), 'cv.html must contain candidate-name');

      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /@media\s+print/i, 'Must have @media print rules');
      assert.match(printCss, /display:\s*none\s*!important/i, 'Must suppress interactive UI on print');
    });
  });

  // =========================================================================
  // Journey 3: Offline / Standalone Evaluation Journey (file:/// double-click) (5 Tests)
  // =========================================================================
  describe('Journey 3: Offline / Standalone Evaluation Journey (file:/// double-click)', () => {
    it('TC-4.3.1: Centralized data core uses UMD pattern to allow zero-server file:/// execution', () => {
      const code = readIfExists('data/portfolio-data.js');
      assert.ok(code, 'data/portfolio-data.js must exist');
      assert.match(code, /typeof\s+module\s*===?\s*['"]object['"]|typeof\s+module\s*!==\s*['"]undefined['"]|module\.exports\s*=/i,
        'Must support CommonJS / module.exports');
      assert.match(code, /PORTFOLIO_DATA/i, 'Must attach to PORTFOLIO_DATA for browser scripts');
    });

    it('TC-4.3.2: HTML files reference stylesheets and scripts using relative paths', () => {
      const indexHtml = readIfExists('index.html');
      assert.ok(indexHtml, 'index.html must exist (Milestone M3)');
      // Must not use absolute root paths like href="/css/style.css" which fail on file:///
      assert.doesNotMatch(indexHtml, /href=["']\/(css|js|assets|data)/i,
        'index.html must use relative paths for local file:/// compatibility');
      assert.doesNotMatch(indexHtml, /src=["']\/(css|js|assets|data)/i,
        'index.html script tags must use relative paths for local file:/// compatibility');
    });

    it('TC-4.3.3: Verified candidate portrait photo exists on local filesystem', () => {
      const photo1 = readIfExists('photo.jpg');
      const photo2 = readIfExists('my photo.jpeg');
      assert.ok(photo1 !== null || photo2 !== null, 'Candidate photo must exist locally in workspace');
    });

    it('TC-4.3.4: Typography relies on robust system font stacks without blocking external CDN fonts', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/cv.css') || readIfExists('css/base.css');
      assert.ok(css, 'CSS files must exist');
      assert.match(css, /font-family:[^;]*(system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|Roboto|sans-serif)/i,
        'Must specify reliable system font stack for offline/firewalled environments');
    });

    it('TC-4.3.5: cv.html renders completely offline with inline print trigger', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.doesNotMatch(html, /<script[^>]*src=["']https:\/\//i,
        'cv.html must not depend on external CDN script blockers');
    });
  });

});
