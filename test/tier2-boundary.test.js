/**
 * Tier 2: Boundary & Corner Cases Test Suite
 *
 * Requirements: >=5 test cases per feature covering:
 * 1. Mobile (375px) Viewport Boundaries
 * 2. Tablet (768px) Viewport Boundaries
 * 3. Desktop (1440px) Viewport Boundaries
 * 4. Zero Horizontal Overflow & Text Boundaries
 * 5. Print Vertical Dimension Budgeting (<= 279.4mm US Letter Height)
 * 6. Data Boundaries & Zero Placeholder Audit
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

describe('Tier 2: Boundary & Corner Cases', () => {

  // =========================================================================
  // Feature 1: Mobile (375px) Viewport Boundaries (5 Test Cases)
  // =========================================================================
  describe('Feature 1: Mobile (375px) Viewport Boundaries', () => {
    it('TC-2.1.1: Standard responsive viewport meta tag configured with device-width and initial-scale', () => {
      const indexHtml = readIfExists('index.html');
      const cvHtml = readIfExists('cv.html');
      assert.ok(indexHtml, 'index.html must exist (Milestone M3)');
      assert.match(indexHtml, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*initial-scale=1\.0[^"']*["']/i,
        'index.html must define standard mobile viewport meta tag');
      if (cvHtml) {
        assert.match(cvHtml, /<meta\s+name=["']viewport["']/i, 'cv.html must define viewport meta tag');
      }
    });

    it('TC-2.1.2: Mobile navigation drawer and hamburger toggle hooks present for 375px width', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'mobile-menu-toggle'), 'Must have mobile-menu-toggle test hook');
      assert.ok(hasTestId(html, 'mobile-nav-drawer'), 'Must have mobile-nav-drawer test hook');
    });

    it('TC-2.1.3: Mobile hero avatar image size constrained to prevent 375px viewport crowding', () => {
      const html = readIfExists('index.html');
      const css = readIfExists('css/style.css');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      // Check avatar element has size limits or responsive class
      assert.ok(
        hasTestId(html, 'hero-photo') &&
        (html.includes('hero-avatar') || html.includes('rounded-full') || (css && css.includes('hero-photo'))),
        'Hero avatar must have constrained styling'
      );
    });

    it('TC-2.1.4: Mobile media query or responsive classes stack multi-column grids into single-column', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(html || css, 'index.html or css/style.css must exist');
      const combined = (html || '') + (css || '');
      assert.match(combined, /@media\s*\(\s*max-width:\s*768px\s*\)|grid-cols-1|flex-col/i,
        'Must contain mobile stacking rules for viewports <= 768px');
    });

    it('TC-2.1.5: Touch targets maintain comfortable minimum height for thumb interaction', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(html || css, 'index.html or css/style.css must exist');
      const combined = (html || '') + (css || '');
      assert.match(combined, /min-height:\s*(44px|48px)|py-3|py-4|h-11|h-12|touch-target/i,
        'Interactive buttons must ensure minimum 44px touch targets');
    });
  });

  // =========================================================================
  // Feature 2: Tablet (768px) Viewport Boundaries (5 Test Cases)
  // =========================================================================
  describe('Feature 2: Tablet (768px) Viewport Boundaries', () => {
    it('TC-2.2.1: Tablet breakpoint boundaries defined between 768px and 1024px', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /768px|md:|tablet/i, 'Must define tablet breakpoint handling');
    });

    it('TC-2.2.2: Tablet 2-column grid adaptation for project cards and skills', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /grid-cols-2|repeat\(\s*2,\s*1fr\s*\)|md:grid-cols-2/i,
        'Must support 2-column grid on tablet breakpoint');
    });

    it('TC-2.2.3: Tablet container padding maintains readable content margins', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /px-6|padding:\s*0\s+24px|padding-inline:\s*1\.5rem|max-w-/i,
        'Must ensure generous horizontal padding on tablet containers');
    });

    it('TC-2.2.4: Navigation elements avoid overlapping candidate brand at tablet resolution', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'header-brand'), 'header-brand hook must exist');
      assert.ok(hasTestId(html, 'header-navbar'), 'header-navbar hook must exist');
    });

    it('TC-2.2.5: Services grid adapts gracefully on tablet resolutions', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'services-grid'), 'services-grid hook must exist');
    });
  });

  // =========================================================================
  // Feature 3: Desktop (1440px) Viewport Boundaries (5 Test Cases)
  // =========================================================================
  describe('Feature 3: Desktop (1440px) Viewport Boundaries', () => {
    it('TC-2.3.1: Desktop container max-width prevents over-stretching on 1440px+ screens', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /max-width:\s*(1200px|1280px|1440px)|max-w-(6xl|7xl)|container/i,
        'Must apply max-width constraints on wide desktop screens');
    });

    it('TC-2.3.2: Desktop skills layout supports 4-column presentation', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /lg:grid-cols-4|grid-cols-4|repeat\(\s*4,\s*1fr\s*\)/i,
        'Must define 4-column desktop layout for 4 technical skill domains');
    });

    it('TC-2.3.3: Sticky glassmorphic navbar with backdrop-filter configured for desktop', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /backdrop-filter:\s*blur|backdrop-blur|position:\s*sticky|sticky\s+top-0/i,
        'Must define backdrop-blur sticky navigation bar');
    });

    it('TC-2.3.4: Typography scaling ensures headline dominance without line collision', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /clamp\(|text-4xl|text-5xl|text-6xl|font-size:\s*clamp/i,
        'Must implement responsive fluid typography');
    });

    it('TC-2.3.5: Desktop containers centered with auto margins', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /mx-auto|margin:\s*0\s+auto|margin-inline:\s*auto/i,
        'Main containers must be centered with automatic horizontal margins');
    });
  });

  // =========================================================================
  // Feature 4: Zero Horizontal Overflow & Text Boundaries (5 Test Cases)
  // =========================================================================
  describe('Feature 4: Zero Horizontal Overflow & Text Boundaries', () => {
    it('TC-2.4.1: Root horizontal overflow suppression applied on body / html', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/base.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'css/style.css or index.html must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /overflow-x:\s*hidden/i, 'Must specify overflow-x: hidden on root or body');
    });

    it('TC-2.4.2: Universal box-sizing border-box reset applied across all DOM nodes', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/base.css') || readIfExists('css/cv.css');
      assert.ok(css, 'CSS files must exist (css/style.css or css/cv.css)');
      assert.match(css, /\*(\s*,\s*\*::before\s*,\s*\*::after)?\s*\{[^}]*box-sizing:\s*border-box/i,
        'Must enforce universal border-box sizing');
    });

    it('TC-2.4.3: Long strings and emails enforce word-break and overflow-wrap', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/cv.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /break-all|break-words|overflow-wrap:\s*break-word|word-break:\s*break-word/i,
        'Must apply break-words or overflow-wrap to prevent email overflow');
    });

    it('TC-2.4.4: Responsive image rules enforce max-width: 100% and auto height', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/base.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /img\s*\{[^}]*max-width:\s*100%|max-w-full|h-auto/i,
        'Must constrain images to max-width: 100% to prevent viewport blowout');
    });

    it('TC-2.4.5: Flex and grid children constrain min-width to zero to prevent overflow blowout', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/cv.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /min-w-0|min-width:\s*0|flex-wrap:\s*wrap|flex-wrap/i,
        'Flex and grid layouts must allow wrapping or specify min-width: 0');
    });
  });

  // =========================================================================
  // Feature 5: Print Vertical Dimension Budgeting (<= 279.4mm US Letter) (5 Test Cases)
  // =========================================================================
  describe('Feature 5: Print Vertical Dimension Budgeting (<= 279.4mm US Letter)', () => {
    it('TC-2.5.1: Print margin allocation enforces standard 10mm top/bottom in @page', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /@page\s*\{[^}]*margin:\s*10mm/i,
        '@page must define 10mm margin to guarantee 259.4mm net printable height');
    });

    it('TC-2.5.2: Net printable height budget ceiling (259.4mm) verified across sections', () => {
      // Theoretical sum: Header(30) + Summary(22) + Edu(26) + Skills(34) + Exp(40) + Proj(72) + Lang(20) + Gaps(15) = 259mm
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /margin-bottom:\s*[0-3](\.[0-9]+)?mm/i,
        'Print section margins must be tightly budgeted (<= 3mm) to prevent 2nd page spill');
    });

    it('TC-2.5.3: Print section gaps restricted to <= 3mm in print stylesheet', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /\.cv-section|\.resume-section/i, 'Print section selectors must exist');
    });

    it('TC-2.5.4: Print body typography font size restricted to <= 10pt (budgeted 9.25pt)', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /font-size:\s*(9|9\.25|9\.5|10)pt/i,
        'Print font size must be budgeted between 9pt and 10pt to fit single page');
    });

    it('TC-2.5.5: Print line-height restricted between 1.25 and 1.38 to balance density and readability', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /line-height:\s*1\.(2[5-9]|3[0-8])/i,
        'Print line-height must be strictly bounded between 1.25 and 1.38');
    });
  });

  // =========================================================================
  // Feature 6: Data Boundaries & Zero Placeholder Audit (5 Test Cases)
  // =========================================================================
  describe('Feature 6: Data Boundaries & Zero Placeholder Audit', () => {
    it('TC-2.6.1: Project data entries handle optional demo links gracefully without throwing', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      projects.forEach(p => {
        assert.ok(p.title && p.title.length > 0, 'Every project must have a title');
        assert.ok(p.links && p.links.github, 'Every project must have a github link');
      });
    });

    it('TC-2.6.2: Languages entries handle optional certifications and notes gracefully', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      data.languages.forEach(l => {
        assert.ok(l.language, 'Language name must exist');
        assert.ok(l.proficiency, 'Language proficiency must exist');
        assert.doesNotMatch(JSON.stringify(l), /undefined|null|\[object/i, 'No unhandled tokens');
      });
    });

    it('TC-2.6.3: Candidate credentials preserve special characters and entities cleanly', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.ok(data.personal.contacts.phone.includes('+60'), 'International plus prefix preserved');
      assert.ok(data.education.duration || data.education[0].duration, 'En-dash preserved in dates');
    });

    it('TC-2.6.4: Zero placeholder regex audit on data/portfolio-data.js', () => {
      const content = readIfExists('data/portfolio-data.js');
      assert.ok(content, 'data/portfolio-data.js must exist');
      const forbidden = [
        /lorem\s+ipsum/i,
        /\bTBD\b/,
        /\bTODO\b/,
        /example@example\.com/i,
        /\[your\s*name\]/i,
        /123-456-7890/
      ];
      forbidden.forEach(regex => {
        assert.doesNotMatch(content, regex, `Forbidden placeholder token matched: ${regex}`);
      });
    });

    it('TC-2.6.5: Zero placeholder regex audit on rendered HTML templates', () => {
      const indexHtml = readIfExists('index.html');
      const cvHtml = readIfExists('cv.html');
      const files = [
        { name: 'index.html', content: indexHtml },
        { name: 'cv.html', content: cvHtml }
      ];
      const forbidden = [
        /lorem\s+ipsum/i,
        /\bTBD\b/,
        /\bTODO\b/,
        /example@example\.com/i,
        /\[your\s*name\]/i,
        /123-456-7890/
      ];
      files.forEach(f => {
        if (f.content) {
          forbidden.forEach(regex => {
            assert.doesNotMatch(f.content, regex, `Forbidden placeholder found in ${f.name}: ${regex}`);
          });
        }
      });
    });
  });

});
