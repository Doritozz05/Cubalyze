/**
 * Storage contract guard — database + desktop identity.
 *
 * The OPFS SQLite file, the IndexedDB snapshot, the desktop SQLite file and the
 * Tauri `identifier` are all contracts with bytes that already exist on the
 * user's device (and, for the identifier, with the operating system itself: it
 * determines the app-data directory, the macOS bundle id, the installer chain
 * and the signing continuity).
 *
 * Renaming any of them without an explicit migration means the app opens a new,
 * empty database while the old file stays on disk, unreachable: from the user's
 * point of view, every solve is gone. The desktop identifier is worse — it makes
 * the OS treat the build as a DIFFERENT app (a second install on macOS).
 *
 * These assertions FAIL ON PURPOSE on any rename. Do not edit a name here: add
 * the migration first (copy old → new, dual-read for one release) and update
 * this file in the same commit.
 *
 * See docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md (§4.1, §9, §15).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Runs from the repo root (`pnpm test`) or from `packages/database` when this
// package is invoked directly — same fallback convention as the other gates.
const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

describe('storage contract — base de datos (OPFS / snapshot / escritorio)', () => {
  it('worker.ts sigue abriendo el MISMO fichero OPFS', () => {
    const worker = read('packages/database/src/worker.ts');
    // 376: recuperación desde el otro tier · 504: apertura normal (OpfsDb / SAHPool)
    const opens = worker.match(/['"]\/cubeforge\.sqlite3['"]/g) ?? [];
    expect(
      opens.length,
      'El fichero OPFS de la BD principal cambió de nombre. Es donde viven TODOS los solves, ' +
        'sesiones, PBs, progreso de entrenamiento y tareas de calendario: renombrarlo sin ' +
        'migración que copie los bytes equivale a que el usuario los pierda.',
    ).toBe(2);
  });

  it('indexeddb-snapshot.ts conserva el nombre de la BD de snapshot', () => {
    expect(read('packages/database/src/indexeddb-snapshot.ts')).toContain("'cube-forge-db'");
  });

  it('el escritorio sigue abriendo `sqlite:cubeforge.db`', () => {
    expect(read('apps/desktop/src/database-override.ts')).toContain("sqlite:cubeforge.db");
  });
});

describe('storage contract — identidad de la app de escritorio (Tauri)', () => {
  it('el identifier es reverse-DNS del nombre histórico y NO se renombra', () => {
    const conf = read('apps/desktop/src-tauri/tauri.conf.json');
    expect(conf).toMatch(/"identifier":\s*"com\.cubeforge\.desktop"/);
    // Cambiarlo movería `%APPDATA%\\com.cubeforge.desktop` (BD huérfana), crearía
    // una segunda app en macOS y rompería la cadena del instalador/firma.
  });

  it('el crate de Rust usa la marca NUEVA y el identifier la VIEJA (no son lo mismo)', () => {
    // These two assertions belong together: they are the whole point of the
    // distinction. The CRATE name is build-time metadata — nothing on disk, in
    // the OS or in any installer key reads it — so PR-5 renamed it (here it was
    // `cubeforge`, plus `authors = ["CubeForge Team"]` and the `cubeforge_lib`
    // lib target that `main.rs` calls). The IDENTIFIER above is what the OS
    // derives the app-data folder from, which is why it keeps the historical
    // spelling forever. This test fails if somebody "aligns" one with the other
    // in either direction.
    const cargo = read('apps/desktop/src-tauri/Cargo.toml');
    expect(cargo).toMatch(/^name = "cubalyze"$/m);
    expect(cargo).toMatch(/^name = "cubalyze_lib"$/m);
    expect(cargo).toContain('authors = ["Cubalyze Team"]');
    expect(cargo).not.toMatch(/cube[ _.-]?forge/i);
    expect(read('apps/desktop/src-tauri/src/main.rs')).toContain('cubalyze_lib::run()');
  });
});
