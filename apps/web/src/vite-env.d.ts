/// <reference types="vite/client" />

// Build-time define from vite.config.ts (`define.__APP_VERSION__`) — the app
// version from apps/web/package.json, inlined into the bundle at build time.
declare const __APP_VERSION__: string
