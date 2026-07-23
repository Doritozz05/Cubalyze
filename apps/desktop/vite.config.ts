import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // Prevent Vite from watching the Rust source files (avoids infinite HMR loops)
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },

  resolve: {
    alias: {
      // '@' resolves to web/src/ first (shared components/hooks/views),
      // then falls back to desktop/src/ for desktop-specific adapters.
      '@': [
        path.resolve(__dirname, '../web/src'),
        path.resolve(__dirname, './src'),
      ],
    },
  },

  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Exclude sqlite-wasm from optimization — it's loaded in a Web Worker
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});
