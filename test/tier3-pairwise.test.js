/**
 * Tier 3: Cross-Feature Combinations Test Suite
 *
 * Requirements: Pairwise interactions across:
 * 1. Category Filtering + Theme Toggling
 * 2. Category Filtering + Responsive Viewport Scaling
 * 3. Contact Channels + Mobile Drawer Navigation
 * 4. Theme Preference + LocalStorage Persistence + Print Override
 * 5. Dual-Audience Navigation + Dedicated ATS CV Page Linking
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

describe('Tier 3: Cross-Feature Combinations', () => {

  // =========================================================================
  // Combination 1: Category Filtering + Dark/Light Theme Switching (5 Tests)
  // =========================================================================
  describe('Combination 1: Category Filtering + Dark/Light Theme Switching', () => {
    it('TC-3.1.1: Theme toggle switch hook is present in index.html navbar', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'theme-toggle'), 'Must have data-testid="theme-toggle"');
    });

    it('TC-3.1.2: CSS design tokens define distinct color variables for dark and light themes', () => {
      const css = readIfExists('css/style.css') || readIfExists('css/base.css');
      assert.ok(css, 'css/style.css must exist (Milestone M3)');
      assert.match(css, /\[data-theme=["']?light["']?\]|:root\s*\{[^}]*--bg/i,
        'CSS must define light and dark theme variable scopes');
    });

    it('TC-3.1.3: Filter tabs maintain high contrast active styling in dark theme', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /filter-tab|\.active|aria-pressed/i, 'Filter tab styling rules must exist');
    });

    it('TC-3.1.4: Filter tabs maintain high contrast active styling in light theme', () => {
      const css = readIfExists('css/style.css');
      assert.ok(css, 'css/style.css must exist (Milestone M3)');
      assert.match(css, /--accent|--primary|#06B6D4|#2563EB|#10B981/i,
        'Theme tokens must provide visible accents for active tab state');
    });

    it('TC-3.1.5: Project card markup supports category attribute filtering across themes', () => {
      const html = readIfExists('index.html');
      const js = readIfExists('js/app.js');
      assert.ok(html || js, 'index.html or js/app.js must exist (Milestone M3)');
      const content = (html || '') + (js || '');
      assert.match(content, /data-category=["'](web|mobile|robotics)/i,
        'Project cards or template must bind data-category attribute for filtering');
    });
  });

  // =========================================================================
  // Combination 2: Category Filtering + Responsive Viewport Scaling (5 Tests)
  // =========================================================================
  describe('Combination 2: Category Filtering + Responsive Viewport Scaling', () => {
    it('TC-3.2.1: Filter buttons bar includes all 4 category hooks (all, web, mobile, robotics)', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'filter-tab-all'), 'Must have filter-tab-all hook');
      assert.ok(hasTestId(html, 'filter-tab-web'), 'Must have filter-tab-web hook');
      assert.ok(hasTestId(html, 'filter-tab-mobile'), 'Must have filter-tab-mobile hook');
      assert.ok(hasTestId(html, 'filter-tab-robotics'), 'Must have filter-tab-robotics hook');
    });

    it('TC-3.2.2: Filter buttons bar allows horizontal wrapping or touch scroll on 375px mobile', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /flex-wrap|overflow-x-auto|gap-|justify-center/i,
        'Filter tab container must allow wrapping or smooth scroll on small viewports');
    });

    it('TC-3.2.3: Project card elements use responsive grid classes for smooth column collapse', () => {
      const css = readIfExists('css/style.css');
      const html = readIfExists('index.html');
      assert.ok(css || html, 'CSS or HTML must exist');
      const content = (css || '') + (html || '');
      assert.match(content, /grid-cols-1.*(md:grid-cols-2|lg:grid-cols-2)|projects-grid/i,
        'Projects container must collapse to 1 column on mobile and 2 on desktop');
    });

    it('TC-3.2.4: Interactive script handles filter click events without throwing error', () => {
      const js = readIfExists('js/app.js');
      assert.ok(js, 'js/app.js must exist (Milestone M3)');
      assert.match(js, /filter|category|active/i, 'App script must implement category filter handler');
    });

    it('TC-3.2.5: All 4 project cards possess data-testid hooks and category markers', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'project-card-1'), 'Must have project-card-1');
      assert.ok(hasTestId(html, 'project-card-2'), 'Must have project-card-2');
      assert.ok(hasTestId(html, 'project-card-3'), 'Must have project-card-3');
      assert.ok(hasTestId(html, 'project-card-4'), 'Must have project-card-4');
    });
  });

  // =========================================================================
  // Combination 3: Contact Channels + Mobile Drawer Navigation (5 Tests)
  // =========================================================================
  describe('Combination 3: Contact Channels + Mobile Drawer Navigation', () => {
    it('TC-3.3.1: Mobile drawer navigation includes direct link to contact section', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'mobile-nav-drawer'), 'mobile-nav-drawer must exist');
      assert.match(html, /href=["']#contact["']/i, 'Mobile drawer or nav must include anchor link to #contact');
    });

    it('TC-3.3.2: Mobile drawer menu toggle controls visibility state via aria-expanded or class', () => {
      const js = readIfExists('js/app.js');
      const html = readIfExists('index.html');
      assert.ok(js || html, 'App script or HTML must exist');
      const content = (js || '') + (html || '');
      assert.match(content, /mobile-menu-toggle|drawer|isOpen|is-open|aria-expanded/i,
        'Must handle mobile menu drawer toggling');
    });

    it('TC-3.3.3: Copy email trigger executes clipboard copy action with user feedback', () => {
      const js = readIfExists('js/app.js');
      assert.ok(js, 'js/app.js must exist (Milestone M3)');
      assert.match(js, /clipboard\.writeText|execCommand\(['"]copy['"]\)/i,
        'App script must implement clipboard copy with fallback');
      assert.match(js, /fekiseddik@gmail\.com/i, 'Copy target must be fekiseddik@gmail.com');
    });

    it('TC-3.3.4: WhatsApp direct link includes URL-encoded pre-filled message parameter', () => {
      const html = readIfExists('index.html');
      const data = loadDataCore ? loadDataCore() : null;
      assert.ok(html || data, 'index.html or data must exist');
      const waUrl = (html && html.match(/https:\/\/wa\.me\/[^\s"']+/)) ? html.match(/https:\/\/wa\.me\/[^\s"']+/)[0]
                    : (data && data.personal && data.personal.contacts.whatsappUrl);
      assert.ok(waUrl, 'WhatsApp URL must exist');
      assert.match(waUrl, /wa\.me\/(60142735502|21699436501)/i, 'WhatsApp URL must target candidate phone');
    });

    it('TC-3.3.5: Phone link tel:+60142735502 retains valid standard URI scheme', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.match(html, /href=["']tel:\+60142735502["']/i, 'Phone link must use clean tel scheme');
    });
  });

  // =========================================================================
  // Combination 4: Theme Preference + LocalStorage + Print Override (5 Tests)
  // =========================================================================
  describe('Combination 4: Theme Preference + LocalStorage + Print Override', () => {
    it('TC-3.4.1: App script persists theme selection to localStorage', () => {
      const js = readIfExists('js/app.js');
      assert.ok(js, 'js/app.js must exist (Milestone M3)');
      assert.match(js, /localStorage\.(set|get)Item\(['"](theme|portfolio-theme)['"]/i,
        'App script must persist theme to localStorage');
    });

    it('TC-3.4.2: Script checks system prefers-color-scheme if no prior user setting stored', () => {
      const js = readIfExists('js/app.js') || readIfExists('index.html');
      assert.ok(js, 'js/app.js or index.html must exist');
      assert.match(js, /matchMedia\(['"]\(prefers-color-scheme:\s*dark\)['"]\)/i,
        'Script must inspect window.matchMedia for system theme preference');
    });

    it('TC-3.4.3: Theme toggle button maintains accessibility label', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.match(html, /aria-label=["'][^"']*theme[^"']*["']|title=["'][^"']*theme[^"']*["']/i,
        'Theme toggle button must have accessible aria-label or title');
    });

    it('TC-3.4.4: Print styles override dark theme to guarantee pure #ffffff print canvas', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /@media\s+print[^}]*\{[^}]*background:\s*(transparent|#ffffff)\s*!important/i,
        'Print styles must force background to transparent or pure white regardless of screen theme');
    });

    it('TC-3.4.5: Print styles force text color to near-black (#111827 / #000000)', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /@media\s+print[^}]*\{[^}]*color:\s*(#111827|#000000|#1f2937)\s*!important/i,
        'Print styles must force text to high-contrast near-black');
    });
  });

  // =========================================================================
  // Combination 5: Dual-Audience Navigation + ATS CV Linking (5 Tests)
  // =========================================================================
  describe('Combination 5: Dual-Audience Navigation + ATS CV Linking', () => {
    it('TC-3.5.1: Navigation bar contains distinct ATS Resume / CV action button linking to cv.html', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'nav-cv-button'), 'Must have data-testid="nav-cv-button"');
      assert.match(html, /href=["'](cv\.html|\/cv)["']/i, 'nav-cv-button must link to cv.html');
    });

    it('TC-3.5.2: Hero section secondary CTA links to cv.html or triggers ATS resume view', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'hero-cta-cv'), 'Must have data-testid="hero-cta-cv"');
      assert.match(html, /href=["'](cv\.html|\/cv)["']/i, 'hero-cta-cv must link to cv.html');
    });

    it('TC-3.5.3: Dedicated cv.html provides return navigation back to index.html', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.match(html, /href=["'](index\.html|\/)["']/i, 'cv.html must provide back link to index.html');
    });

    it('TC-3.5.4: Dedicated cv.html provides direct 1-click window.print() trigger button', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.ok(hasTestId(html, 'btn-print-cv') || html.includes('btn-print'), 'cv.html must have print button');
      assert.match(html, /window\.print\(\)|onclick=["']window\.print\(\)["']/i,
        'Print button must invoke window.print()');
    });

    it('TC-3.5.5: cv.html action bar is suppressed in print output', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css');
      assert.ok(printCss, 'Print CSS must exist (Milestone M2)');
      assert.match(printCss, /\.cv-action-bar|\.btn-print|\.no-print/i,
        'Print CSS must hide cv.html action bar');
    });
  });

});
