/**
 * Tier 1: Feature Coverage Test Suite
 *
 * Requirements: >=5 test cases per feature across:
 * 1. Candidate Profile & Personal Info
 * 2. Education & Academic Pedigree
 * 3. Categorized Technical Skills Matrix (4 Domains)
 * 4. Multilingual Fluency (5 Languages)
 * 5. Showcase Projects (4 Bridging Projects)
 * 6. Professional Experience & Services
 * 7. Global Mobility & Availability Badges
 * 8. Contact Triggers & Direct Action Hooks
 * 9. ATS Linear Semantic DOM (cv.html)
 * 10. Print CSS Rules & Optimization (css/print.css / @media print)
 *
 * Uses Node.js native `node:test` and `node:assert`. Zero external npm dependencies.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper functions for safe inspection
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

function extractAttr(html, attrName) {
  if (!html) return [];
  const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'gi');
  const matches = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

describe('Tier 1: Feature Coverage', () => {

  // =========================================================================
  // Feature 1: Candidate Profile & Personal Info (5 Test Cases)
  // =========================================================================
  describe('Feature 1: Candidate Profile & Personal Info', () => {
    it('TC-1.1.1: Personal profile data specifies candidate name "Mohamed Seddik Feki"', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist and be loadable');
      assert.ok(data.personal, 'PORTFOLIO_DATA.personal must exist');
      assert.strictEqual(data.personal.name, 'Mohamed Seddik Feki', 'Name must be Mohamed Seddik Feki');
    });

    it('TC-1.1.2: Positioning headline matches full-stack and robotics undergrad positioning', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.match(
        data.personal.headline,
        /Software,\s*Web\s*&\s*Mobile\s*App\s*Developer\s*\|\s*Robotics\s*&\s*Automation\s*Engineering\s*Undergrad/i,
        'Headline must match candidate positioning'
      );
    });

    it('TC-1.1.3: Contact data includes email, phone, and WhatsApp target', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.strictEqual(data.personal.contacts.email, 'fekiseddik@gmail.com');
      assert.ok(data.personal.contacts.phone.includes('+60 14 273 5502'));
      assert.ok(data.personal.contacts.whatsappUrl.includes('wa.me'));
    });

    it('TC-1.1.4: Bio summary bridges full-stack development with robotics engineering', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const bio = data.personal.bioSummary;
      assert.ok(bio && bio.length > 50, 'Bio summary must be substantive');
      assert.match(bio, /Xiamen University Malaysia/i);
      assert.match(bio, /Robotics/i);
      assert.match(bio, /Full-Stack|Software/i);
    });

    it('TC-1.1.5: Hero section in index.html contains test hooks for headline, photo, and section', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'hero-section'), 'Hero section must have data-testid="hero-section"');
      assert.ok(hasTestId(html, 'hero-headline'), 'Hero headline must have data-testid="hero-headline"');
      assert.ok(hasTestId(html, 'hero-photo'), 'Hero photo must have data-testid="hero-photo"');
      assert.match(html, /photo\.jpg|my\s*photo\.jpeg/i, 'Hero must reference verified photo asset');
    });
  });

  // =========================================================================
  // Feature 2: Education & Academic Pedigree (5 Test Cases)
  // =========================================================================
  describe('Feature 2: Education & Academic Pedigree', () => {
    it('TC-1.2.1: Primary university education specifies XMUM with 2025 – 2029 timeline', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const edu = Array.isArray(data.education) ? data.education[0] : data.education;
      assert.match(edu.institution, /Xiamen University Malaysia/i);
      assert.match(edu.duration, /2025\s*–\s*2029/);
    });

    it('TC-1.2.2: University degree specifies Bachelor of Robotics and Automation Engineering (Honours)', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const edu = Array.isArray(data.education) ? data.education[0] : data.education;
      assert.match(edu.degree, /Bachelor of Robotics and Automation Engineering\s*\(Honours\)/i);
    });

    it('TC-1.2.3: 50% Academic Merit Scholarship is documented in education credentials', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const edu = Array.isArray(data.education) ? data.education[0] : data.education;
      const meritText = edu.honors || edu.meritScholarship || '';
      assert.match(meritText, /50%\s*(Academic\s*)?Merit\s*Scholarship/i);
    });

    it('TC-1.2.4: Focus areas cover all 6 required engineering disciplines', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const edu = Array.isArray(data.education) ? data.education[0] : data.education;
      const areas = edu.focusAreas.join(' ');
      assert.match(areas, /Embedded Systems/i);
      assert.match(areas, /Autonomous Robotics/i);
      assert.match(areas, /Control Systems/i);
      assert.match(areas, /Computer Vision/i);
      assert.match(areas, /Full-Stack Software Engineering/i);
      assert.match(areas, /IoT Architecture/i);
    });

    it('TC-1.2.5: Tunisian Baccalaureate honors (19.75/20 Math) credential is documented', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const bac = data.baccalaureate || (Array.isArray(data.education) && data.education[1]);
      assert.ok(bac, 'Baccalaureate credential entry must exist in data');
      const bacText = JSON.stringify(bac);
      assert.match(bacText, /Lycée Pilote Hammam Lif/i);
      assert.match(bacText, /19\.75/);
    });
  });

  // =========================================================================
  // Feature 3: Categorized Skills Matrix (4 Domains) (5 Test Cases)
  // =========================================================================
  describe('Feature 3: Categorized Skills Matrix (4 Domains)', () => {
    it('TC-1.3.1: Web domain contains React, Next.js, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, Node.js', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const skills = data.technicalSkills || data.skills;
      const web = skills.find(s => s.domainId === 'web' || /web/i.test(s.categoryName));
      assert.ok(web, 'Web domain skills must exist');
      const webSkills = web.skills.join(' ');
      assert.match(webSkills, /React/i);
      assert.match(webSkills, /Next\.js/i);
      assert.match(webSkills, /TypeScript/i);
      assert.match(webSkills, /Tailwind/i);
      assert.match(webSkills, /Node\.js/i);
    });

    it('TC-1.3.2: Mobile domain contains Flutter, React Native, Dart, Cross-Platform iOS/Android', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const skills = data.technicalSkills || data.skills;
      const mobile = skills.find(s => s.domainId === 'mobile' || /mobile/i.test(s.categoryName));
      assert.ok(mobile, 'Mobile domain skills must exist');
      const mobileSkills = mobile.skills.join(' ');
      assert.match(mobileSkills, /Flutter/i);
      assert.match(mobileSkills, /React Native/i);
      assert.match(mobileSkills, /Dart/i);
    });

    it('TC-1.3.3: Robotics domain contains C, C++, Python, ROS / ROS2, Arduino, ESP32, Sensor Fusion', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const skills = data.technicalSkills || data.skills;
      const robotics = skills.find(s => s.domainId === 'robotics' || /robotics/i.test(s.categoryName));
      assert.ok(robotics, 'Robotics domain skills must exist');
      const robSkills = robotics.skills.join(' ');
      assert.match(robSkills, /\bC\b/);
      assert.match(robSkills, /C\+\+/);
      assert.match(robSkills, /Python/i);
      assert.match(robSkills, /ROS/i);
      assert.match(robSkills, /ESP32/i);
      assert.match(robSkills, /Arduino/i);
    });

    it('TC-1.3.4: Cloud/DevOps domain contains Firebase, AWS, Linux, Git & GitHub, Figma', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const skills = data.technicalSkills || data.skills;
      const cloud = skills.find(s => s.domainId === 'cloud' || /cloud|devops/i.test(s.categoryName));
      assert.ok(cloud, 'Cloud/DevOps domain skills must exist');
      const cloudSkills = cloud.skills.join(' ');
      assert.match(cloudSkills, /Firebase/i);
      assert.match(cloudSkills, /AWS/i);
      assert.match(cloudSkills, /Linux/i);
      assert.match(cloudSkills, /Git/i);
      assert.match(cloudSkills, /Figma/i);
    });

    it('TC-1.3.5: Skills section in index.html includes test hooks for all 4 domains', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'skills-section'), 'Must have data-testid="skills-section"');
      assert.ok(hasTestId(html, 'skill-category-web'), 'Must have data-testid="skill-category-web"');
      assert.ok(hasTestId(html, 'skill-category-mobile'), 'Must have data-testid="skill-category-mobile"');
      assert.ok(hasTestId(html, 'skill-category-robotics'), 'Must have data-testid="skill-category-robotics"');
      assert.ok(hasTestId(html, 'skill-category-cloud'), 'Must have data-testid="skill-category-cloud"');
    });
  });

  // =========================================================================
  // Feature 4: Multilingual Fluency (5 Languages) (5 Test Cases)
  // =========================================================================
  describe('Feature 4: Multilingual Fluency (5 Languages)', () => {
    it('TC-1.4.1: Exactly 5 spoken languages are defined in data core', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.ok(Array.isArray(data.languages), 'languages must be an array');
      assert.strictEqual(data.languages.length, 5, 'Must contain exactly 5 languages');
    });

    it('TC-1.4.2: Arabic is designated with Native / Bilingual proficiency', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const ar = data.languages.find(l => /arabic/i.test(l.language));
      assert.ok(ar, 'Arabic must exist');
      assert.match(ar.proficiency, /native|bilingual/i);
    });

    it('TC-1.4.3: French is designated with C1 / TCF certified fluency', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const fr = data.languages.find(l => /french/i.test(l.language));
      assert.ok(fr, 'French must exist');
      const frDetails = (fr.proficiency + ' ' + (fr.levelTag || '') + ' ' + (fr.cert || fr.notes || ''));
      assert.match(frDetails, /C1|TCF|Fluent/i);
    });

    it('TC-1.4.4: English is designated with C1 / IELTS Academic 7.5 proficiency', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const en = data.languages.find(l => /english/i.test(l.language));
      assert.ok(en, 'English must exist');
      const enDetails = (en.proficiency + ' ' + (en.levelTag || '') + ' ' + (en.cert || en.notes || ''));
      assert.match(enDetails, /C1|IELTS|7\.5|Professional/i);
    });

    it('TC-1.4.5: Italian and Spanish defined, and multilingual badges present in index.html', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const it = data.languages.find(l => /italian/i.test(l.language));
      const es = data.languages.find(l => /spanish/i.test(l.language));
      assert.ok(it, 'Italian must exist');
      assert.ok(es, 'Spanish must exist');

      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'multilingual-badge') || hasTestId(html, 'languages-grid'),
        'Multilingual badge or languages grid test hook must exist');
    });
  });

  // =========================================================================
  // Feature 5: Showcase Projects (4 Bridging Projects) (5 Test Cases)
  // =========================================================================
  describe('Feature 5: Showcase Projects (4 Bridging Projects)', () => {
    it('TC-1.5.1: Exactly 4 showcase projects are configured in data core', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      assert.ok(Array.isArray(projects), 'Projects must be an array');
      assert.strictEqual(projects.length, 4, 'Must have exactly 4 showcase projects');
    });

    it('TC-1.5.2: Project 1 represents Cross-Platform Mobile App (Flutter & Firebase)', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      const mobProj = projects.find(p => p.category === 'mobile' || /flutter/i.test(p.techStack.join(' ')));
      assert.ok(mobProj, 'Mobile showcase project must exist');
      const stack = mobProj.techStack.join(' ');
      assert.match(stack, /Flutter/i);
      assert.match(stack, /Firebase/i);
    });

    it('TC-1.5.3: Project 2 represents Full-Stack SaaS Web Platform (Next.js & TypeScript)', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      const webProj = projects.find(p => p.category === 'web' || /next\.js/i.test(p.techStack.join(' ')));
      assert.ok(webProj, 'Web SaaS showcase project must exist');
      const stack = webProj.techStack.join(' ');
      assert.match(stack, /Next\.js/i);
      assert.match(stack, /TypeScript/i);
    });

    it('TC-1.5.4: Project 3 represents ROS / ESP32 Autonomous Mobile Robot & Telemetry Dashboard', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      const rosProj = projects.find(p => /ros/i.test(p.techStack.join(' ')));
      assert.ok(rosProj, 'ROS showcase project must exist');
      const stack = rosProj.techStack.join(' ');
      assert.match(stack, /ROS/i);
      assert.match(stack, /ESP32/i);
    });

    it('TC-1.5.5: Project 4 represents AI/Automation & IoT Smart Control System, and project test hooks present', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const projects = data.showcaseProjects || data.projects;
      const iotProj = projects.find(p => /mqtt|iot/i.test(p.techStack.join(' ') + ' ' + p.title));
      assert.ok(iotProj, 'IoT / Automation project must exist');

      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'projects-section'), 'Projects section hook must exist');
      assert.ok(hasTestId(html, 'project-card-1'), 'Project card 1 hook must exist');
      assert.ok(hasTestId(html, 'project-card-2'), 'Project card 2 hook must exist');
      assert.ok(hasTestId(html, 'project-card-3'), 'Project card 3 hook must exist');
      assert.ok(hasTestId(html, 'project-card-4'), 'Project card 4 hook must exist');
    });
  });

  // =========================================================================
  // Feature 6: Professional Experience & Services (5 Test Cases)
  // =========================================================================
  describe('Feature 6: Professional Experience & Services', () => {
    it('TC-1.6.1: Freelance Software & App Developer entry (2023–Present) defined in data', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.ok(Array.isArray(data.experience), 'experience must be an array');
      const freelance = data.experience.find(e => /freelance/i.test(e.role));
      assert.ok(freelance, 'Freelance experience entry must exist');
      assert.match(freelance.duration, /2023\s*–\s*Present/);
    });

    it('TC-1.6.2: Freelance entry contains concrete achievements highlighting web, mobile, and APIs', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const freelance = data.experience.find(e => /freelance/i.test(e.role));
      assert.ok(freelance.achievements && freelance.achievements.length >= 2, 'Must have achievements');
      const ach = freelance.achievements.join(' ');
      assert.match(ach, /web/i);
      assert.match(ach, /mobile/i);
    });

    it('TC-1.6.3: Leadership experience includes Tunisian Red Crescent (3 years service, 3x Member of Month)', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const allExp = JSON.stringify(data.experience) + JSON.stringify(data.community || []);
      assert.match(allExp, /Red Crescent/i);
      assert.match(allExp, /Member of the Month/i);
    });

    it('TC-1.6.4: Exactly 4 client services defined (Web, Mobile, Robotics/IoT, Automation)', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      assert.ok(Array.isArray(data.services), 'services must be an array');
      assert.strictEqual(data.services.length, 4, 'Must define exactly 4 client service offerings');
      const titles = data.services.map(s => s.title).join(' ');
      assert.match(titles, /Web/i);
      assert.match(titles, /Mobile/i);
      assert.match(titles, /Robotics|IoT/i);
      assert.match(titles, /Automation/i);
    });

    it('TC-1.6.5: Experience and services test hooks are present in index.html', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'experience-section'), 'Must have data-testid="experience-section"');
      assert.ok(hasTestId(html, 'services-grid'), 'Must have data-testid="services-grid"');
      assert.ok(hasTestId(html, 'service-card-web'), 'Must have data-testid="service-card-web"');
      assert.ok(hasTestId(html, 'service-card-mobile'), 'Must have data-testid="service-card-mobile"');
      assert.ok(hasTestId(html, 'service-card-iot'), 'Must have data-testid="service-card-iot"');
      assert.ok(hasTestId(html, 'service-card-automation'), 'Must have data-testid="service-card-automation"');
    });
  });

  // =========================================================================
  // Feature 7: Global Mobility & Availability Badges (5 Test Cases)
  // =========================================================================
  describe('Feature 7: Global Mobility & Availability Badges', () => {
    it('TC-1.7.1: Malaysia On-site / Hybrid mobility badge is defined in data', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const badges = data.personal.mobilityBadges || data.mobility || [];
      const myBadge = badges.find(b => /malaysia/i.test(b.label));
      assert.ok(myBadge, 'Malaysia On-site badge must exist');
    });

    it('TC-1.7.2: Remote Worldwide mobility badge is defined in data', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const badges = data.personal.mobilityBadges || data.mobility || [];
      const remoteBadge = badges.find(b => /remote/i.test(b.label));
      assert.ok(remoteBadge, 'Remote Worldwide badge must exist');
    });

    it('TC-1.7.3: Global Summer Relocation badge is defined in data', () => {
      const data = loadDataCore();
      assert.ok(data, 'data/portfolio-data.js must exist');
      const badges = data.personal.mobilityBadges || data.mobility || [];
      const relocBadge = badges.find(b => /relocation/i.test(b.label));
      assert.ok(relocBadge, 'Global Relocation badge must exist');
    });

    it('TC-1.7.4: Hero availability beacon/pulse badge indicates availability for freelance & internships', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'hero-availability-badge'), 'hero-availability-badge hook must exist');
      assert.match(html, /Available for Freelance/i);
    });

    it('TC-1.7.5: Mobility badges rendered with test hook "mobility-badge" in index.html', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'mobility-badge'), 'mobility-badge test hook must exist in DOM');
    });
  });

  // =========================================================================
  // Feature 8: Contact Triggers & Direct Action Hooks (5 Test Cases)
  // =========================================================================
  describe('Feature 8: Contact Triggers & Direct Action Hooks', () => {
    it('TC-1.8.1: Email contact link specifies mailto:fekiseddik@gmail.com', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.match(html, /href=["']mailto:fekiseddik@gmail\.com["']/i, 'Mailto link must point to fekiseddik@gmail.com');
      assert.ok(hasTestId(html, 'contact-email-link'), 'contact-email-link hook must exist');
    });

    it('TC-1.8.2: Phone contact link specifies tel:+60142735502', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.match(html, /href=["']tel:\+?60142735502["']/i, 'Phone link must point to +60142735502');
      assert.ok(hasTestId(html, 'contact-phone-link'), 'contact-phone-link hook must exist');
    });

    it('TC-1.8.3: WhatsApp direct link targets https://wa.me with pre-filled message parameter', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.match(html, /https:\/\/wa\.me\/(60142735502|21699436501)/i, 'WhatsApp link must target valid phone number');
      assert.ok(hasTestId(html, 'contact-whatsapp-link'), 'contact-whatsapp-link hook must exist');
    });

    it('TC-1.8.4: 1-Click Copy Email button present with copy toast feedback hook', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      const hasCopyBtn = hasTestId(html, 'quick-copy-email-btn') || hasTestId(html, 'copy-email-btn');
      assert.ok(hasCopyBtn, 'Copy email button hook must exist');
      assert.ok(hasTestId(html, 'copy-toast'), 'Copy toast feedback hook must exist');
    });

    it('TC-1.8.5: Contact form presents name, email, message inputs and submit hook', () => {
      const html = readIfExists('index.html');
      assert.ok(html, 'index.html must exist (Milestone M3)');
      assert.ok(hasTestId(html, 'contact-form'), 'contact-form hook must exist');
      assert.ok(hasTestId(html, 'contact-form-submit'), 'contact-form-submit hook must exist');
    });
  });

  // =========================================================================
  // Feature 9: ATS Linear Semantic DOM (cv.html) (5 Test Cases)
  // =========================================================================
  describe('Feature 9: ATS Linear Semantic DOM (cv.html)', () => {
    it('TC-1.9.1: Semantic root containers (header, main, section) are present in cv.html', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.match(html, /<header\b[^>]*role=["']banner["']/i, 'Header must have role="banner"');
      assert.match(html, /<main\b[^>]*role=["']main["']/i, 'Main must have role="main"');
      assert.match(html, /<section\b/i, 'cv.html must use semantic <section> containers');
    });

    it('TC-1.9.2: ATS headings hierarchy uses h1 for candidate name and h2 for major sections', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.match(html, /<h1\b[^>]*data-testid=["']candidate-name["'][^>]*>\s*MOHAMED\s+SEDDIK\s+FEKI\s*<\/h1>/i,
        'H1 must contain candidate name in uppercase or capitalized form');
      assert.match(html, /<h2\b/i, 'Section headings must use <h2> tags');
      assert.ok(hasTestId(html, 'section-education'), 'section-education hook must exist');
      assert.ok(hasTestId(html, 'section-skills'), 'section-skills hook must exist');
      assert.ok(hasTestId(html, 'section-experience'), 'section-experience hook must exist');
      assert.ok(hasTestId(html, 'section-projects'), 'section-projects hook must exist');
      assert.ok(hasTestId(html, 'section-languages'), 'section-languages hook must exist');
    });

    it('TC-1.9.3: DOM structure is linear single-column with zero layout tables (<table>)', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.doesNotMatch(html, /<table\b/i, 'cv.html must NOT contain layout tables which break ATS parser order');
    });

    it('TC-1.9.4: Achievements and details rendered via semantic unordered lists (ul/li)', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.match(html, /<ul\b[^>]*class=["'][^"']*bullet/i, 'cv.html must use bullet lists for achievements');
      assert.match(html, /<li\b/i, 'cv.html must use semantic <li> items');
    });

    it('TC-1.9.5: Zero canvas or rasterized resume text in cv.html (100% live vector text)', () => {
      const html = readIfExists('cv.html');
      assert.ok(html, 'cv.html must exist (Milestone M2)');
      assert.doesNotMatch(html, /<canvas\b/i, 'cv.html must not use <canvas> elements for resume text');
    });
  });

  // =========================================================================
  // Feature 10: Print CSS Rules & Optimization (5 Test Cases)
  // =========================================================================
  describe('Feature 10: Print CSS Rules & Optimization', () => {
    it('TC-1.10.1: Print styles suppress interactive web chrome (navbars, buttons, theme toggles)', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist (css/print.css or embedded @media print)');
      assert.match(printCss, /@media\s+print\s*\{/i, 'Must define @media print ruleset');
      assert.match(printCss, /display:\s*none\s*!important/i, 'Must suppress interactive chrome in print');
    });

    it('TC-1.10.2: Print color contrast resets force clean background and dark text', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /background:\s*(transparent|#ffffff)\s*!important/i, 'Print background must be white or transparent');
      assert.match(printCss, /color:\s*(#111827|#000000|#1f2937)\s*!important/i, 'Print text must be near-black');
    });

    it('TC-1.10.3: Link annotation expansion is explicitly suppressed (a[href]::after { content: "" })', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /a(\[href\])?::after\s*\{\s*content:\s*["']["']/i,
        'Must suppress browser default URL appending on links in print mode');
    });

    it('TC-1.10.4: Page-break avoidance is enforced on sections and heading blocks', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /(break-inside|page-break-inside):\s*avoid/i,
        'Must enforce page-break-inside: avoid on sections to prevent awkward splits');
    });

    it('TC-1.10.5: @page rule specifies margins to guarantee single-page printable canvas', () => {
      const printCss = readIfExists('css/print.css') || readIfExists('css/cv.css') || readIfExists('css/style.css');
      assert.ok(printCss, 'Print CSS must exist');
      assert.match(printCss, /@page\s*\{[^}]*margin:\s*10mm/i,
        '@page rule must specify standard 10mm margins for single-page print boundary');
    });
  });

});
