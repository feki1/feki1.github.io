/**
 * Mohamed Seddik Feki - ATS CV Page Controller (js/cv.js)
 * Binds PORTFOLIO_DATA if dynamically updated and handles print triggers cleanly.
 */

(function () {
  'use strict';

  function initCVPage() {
    var data = (typeof window !== 'undefined' && window.PORTFOLIO_DATA) ? window.PORTFOLIO_DATA : null;
    if (data && data.personal) {
      var nameEl = document.querySelector('[data-testid="candidate-name"]');
      if (nameEl && data.personal.name) {
        nameEl.textContent = data.personal.name.toUpperCase();
      }
      var headlineEl = document.querySelector('[data-testid="candidate-headline"]');
      if (headlineEl && data.personal.headline) {
        headlineEl.textContent = data.personal.headline;
      }
    }

    // Support URL parameter ?print=true for instant PDF export
    if (typeof window !== 'undefined' && window.location && window.location.search.indexOf('print=true') !== -1) {
      setTimeout(function () {
        window.print();
      }, 350);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCVPage);
    } else {
      initCVPage();
    }
  }
})();
