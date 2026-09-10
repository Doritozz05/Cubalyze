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
    var root = document.documentElement;
    var isDarkClass = root.classList.contains('dark');
    var _canvas = root.style.getPropertyValue('--canvas').trim() || (isDarkClass ? DARK : LIGHT);
    var ink = root.style.getPropertyValue('--ink').trim() || (isDarkClass ? '#e9ecef' : '#212529');
    var luminance = (function (hex) {
      var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
      if (!m) return null;
      var h = m[1];
      var full = h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h;
      var r = parseInt(full.slice(0, 2), 16);
      var g = parseInt(full.slice(2, 4), 16);
      var b = parseInt(full.slice(4, 6), 16);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    })(ink);
    var isDark = isDarkClass || (luminance !== null && luminance < 0.5);
    meta.setAttribute('content', isDark ? DARK : LIGHT);
  }
  apply();
  if (window.MutationObserver) {
    new MutationObserver(apply).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
})();
