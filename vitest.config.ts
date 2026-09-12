import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Robust ESM-safe resolution of this config's own directory (for `resolve.alias`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors apps/web/vite.config.ts: shadcn/ui components live in the
      // shared @cubeforge/ui package — WITHOUT this specific alias the lazy
      // widget loaders (and any test importing them) resolve '@/components/ui'
      // to the non-existent apps/web/src/components/ui and fail to load.
      // Order matters: the specific alias must be checked before the '@' one.
      '@/components/ui': path.resolve(__dirname, './packages/ui/src/components'),
      '@': path.resolve(__dirname, './apps/web/src'),
    },
  },
  test: {
    passWithNoTests: true,
    // `.freebuff/` is gitignored scratch space that can hold full repo copies
    // from parallel agent worktrees. Globbing into them duplicates every test
    // (and surfaces their unrelated failures), so keep discovery on the real
    // source tree only.
    exclude: [...configDefaults.exclude, '.freebuff/**'],
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
