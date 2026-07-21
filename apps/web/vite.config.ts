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
    // credentialless = safe for dev (allows cross-origin images/fonts).
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
