/// <reference types="vite/client" />

// Build-time defines from vite.config.ts — inlined into the bundle at build
// time: the app version from apps/web/package.json and the short git SHA of
// the commit being built (from VERCEL_GIT_COMMIT_SHA on Vercel, else local
// git HEAD).
declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
