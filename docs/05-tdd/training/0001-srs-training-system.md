# TDD-0001 — Sistema de Entrenamiento SRS/FSRS

> **Dominio:** training · **Estado:** Implementado (as-built, documentado 2026-08-12)
> **Traduce:** ADR-024 · **Código:** `packages/training/src/` + `apps/web/src/views/Training/`
>
> Este TDD documenta el diseño **ya implementado** del sistema de entrenamiento
> con repetición espaciada. Su propósito es servir de referencia de diseño
> (módulos, datos, APIs) — no de plan previo a codificar.

---

## 1. Objetivo

Sistema de entrenamiento offline-first que registra intentos de práctica
(reconocimiento + ejecución), mantiene progreso por caso de algoritmo y
**programa repasos** con el modelo FSRS-4 para maximizar la retención a largo
plazo. Se integra con el catálogo de `@cubalyze/algorithm-db` y persiste en
SQLite vía `@cubalyze/database`.

## 2. Arquitectura de módulos (`packages/training/src/`)

| Módulo | Responsabilidad | Puro (sin I/O) |
| --- | --- | --- |
| `progress/fsrs.ts` | Modelo FSRS-4: estabilidad S, dificultad D, retrievabilidad R(t), máquina de estados (new/learning/review/relearning), calificaciones Again/Hard/Good/Easy | ✅ sí |
| `progress/scheduler.ts` | Cola diaria "Today's Queue": priorización por R(t), penalización overdue, modelo de debilidad (mastery gap + fail rate + recognition), inyección de nuevos (opt-in), round-robin entre subsets (interferencia contextual) | ✅ sí |
| `progress/progress-tracker.ts` | `ProgressTracker`: orquesta intentos/reviews, computa maestría (`computeMastery` con `MASTERY_WEIGHTS`), normaliza registros, delega en `ITrainingProgressRepo` | ⚠️ vía repo |
| `progress/insights.ts` | `computeSRSInsights`: agregados (retención por buckets de retrievability, crecimiento de intervalos, proyección de pendientes) | ✅ sí |
| `session/session-engine.ts` | Sesiones de entrenamiento (start/complete, duración, smart cube) | ⚠️ vía repo |
| `exercises/catalog.ts` | Registro canónico de ejercicios (`seedExercises`, `EXERCISE_IDS`) | ✅ sí |
| `generators/setup-generator.ts` | Scrambles dirigidos por caso (setup para ejecutar un algoritmo concreto) | ✅ sí |
| `engine/training-timer.ts` | Temporizador de entrenamiento | ✅ sí |

**Layering:** UI (`apps/web`) → hooks (`useTrainingProgress`, `useSRSQueue`) →
`ProgressTracker` → `ITrainingProgressRepo` → `TrainingRepository`
(`@cubalyze/database`) → SQLite WASM (worker, ADR-013/016).

## 3. Modelo de datos (SQLite, `migrations.ts`)

### `training_attempts`
Un intento registrado por un drill/review. Columnas clave:
`id, exercise_id, method_id, phase_id, subset_id, case_id, scramble, time_ms,
verdict (correct/incorrect), play_mode, expected_moves, executed_moves, tps,
move_count, optimal_moves, rotation_count, inspection_ms, review_grade, session_id, timestamp`.
Índices: exercise, method, case, timestamp, session.

### `algorithm_progress`
Estado por caso de algoritmo (uno por `algorithm_id`, UNIQUE). Columnas:
`mastery, accuracy, best_time_ms, avg_time_ms, total_attempts, correct_streak,
last_practiced_at, recognition_accuracy, recognition_attempts` + campos FSRS:
`srs_stability, srs_difficulty (1-10), srs_state, srs_lapses, srs_review_count,
srs_interval_days, srs_next_review_at, srs_ease_factor, last_review_at`.

### `exercise_progress`
Progreso agregado por ejercicio/método/fase:
`total_sessions, total_attempts, best_accuracy, best_time_ms, avg_time_ms,
last_practiced_at`. UNIQUE(exercise_id, method_id, phase_id).

