/**
 * Desktop database override — the alias roster.
 *
 * `apps/desktop/vite.config.ts` aliases `@cubeforge/database` to
 * `apps/desktop/src/database-override.ts`, a hand-written stand-in that swaps
 * sqlite-wasm + OPFS for tauri-plugin-sql. The override must re-export
 * everything the web app imports from the package, from one file, explicitly.
 *
 * Nothing else in the repo checks that roster, and the gap is invisible in a
 * very specific way: the desktop tsconfig does NOT alias the package (only
 * `@cubeforge/hardware-hal` is aliased), so `tsc` resolves the REAL module and
 * a missing re-export is not a type error. It only explodes at bundle time,
 * with `MISSING_EXPORT … is not exported by src/database-override.ts` — which
 * is exactly how the GearRepository/smart-cube-id additions broke
 * `pnpm build` (the step that failed in CI while every test stayed green).
 *
 * So: walk the package's public runtime surface and require the override to
 * name every symbol, unless it is one the override implements itself.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as repositories from '../repositories/index.js';
import * as smartCubeId from '../smart-cube-id.js';

const OVERRIDE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../apps/desktop/src/database-override.ts',
);

/**
 * Symbols the override deliberately does NOT re-export: the wasm/OPFS client
 * functions, which it replaces with its own Tauri-backed implementations.
 * (`MIGRATIONS` is imported privately by the override and never re-exported —
 * nothing in the web app reads it through the package entry point.)
 */
const SELF_IMPLEMENTED = new Set(['initDB', 'getDB', 'closeDB']);

/** Every name the override exports, from `export { … }` and `export type { … }`. */
function reExportedNames(source: string): Set<string> {
  const names = new Set<string>();
  const re = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    for (const entry of match[1].split(',')) {
      // `Foo as Bar` publishes Bar; a plain `Foo` publishes Foo.
      const name = entry.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

describe('desktop database override (alias roster)', () => {
  const source = readFileSync(OVERRIDE_PATH, 'utf8');

  it('re-exports every runtime symbol the package publishes', () => {
    const exported = reExportedNames(source);
    const published = [...Object.keys(repositories), ...Object.keys(smartCubeId)].filter(
      (name) => !SELF_IMPLEMENTED.has(name),
    );

    // Guard against the vacuous pass: if the namespaces ever stop resolving to
    // real modules, `published` would be empty and this test would "pass" while
    // checking nothing.
    expect(published.length).toBeGreaterThan(10);

    const missing = published.filter((name) => !exported.has(name));

    expect(
      missing,
      'Add these to the re-export lists in apps/desktop/src/database-override.ts — ' +
        'otherwise the desktop bundle fails with MISSING_EXPORT (tsc cannot see it).',
    ).toEqual([]);
  });

  it('never star-exports the wasm client', () => {
    // `export * from './client.js'` would pull sqlite-wasm and the OPFS worker
    // straight into the desktop bundle — the exact thing the override exists to
    // replace. The roster is explicit on purpose.
    const starSpecifiers = [...source.matchAll(/export\s+\*\s+from\s*['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    );

    expect(starSpecifiers.some((specifier) => /client\.js$/.test(specifier))).toBe(false);
  });
});
