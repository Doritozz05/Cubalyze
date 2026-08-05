/* global document, window, localStorage */

// Pre-paint theme bootstrap: applies the saved/system dark mode to <html>
// BEFORE the app bundle loads, so the root loader and first paint match the
// user's theme (no light/dark flash). Mirrors next-themes' own resolution
// (storageKey "theme" + system fallback).
// Lives in a separate file (not inline) so the Content-Security-Policy can
// use `script-src 'self'` without 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('theme');
    var isDark =
      t === 'dark' ||
      ((!t || t === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch {
    /* localStorage unavailable — fall back to the default light theme */
  }
})();