### `training_sessions`
Sesión agrupada de práctica: `exercise_id, method_id, phase_id, subset_id,
started_at, completed_at, duration_ms, smart_cube_used, status (active/completed)`.

### `training_tasks`
Tareas del calendario de entrenamiento: `title, description, start_date, repeat
(none/daily/weekdays/weekly/monthly/custom), days_of_week, color, created_at`.

## 4. API del ProgressTracker (pública)

```ts
recordAttempt({ exerciseId, methodId, phaseId?, caseId?, sessionId?,
                timeMs, verdict, playMode, scramble, metricKind?,
                advanceSRS?, moveCount?, optimalMoves?, tps?, rotationCount?,
                reviewGrade? }) → AlgorithmProgressRecord | null
recordReview({ caseId, grade, now? }) → AlgorithmProgressRecord   // FSRS
getCaseProgress / getSubsetProgress(algorithmId|subsetId) → records
getMethodMastery(methodId) → 0-100
getDueForReview(limit?) / getTodayQueue({methodId?, limit?}) → QueueItem[]
getPhaseStats(methodId, phaseId) → PhaseStatsRecord | null
getSRSInsights(methodId?) → SRSInsights
createTrainingSession / completeTrainingSession / getTrainingSessions
updateAttemptReviewGrade(caseId, grade)
clearAllData()
```

`QueueItem`: `{ algorithmId, methodId, subsetId, caseNumber, name?, reason
(overdue|weak|new|review), priority, retrievability, mastery,
recognitionAccuracy, ... }`.

## 5. Máquina de estados FSRS (resumen)

- Estados: `new → learning → review` (y `relearning` tras lapse).
- 4 calificaciones: `again | hard | good | easy`.
- Cada review actualiza S (estabilidad), D (dificultad), intervalo y
  `next_review_at`; la programación ocurre cuando R(t) cae a retención objetivo
  (0.9). `R(t) = (1 + FACTOR·t/S)^DECAY`.
- Detalle de fórmulas y constantes: `progress/fsrs.ts` (comentario de cabecera)
  y tests `progress/__tests__/fsrs.test.ts`.

## 6. Flujo de la sesión de review (UI)

`SRSReviewView` + `ReviewSteps` (3 etapas por ítem de `useSRSQueue`):

1. **Recognition** — diagrama del caso (2D/3D según `diagramType`); no reconocer
   ⇒ auto-califica `again`.
2. **Execution** — setup scramble (`setup-generator`), timer (`TimerContainer`
   + `useDrillTimer`), validación smart cube (`useDrillSmartCube`) cuando hay
   hardware; veredicto correct/incorrect (`VerdictOverlay`).
3. **Grading** — 4 botones FSRS; `recordReview` avanza la máquina.

Composición de cada ítem: `recordAttempt` (métricas) + `grade` (FSRS, con
guard de reentrada).

## 7. Consideraciones de rendimiento y singleton

- **Un solo `ProgressTracker`** por cliente de BD (`getSharedTracker` en
  `useTrainingProgress.ts`): evita re-seeds masivos por montaje.
- **Pre-warm al boot** (`preloadTrainingProgress`): la primera visita a cualquier
  superficie de training no paga init + seed (migraciones + catálogo completo).
- El seed del catálogo es idempotente (`INSERT OR IGNORE`); el registro de
  ejercicios se siembra con `seedExercises`.
- Reset de desarrollo: `window.clearTrainingData()`.

## 8. Criterios de aceptación (tests existentes)

- `progress/__tests__/fsrs.test.ts` — modelo FSRS (fórmulas, estados, grados).
- `progress/__tests__/scheduler.test.ts` — priorización y razones de la cola.
- `progress/__tests__/insights.test.ts` — agregados de insights.
- `progress/__tests__/metrics-invariance.test.ts` — invariantes de métricas.
- `progress/__tests__/progress-tracker.test.ts` — ciclo intento→review→progreso.
- `exercises/__tests__/catalog.test.ts`, `generators/__tests__/setup-generator.test.ts`,
  `session/__tests__/session-engine.test.ts`.
- E2E/Playwright: pendiente (ver nota de estado en ADR-005).
