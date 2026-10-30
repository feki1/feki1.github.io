/**
 * Mohamed Seddik Feki - Interactive Portfolio Controller (js/app.js)
 * Handles Category Filtering, Theme Switching (Dark/Light + LocalStorage),
 * Mobile Drawer Menu, 1-Click Copy Email Toast, and Contact Form Mailto Dispatch.
 */

(function () {
  'use strict';

  var EMAIL_TARGET = 'fekiseddik@gmail.com';
  var STORAGE_KEY = 'portfolio-theme';

  // 1. Theme Initialization & Persistence
  function getPreferredTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      // ignore storage errors on strict file:/// contexts
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore
    }
    var toggleBtn = document.querySelector('[data-testid="theme-toggle"]');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', 'Switch theme (current: ' + theme + ')');
      toggleBtn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    }
  }

  function initThemeToggle() {
    var current = getPreferredTheme();
    applyTheme(current);

    var toggleBtn = document.querySelector('[data-testid="theme-toggle"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var active = document.documentElement.getAttribute('data-theme') || 'dark';
        var next = active === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    }
  }

  // 2. Interactive Project Category Filtering
  function initCategoryFilter() {
    var filterButtons = document.querySelectorAll('.filter-tab[data-filter]');
    var projectCards = document.querySelectorAll('.project-card[data-category]');

    if (!filterButtons.length || !projectCards.length) return;

    function filterByCategory(category) {
      filterButtons.forEach(function (btn) {
        var isMatch = btn.getAttribute('data-filter') === category;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });

      projectCards.forEach(function (card) {
        var cardCategory = card.getAttribute('data-category');
        var shouldShow = (category === 'all' || cardCategory === category);
        card.classList.toggle('is-hidden', !shouldShow);
      });
    }

    filterButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var selected = btn.getAttribute('data-filter') || 'all';
        filterByCategory(selected);
      });
    });
  }

  // 3. Mobile Navigation Drawer Toggle
  function initMobileDrawer() {
    var menuToggle = document.querySelector('[data-testid="mobile-menu-toggle"]');
    var drawer = document.querySelector('[data-testid="mobile-nav-drawer"]');
    if (!menuToggle || !drawer) return;

    menuToggle.addEventListener('click', function () {
      var isOpen = drawer.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    var drawerLinks = drawer.querySelectorAll('a');
    drawerLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        drawer.classList.remove('is-open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 4. 1-Click Copy Email & Toast Feedback
  function showToast(message) {
    var toast = document.querySelector('[data-testid="copy-toast"]');
    if (!toast) return;
    toast.textContent = message || 'Email copied: ' + EMAIL_TARGET;
    toast.classList.add('is-visible');
    setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  function copyEmailToClipboard() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(EMAIL_TARGET).then(function () {
        showToast('Copied to clipboard: ' + EMAIL_TARGET);
      }).catch(function () {
        fallbackCopy(EMAIL_TARGET);
      });
    } else {
      fallbackCopy(EMAIL_TARGET);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard: ' + text);
    } catch (err) {
      showToast('Email: ' + text);
    }
    document.body.removeChild(textarea);
  }

  function initCopyEmailButtons() {
    var copyBtns = document.querySelectorAll('[data-testid="quick-copy-email-btn"], [data-testid="copy-email-btn"], .js-copy-email');
    copyBtns.forEach(function (btn) {
      btn.addEventListener('click', copyEmailToClipboard);
    });
  }

  // 5. Contact Form Inquiry Handler
  function initContactForm() {
    var form = document.querySelector('[data-testid="contact-form"]');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameInput = form.querySelector('[name="senderName"]');
      var emailInput = form.querySelector('[name="senderEmail"]');
      var typeInput = form.querySelector('[name="inquiryType"]');
      var msgInput = form.querySelector('[name="message"]');

      var senderName = nameInput ? nameInput.value.trim() : 'Prospective Client / Recruiter';
      var senderEmail = emailInput ? emailInput.value.trim() : '';
      var inquiryType = typeInput ? typeInput.value : 'Project / Internship Inquiry';
      var message = msgInput ? msgInput.value.trim() : '';

      var subject = encodeURIComponent('[' + inquiryType + '] Inquiry from ' + senderName);
      var body = encodeURIComponent(
        'Hello Mohamed,\n\n' +
        message + '\n\n' +
        'Best regards,\n' +
        senderName + (senderEmail ? ' (' + senderEmail + ')' : '')
      );

      showToast('Opening email client for ' + EMAIL_TARGET + '...');
      window.location.href = 'mailto:' + EMAIL_TARGET + '?subject=' + subject + '&body=' + body;
    });
  }

  function initPortfolioApp() {
    initThemeToggle();
    initCategoryFilter();
    initMobileDrawer();
    initCopyEmailButtons();
    initContactForm();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPortfolioApp);
    } else {
      initPortfolioApp();
    }
  }
})();
