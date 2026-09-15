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
    alias: [
      { find: '@/components/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/components') },
      { find: '@', replacement: path.resolve(__dirname, '../web/src') },
      { find: '@cubalyze/hardware-hal', replacement: path.resolve(__dirname, './src/hardware-hal-override.ts') },
      { find: '@cubalyze/database', replacement: path.resolve(__dirname, './src/database-override.ts') },
    ],
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
