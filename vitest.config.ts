import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Robust ESM-safe resolution of this config's own directory (for `resolve.alias`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
    },
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Use forward-slash, relative globs (NOT `path.resolve`-d absolute paths).
      // Two reasons:
      // 1. Micromatch (vitest's glob engine) treats `\\` as an escape character,
      //    so `path.resolve` on Windows breaks the pattern silently.
      // 2. `pnpm --filter <pkg> exec vitest run --coverage` runs vitest with
      //    cwd = the package directory (`packages/<pkg>`), so a relative glob
      //    like `src/**\/*.{ts,tsx}` is evaluated against that exact src tree.
      //    Works for both root-level and per-package invocations.
      include: ['src/**/*.{ts,tsx}'],
      // Exclude browser-only workers and migration files (which are constants
      // — covered by `migrations.test.ts` separately anyway).
      exclude: [
        'src/worker.ts', // OPFS/Web Worker — only runs in a browser tab
      ],
    },
  },
});
