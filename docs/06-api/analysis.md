# Paquetes de IA y Análisis

> Sub-fase 4.5 · 2026-08-12

## `@cubalyze/analysis-engine` — pipeline de análisis (63 archivos)

**Propósito:** el pipeline de análisis de solves: descomposición por fases,
detección de pausas, TPS, recuperación de frames rotados y segmentación F2L.
Es lo que alimenta Insights, los widgets de análisis y la detección propia de
Reconstructions (`analyzeSolveText`). Ver
`docs/18-archive/plan_analysis_unification/` para el plan original.

- **API:** `ANALYSIS_PIPELINE_VERSION` (versión del pipeline),
  `TimelineBuilder` (timeline por estados exactos, incl. movimientos wide),
  `PhaseSplitter`, `analyzeSolveText` (API headless), `recoverRotatedFrame` +
  `FrameRecoveryOptions`, `segmentF2LPairs` + `UnifiedF2LPair`,
  `TPSCalculator`, `PauseDetector`.
- **Dependencias:** `@cubalyze/math-core`, `@cubalyze/solver-engine`,
  `@cubalyze/statistics`, `@cubalyze/types`.
- **Consumido por:** web (Insights, widgets solve-timeline/phase-balance,
  Reconstructions), `@cubalyze/training` (métricas de drills).

## `@cubalyze/statistics` — estadísticas puras (3 archivos)

**Propósito:** estadísticas de tiempos **puras y sin dependencias**: medias
(Ao5/Ao12), desviación, BPA/WPA (mejor/peor promedio posible), penalizaciones.

- **API:** `computeStats` → `SessionStats`, `averageOf`, `stdDeviation`,
  `computeBpaWpa`, `effectiveTime` (con penalizaciones `none|+2|DNF`), tipos
  `StatSolve`/`SessionStats`.
- **Consumido por:** web (SessionStats, widgets time-distribution,
  pb-progression), analysis-engine.

## `@cubalyze/training` — sistema de entrenamiento (27 archivos)

**Propósito:** el sistema de training con **FSRS-4** (ADR-024): progreso,
colas SRS, sesiones, catálogo de ejercicios y generadores de setups.

- **API:** `ProgressTracker` (progreso + FSRS), `TrainingSessionEngine` +
  `SessionEvent`/`SessionStateListener`, `generateRandomSetup`,
  `createTrainingTimer` (wraps timer-engine), catálogo de ejercicios
  (`EXERCISE_IDS`, `seedExercises`), tipos (`QueueItem`, `SRSGrade`,
  `PhaseStatsRecord`, `AttemptVerdict`, `PlayMode`…).
- **Dependencias:** `@cubalyze/algorithm-db`, `@cubalyze/solver-engine`,
  `@cubalyze/timer-engine`.
- **Diseño:** [TDD-0001](../../05-tdd/training/0001-srs-training-system.md).

## `@cubalyze/ai-core` — IA (PLANEADO)

**Propósito:** futuras capacidades de IA (p.ej. sugerencias de entrenamiento).
**Estado:** placeholder — sin fuentes todavía (`echo "no sources"`). Ver
`docs/14-ai/` para el plan de IA.
