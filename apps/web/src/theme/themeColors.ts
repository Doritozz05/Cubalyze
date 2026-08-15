/**
 * Canonical app canvas colors — the single source of truth for every
 * surface that needs a static value: the PWA manifest (built from
 * `vite.config.ts`) and the pre-paint scripts under `public/`, which can't
 * import modules and mirror these values.
 *
 * Mirrors the `--canvas` token in `src/index.css` (light `#f8f9fa`, dark
 * `#14171b`). The PWA manifest is static JSON, so it declares the LIGHT
 * canvas — matching the default `<meta name="theme-color">` before the
 * theme script runs; the browser bar itself follows the theme at runtime
 * via `public/theme-color.js`.
 */
export const LIGHT_CANVAS = "#f8f9fa";
export const DARK_CANVAS = "#14171b";
