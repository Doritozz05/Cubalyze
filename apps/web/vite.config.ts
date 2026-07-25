import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
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
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
  ],
})
