import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig(({ mode }) => ({
  server: {
    host: true,
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
      registerType: 'autoUpdate',
      // External registerSW.js instead of an inline <script> so the strict
      // Content-Security-Policy (script-src 'self', no 'unsafe-inline') works.
      injectRegister: 'script',
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'CubeForge',
        short_name: 'CubeForge',
        description: 'Smart Cube Training Platform',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#0f172a',
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
