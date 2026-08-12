# Paquetes de Datos y Estado

> Sub-fase 4.3 · 2026-08-12

## `@cubeforge/database` — SQLite WASM/OPFS (27 archivos)

**Propósito:** la capa de persistencia local. Implementa ADR-013 (SQLite
compilado a WASM sobre OPFS) y ADR-016 (worker dedicado + Comlink).

- **API:** `initDB`, `client.ts`/`worker.ts` (el worker), repositorios por
  dominio — `TrainingRepository`, `AlgorithmsRepository`, `CalendarRepository`
  (y otros) — y **migraciones versionadas** (`migrations/`): solves, sessions,
  algorithm catalog (methods/subsets/cases/records), training_attempts,
  algorithm_progress, exercise_progress, training_tasks, skill_progress,
  training_sessions, profiles, app_meta.
- **Dependencias:** `@sqlite.org/sqlite-wasm`, `comlink`, `@cubeforge/algorithm-db`,
  `@cubeforge/models`, `@cubeforge/training`, `@cubeforge/types`.
- **Consumido por:** web (vía hooks: useTrainingProgress, useCalendarTasks,
  usePersistentSession…), desktop (Tauri con plugin-sql override).
- **Notas:** los repositorios se usan vía una interfaz (p.ej.
  `ITrainingProgressRepo`) para que la lógica pura (FSRS) sea agnóstica del
  almacenamiento.

## `@cubeforge/state` — estado global Zustand (8 archivos)

**Propósito:** stores vanilla de la app (ADR-009): `preferencesStore`
(persistido, ~40 preferencias), `timerStore`, `sessionStore`, `connectionStore`,
`orientationStore`, `algorithmStore`. Detalle completo:
[`../02-architecture/web/State_and_Stores.md`](../02-architecture/web/State_and_Stores.md).

- **Dependencias:** `zustand`, `@cubeforge/algorithm-db`, `@cubeforge/types`.

## `@cubeforge/sync-engine` — sincronización (PLANEADO)

**Propósito:** sincronización en la nube (ADR-019, Supabase/event sourcing).
**Estado:** placeholder — sin fuentes todavía (`echo "no sources"`). Se
implementará cuando exista el backend (hoy `apps/api` está vacío y no hay
carpeta `supabase/`).
