import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Temporary config for browser debugging (no self-signed SSL, which is
// blocked by the user's Kaspersky proxy). Keep the cross-origin isolation
// headers so OPFS/SharedArrayBuffer (the SQLite worker) still works.
export default defineConfig({
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  resolve: {
    alias: [
      { find: '@/components/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/components') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  plugins: [react()],
})
