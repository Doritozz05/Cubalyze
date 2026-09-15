/**
 * Storage contract guard — the persistence namespaces are CONTRACTS with data
 * that already exists on user devices (OPFS / IndexedDB / localStorage).
 *
 * Renaming one of these strings without a migration that COPIES the bytes is
 * indistinguishable from deleting the user's data: the app opens a fresh, empty
 * store while the old one stays orphaned and invisible (OPFS does not even show
 * up in DevTools). Solves, sessions, training progress, notes, the gear
 * collection, custom algorithms and preferences all live behind these names.
 *
 * These assertions therefore FAIL ON PURPOSE when somebody renames a namespace.
 * The correct response is never to edit the name here:
 *   1. add a migration that copies old → new and reads both for one release;
 *   2. only then update this file, in the same commit as that migration.
 *
 * The last block pins the PREFIX ENUMERATION coupling, which is the only real
 * functional bug a rename can introduce: `AdvancedSection` walks localStorage
 * looking for keys that start with the legacy prefix (the "clear app data"
 * button and the storage inspector). Renaming keys without teaching that code
 * the new prefix makes both features fail SILENTLY — no error, no test failure.
 *
 * See docs/11-devops/Rebranding_Cubeforge_to_Cubalyze.md (§14.5.2, §15).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = existsSync(join(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * Every persisted namespace the web app owns → the file that defines it and what
 * is lost if the name changes. All literals verified against the source tree.
 */
const NAMESPACES: { file: string; literal: string; holds: string }[] = [
  // ── localStorage ────────────────────────────────────────────────────────
  { file: 'packages/state/src/store.ts', literal: "cubeforge-prefs", holds: 'todas las preferencias (zustand persist)' },
  { file: 'apps/web/public/theme-bootstrap.js', literal: "cubeforge-prefs", holds: 'preferencias leídas ANTES del bundle (flash de tema)' },
  { file: 'apps/web/src/views/Collection/collectionStore.ts', literal: 'cubeforge-locker', holds: 'colección legacy' },
  { file: 'apps/web/src/widgets/widgetStore.ts', literal: "cubeforge:widgets", holds: 'layout del dock y widgets' },
  { file: 'packages/state/src/algorithm.store.ts', literal: "cubeforge:custom-algs", holds: 'algoritmos propios' },
  { file: 'apps/web/src/hooks/usePersistentSession.ts', literal: 'cubeforge:activeSessionId', holds: 'sesión activa' },
  { file: 'apps/web/src/components/Settings/components/useFavoriteColors.ts', literal: 'cubeforge:favorite-colors', holds: 'colores favoritos' },
  { file: 'apps/web/src/views/Training/infinite-f2l/InfiniteF2LView.tsx', literal: 'cubeforge:infinite-f2l:options', holds: 'opciones del entrenador F2L infinito' },
  { file: 'apps/web/src/hooks/useScrambleState.ts', literal: 'cubeforge_puzzle', holds: 'puzzle seleccionado' },
  { file: 'apps/web/src/hooks/useOnboarding.ts', literal: 'cubeforge_onboarding_completed', holds: 'onboarding completado' },
  { file: 'apps/web/src/hooks/useSkillProgress.ts', literal: 'cubeforge_completed_skills_v2', holds: 'progreso del skill tree (legacy)' },
  { file: 'apps/web/src/hooks/useSkillProgress.ts', literal: 'cubeforge:skills-migrated', holds: 'bandera de migración del skill tree' },
  { file: 'apps/web/src/hooks/useCalendarTasks.ts', literal: 'cubeforge-training-calendar', holds: 'tareas de calendario (legacy)' },
  { file: 'apps/web/src/hooks/useCalendarTasks.ts', literal: 'cubeforge:calendar-migrated', holds: 'bandera de migración del calendario' },
  { file: 'apps/web/src/hooks/useReminderScheduler.ts', literal: 'cubeforge:reminders-fired', holds: 'recordatorios ya disparados' },
  { file: 'apps/web/src/views/Training/FullSolveView.tsx', literal: 'cubeforge_full_solve_mode', holds: 'modo del full solve' },
  { file: 'apps/web/src/views/Training/PhaseStatsView.tsx', literal: 'cubeforge_phase_stats_tab', holds: 'pestaña de estadísticas por fases' },
  { file: 'apps/web/src/widgets/implementations/notes/notesStore.ts', literal: 'cubeforge_notes_storage', holds: 'notas del usuario' },
  { file: 'apps/web/src/widgets/dock/pieces/random-puzzle/randomPuzzleStore.ts', literal: 'cubeforge_random_puzzle_pool', holds: 'pool de scrambles aleatorios' },

  // ── IndexedDB ───────────────────────────────────────────────────────────
  { file: 'apps/web/src/views/Collection/collectionPhotos.ts', literal: 'cubeforge-collection', holds: 'fotos de la colección' },
  { file: 'apps/web/src/stores/backgroundMediaStore.ts', literal: 'cubeforge-media', holds: 'fondos personalizados' },
  { file: 'apps/web/src/theme/customFonts.ts', literal: 'cubeforge-fonts', holds: 'fuentes subidas' },

  // ── sessionStorage / canales ────────────────────────────────────────────
  { file: 'apps/web/src/boot/logCapture.ts', literal: 'cubeforge:log-buffer', holds: 'buffer de logs en vivo' },
  { file: 'apps/web/src/boot/AppErrorBoundary.tsx', literal: 'cubeforge:chunk-reload-ts', holds: 'anti-bucle de recarga por chunk roto' },
  { file: 'apps/web/src/services/Global3DSnapshotService.ts', literal: 'cubeforge_snap_3d_v8_', holds: 'caché de imágenes 3D' },
  { file: 'apps/web/src/services/sync.ts', literal: 'cubeforge-sync', holds: 'BroadcastChannel entre pestañas' },
];

