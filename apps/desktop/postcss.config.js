// Mirrors apps/web/postcss.config.js — required for Tailwind v4 CSS processing.
// The desktop app imports the SAME index.css from the web app, which uses
// @import "tailwindcss" directives that must be processed through PostCSS.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
}
