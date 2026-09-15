import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { LIGHT_CANVAS } from './src/theme/themeColors.js'

// App version for the UI (Settings → Credits → App version). Read from
// package.json at build time (single source of truth) and exposed to the app
// through the __APP_VERSION__ define — importing package.json directly would
// need resolveJsonModule in the node tsconfig and would inline the whole file.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }

// Short build SHA for the same UI: VERCEL_GIT_COMMIT_SHA is set by Vercel
// during the build; locally (dev/preview) fall back to the current git HEAD.
// Changes with EVERY deploy, so users can always confirm they're on the
// latest build — and it doubles as the auto-update test (a new SHA appears
// without a hard refresh once the service worker update lands).
function getBuildSha(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(getBuildSha()),
  },
  server: {
    host: true,
    // Pin the dev port so the OAuth redirect config stays stable: if 5173 is
    // busy, fail loudly instead of silently bumping to 5174/5175 (which would
    // need yet another URL in Supabase's allowed-redirect list).
    port: 5173,
    strictPort: true,
    // Cross-origin isolation headers REQUIRED for OPFS (persistent SQLite).
    // Without these, SharedArrayBuffer is unavailable and the DB falls back
    // to in-memory storage — losing all data on page reload.
    //
    // IMPORTANT: Use 'credentialless' in dev, NOT 'require-corp'.
    // 'require-corp' blocks cross-origin resources (HMR, React DevTools,
    // images, fonts, etc.) that don't send explicit CORP headers, which
    // breaks cross-origin isolation and makes OPFS/SharedArrayBuffer
    // unavailable. 'credentialless' allows these resources to load (without
    // cookies) while still enabling SharedArrayBuffer and OPFS.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    // Explicit HMR config for wss://localhost when basicSsl is active.
    // Prevents WebSocket URL mismatch that causes HMR connection failure.
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      port: 5173,
    },
  },
  preview: {
    host: true,
    // For production preview, 'require-corp' is safer because all bundled
    // assets are same-origin. 'credentialless' also works here but strips
    // credentials from cross-origin requests.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  resolve: {
    alias: [
      // More specific alias must come first: redirect shadcn UI components
      // to the shared @cubeforge/ui package.
      { find: '@/components/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/components') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      // Disable the service worker in dev so it never caches or serves
      // stale ESM modules during HMR. In dev, Vite's own transform pipeline
      // must be the only thing serving /src/* — a stale SW precache entry
      // for a module that was briefly broken (TDZ, syntax error) survives
      // hard refreshes and blocks the dev server from loading. Production
      // builds are unaffected (the SW only registers from the built output).
      devOptions: { enabled: false },
      registerType: 'prompt',
      // SW registration + update handling lives in src/main.tsx (it imports
      // `registerSW` from virtual:pwa-register). Using the virtual module —
      // instead of the generated bare registerSW.js that `injectRegister:
      // 'script'` emits — wires workbox-window for the update prompt.
      // registerType 'prompt' is deliberate: a freshly-deployed worker WAITS
      // instead of reloading the page, so the app never restarts mid-session
      // (the old autoUpdate flow reloaded the moment the new SW activated —
      // even mid-solve). main.tsx shows an "update available" toast and
      // reloads only when the user taps it. injectRegister: false keeps the
      // plugin from also emitting/registering a second, update-less
      // registerSW.js. (No inline script is used, so the strict
      // Content-Security-Policy with script-src 'self' and no 'unsafe-inline'
      // keeps working.)
      injectRegister: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // clientsClaim: when the user applies a pending update, the new
        // worker takes control of the current tab so the reload lands on the
        // new precache. skipWaiting is deliberately NOT set: with it, every
        // new worker self-activates the moment it installs — exactly the
        // "page reloaded by itself" behavior the prompt flow removes.
        clientsClaim: true,
        // Navigation is NetworkFirst below, so the precached index.html is no
        // longer the navigation fallback. Serving navigations from the
        // precache is what made every load stale until the SW auto-reloaded;
        // now each open fetches the latest shell when online and falls back
        // to the last cached page offline.
        navigateFallback: null,
        runtimeCaching: [
          {
            // App shell: always try the network first on load, so a fresh
            // deploy shows immediately; after 4s (or offline) serve the last
            // cached page instead of hanging or erroring.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 16, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            // API/JSON — network-first with a generous timeout (mirrors the
            // plugin's default list, which generateSW otherwise drops).
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'apis',
              expiration: { maxEntries: 16, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'Cubalyze',
        short_name: 'Cubalyze',
        description: 'Smart Cube Training Platform',
        start_url: '/',
        display: 'standalone',
        // Static manifest — the light canvas (the app's no-JS default). The
        // in-page browser bar follows the theme dynamically via theme-color.js.
        theme_color: LIGHT_CANVAS,
        background_color: LIGHT_CANVAS,
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    // `--mode analyze` emits an interactive bundle treemap at dist/report.html
    // (run with: pnpm --filter web exec vite build --mode analyze).
    ...(mode === 'analyze'
      ? [
          visualizer({
            filename: 'dist/report.html',
            gzipSize: true,
            template: 'treemap',
          }),
          visualizer({
            filename: 'dist/report-data.json',
            gzipSize: false,
            template: 'raw-data',
          }),
        ]
      : []),
  ],
  build: {
    // three.js alone is ~600 kB and only needed for 3D views: allow its
    // dedicated chunk without warning noise.
    chunkSizeWarningLimit: 700,
    // ─────────────────────────────────────────────────────────────────────
    // CHUNK SPLITTING — how to add a new group
    // ─────────────────────────────────────────────────────────────────────
    // Chunking is DECLARATIVE: each group below says "modules whose path
    // matches `test` go into the chunk named `name`". `priority` decides
    // which group wins when a module matches several (higher wins; equal
    // priority → the group listed first). Everything else is automatic:
    //
    //   • Components/hooks you add → bundled into the entry or the chunk
    //     that imports them. Nothing to do.
    //   • New widgets → use registerLazy() in widgets/registerAllWidgets.ts
    //     (dynamic import() → automatic lazy chunk). Nothing to do here.
    //   • New small npm deps → caught by the 'vendor' catch-all below.
    //     Nothing to do.
    //
    // You only touch this list in TWO cases. Use these priority tiers:
    //
    //   priority 30  → a BIG library that IS part of the first paint but
    //                  you want in its own named chunk for caching
    //                  (react, three, radix, recharts, framer-motion).
    //   priority 25  → a BIG library used ONLY via dynamic import()
    //                  (e.g. `await import('xlsx')`). Without its own
    //                  group the vendor catch-all would capture it anyway
    //                  and push it into the initial load.
    //   priority 20  → the catch-all. Don't add groups here.
    //   priority 40  → special workarounds only (clsx: Rolldown dedups
    //                  two identical clsx copies into recharts, which pulls
    //                  the whole bundle into the entry — forcing clsx into
    //                  vendor fixes it). Don't touch unless you hit a
    //                  similar dedup issue.
    //
    // Template for a new group (a big dynamic-only dep, e.g. 'papaparse'):
    //
    //   { name: 'papaparse', test: /node_modules[\\/]papaparse[\\/]/, priority: 25 },
    //
    // Verify after building:
    //   pnpm --filter web analyze            → dist/report.html treemap
    //   grep -o 'href="/assets/*.js"' dist/index.html | sort -u  → preloads
    // ─────────────────────────────────────────────────────────────────────
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // clsx: recharts ships its OWN nested clsx copy
            // (recharts@.../node_modules/clsx) while cva uses the top-level
            // one. Rolldown deduplicates the two identical modules, and if the
            // survivor lands in the recharts chunk, vendor (cva) ends up
            // importing from it — dragging ~400 kB of recharts into the
            // initial load. Capturing BOTH copies into vendor (highest
            // priority) keeps recharts fully lazy (it then imports clsx FROM
            // vendor, which is fine).
            { name: 'vendor', test: /node_modules[\\/]clsx[\\/]/, priority: 40 },
            // xlsx (SheetJS) is only used via dynamic import() in
            // exportSolves.ts, but the vendor catch-all below would capture
            // it and push ~820 kB into the initial load. Its own group keeps
            // it in a lazy chunk (loaded only when exporting to Excel).
            { name: 'xlsx', test: /node_modules[\\/]xlsx[\\/]/, priority: 25 },
            // country-flag-icons ships every national flag as a React component
            // (~330 kB). It's only reachable from lazy surfaces (Settings, Profile),
            // but the vendor catch-all would hoist it into the initial load.
            { name: 'country-flags', test: /node_modules[\\/]country-flag-icons[\\/]/, priority: 25 },
            // @dnd-kit is only used by the Algorithms view (lazy) for reordering
            // algorithm lists. Same catch-all problem — keep it out of vendor.
            { name: 'dnd-kit', test: /node_modules[\\/]@dnd-kit[\\/]/, priority: 25 },
            // Specific big libs next (higher priority = checked first).
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-is|scheduler|use-sync-external-store)[\\/]/, priority: 30 },
            // three: the regex also captures three-stdlib (shared "three"
            // prefix) — desirable, they belong together. Both are only
            // reachable from lazily-imported 3D views, so this chunk never
            // loads on the initial page.
            { name: 'three', test: /node_modules[\\/]three/, priority: 30 },
            { name: 'radix', test: /node_modules[\\/]@radix-ui[\\/]/, priority: 30 },
            { name: 'recharts', test: /node_modules[\\/]recharts[\\/]/, priority: 30 },
            { name: 'framer-motion', test: /node_modules[\\/]framer-motion[\\/]/, priority: 30 },
            // Catch-all for every other node_modules module. Lower priority
            // than the specific groups above; clsx only matches this group,
            // so it always lands in vendor and recharts stays fully lazy
            // (recharts imports clsx FROM vendor — fine, vendor is preloaded).
            { name: 'vendor', test: /node_modules/, priority: 20 },
          ],
        },
      },
    },
  },
}))
