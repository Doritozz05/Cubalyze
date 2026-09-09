/* global document, window, localStorage */

// Pre-paint theme bootstrap: applies the saved/system dark mode to <html>
// BEFORE the app bundle loads, so the root loader and first paint match the
// user's theme (no light/dark flash). Mirrors next-themes' own resolution
// (storageKey "theme" + system fallback).
// Lives in a separate file (not inline) so the Content-Security-Policy can
// use `script-src 'self'` without 'unsafe-inline'.
(function () {
  try {
    var stored = localStorage.getItem('cubeforge-prefs');
    var prefs = stored ? JSON.parse(stored) : {};
    var themePreset = (prefs && prefs.themePreset) || 'default';
    var theme = prefs && prefs.theme ? String(prefs.theme) : 'light';
    var isDark =
      (theme === 'dark') ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches) ||
      (themePreset && themePreset !== 'default' && themePreset !== 'light' &&
        themePreset !== 'system');
    if (isDark) document.documentElement.classList.add('dark');
  } catch {
    /* localStorage unavailable — fall back to the default light theme */
  }
})();
