/* global document, window, MutationObserver */

// Dynamic theme-color: keeps the browser chrome in sync with the app theme.
// Light canvas = #f8f9fa, dark canvas = #14171b — mirror of LIGHT_CANVAS /
// DARK_CANVAS in src/theme/themeColors.ts (public/ files can't import, so
// these stay in sync by convention). Watches the `.dark` class that
// next-themes toggles on <html> (covers user + system theme changes).
// Lives in a separate file (not inline) so the Content-Security-Policy can
// use `script-src 'self'` without 'unsafe-inline'.
(function () {
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  var LIGHT = '#f8f9fa';
  var DARK = '#14171b';
  function apply() {
    meta.setAttribute(
      'content',
      document.documentElement.classList.contains('dark') ? DARK : LIGHT,
    );
  }
  apply();
  if (window.MutationObserver) {
    new MutationObserver(apply).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
})();