describe('storage contract — los nombres no se renombran sin migración', () => {
  it.each(NAMESPACES)('$file conserva $literal ($holds)', ({ file, literal, holds }) => {
    expect(
      read(file).includes(literal),
      `«${literal}» desapareció de ${file}.\n` +
        `Ese nombre es un CONTRATO con datos YA GUARDADOS en los dispositivos: ${holds}.\n` +
        `Renombrarlo sin migración abre un almacén nuevo y vacío y deja los datos viejos ` +
        `huérfanos e invisibles. Si de verdad hay que renombrarlo, hace falta una migración ` +
        `que COPIE old → new y lea ambos nombres durante un release; actualizar este test ` +
        `SOLO en ese mismo commit.`,
    ).toBe(true);
  });

  it('sigue existiendo la bandera de migración de posiciones de widgets (una sola vez)', () => {
    expect(read('apps/web/src/widgets/migration.ts')).toContain('cubeforge:widgetPosMigrated');
  });
});

describe('storage contract — acoplamiento por PREFIJO (bug silencioso si se renombra)', () => {
  it('AdvancedSection enumera las claves por el prefijo legacy (borrar datos + inspector)', () => {
    const source = read('apps/web/src/components/Settings/sections/AdvancedSection.tsx');
    // Both the "clear app data" loop and the storage-inspector loop.
    const checks = source.match(/startsWith\("cubeforge"\)/g) ?? [];
    expect(
      checks.length,
      'AdvancedSection ya no comprueba el prefijo legacy. Las claves con datos NO se renombran ' +
        '(este fichero las enumera), así que el prefijo antiguo debe seguir contemplado o ' +
        '«Borrar datos de la app» y el inspector dejarán de vaciar las claves históricas.',
    ).toBe(2);

    // …and the SAME two call sites must also accept the new prefix, because PR-5
    // renamed the debug flags (`cubalyze:cfop-debug`, `cubalyze:debug-ui`,
    // `cubalyze:orientation-debug`). With only one of the two prefixes, the
    // inspector would hide those keys and «Borrar datos» would leave them behind.
    const checksNew = source.match(/startsWith\("cubalyze"\)/g) ?? [];
    expect(
      checksNew.length,
      'El prefijo nuevo quedó fuera de la enumeración: las claves con la marca nueva no se ' +
        'vaciarían con «Borrar datos de la app» ni aparecerían en el inspector.',
    ).toBe(2);
  });

  it('Global3DSnapshotService enumera y evacúa la caché por su prefijo', () => {
    const source = read('apps/web/src/services/Global3DSnapshotService.ts');
    expect(source).toContain('cubeforge_snap_3d_v8_');
    expect(source).toContain('startsWith(STORAGE_PREFIX)');
  });
});
