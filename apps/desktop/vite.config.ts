import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Tauri's custom protocol (asset://) does not return CORS headers,
// so the crossorigin attribute on <link> tags blocks CSS from loading.
// This plugin strips crossorigin from stylesheet links in the final HTML.
function removeCrossoriginCss(): import('vite').Plugin {
  return {
    name: 'remove-crossorigin-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /(<link[^>]*rel="stylesheet"[^>]*)\s+crossorigin(?:="[^"]*")?([^>]*>)/gi,
        '$1$2',
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), removeCrossoriginCss()],

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
      // '@' resolves to web/src/ — the desktop app shares ALL UI/components/hooks
      // with the web PWA. Desktop-specific files in ./src/ are imported via
      // relative paths (e.g. './adapters/GanCubeAdapterTauri').
      '@': path.resolve(__dirname, '../web/src'),

      // Replace GanCubeAdapter (Web Bluetooth) with GanCubeAdapterTauri
      // (Rust btleplug) for ALL imports across the desktop app.
      // Cero modificaciones en apps/web/ — el alias solo aplica al build de desktop.
      '@cubeforge/hardware-hal': path.resolve(
        __dirname,
        './src/hardware-hal-override.ts',
      ),

      // Replace sqlite-wasm + OPFS with tauri-plugin-sql (native SQLite).
      // The Tauri custom protocol cannot send the COOP/COEP headers required
      // for OPFS, so the web database falls back to in-memory storage.
      // This alias makes the desktop app use a native .db file in AppData.
      '@cubeforge/database': path.resolve(
        __dirname,
        './src/database-override.ts',
      ),
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
