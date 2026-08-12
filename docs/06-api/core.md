# Paquetes Core

> Sub-fase 4.1 · 2026-08-12

## `@cubeforge/math-core` — matemática del cubo (64 archivos)

**Propósito:** el corazón matemático: estado del cubo (facelets, cubies),
rotaciones, coordenadas, métricas de movimientos. Sin dependencias de UI.

- **API:** re-exports `*` (CubeState, rotaciones, facelets, generadores).
- **Dependencias:** `@cubeforge/types`, `min2phase.js`.
- **Consumido por:** solver-engine, algorithm-db, cube-3d-engine, analysis-engine,
  training. Es la pieza que mantiene los **centros fijos** (ver vista Cube).
- **Tests:** `__tests__/rotations.test.ts`, etc.

## `@cubeforge/solver-engine` — solver y scrambles (21 archivos)

**Propósito:** generación de scrambles WCA y soluciones. Implementa la decisión
del ADR-015 (min2phase vía **`min2phase.js`** en JS, no WASM).

- **API:** `Min2PhaseSolver` (solve + scrambles 3×3), `RandomStateGenerator`,
  `TwoByTwoSolver`/`TwoByTwoScrambler`, interfaz `ISolver`,
  `CrossScrambleGenerator` (scrambles dirigidos de Cross para drills),
  `PhaseSolver`.
- **Dependencias:** `@cubeforge/math-core`, `min2phase.js`.
- **Consumido por:** algorithm-db (scrambles de setup), training (drills),
  web (vista Cube, widgets).

## `@cubeforge/algorithm-db` — catálogo de algoritmos (32 archivos)

**Propósito:** el catálogo de métodos/subsets/casos/algoritmos + seed de la BD.
Es la **fuente canónica** que consumen las vistas Algorithms, Training y los
widgets.

- **API:** schemas zod (`AlgorithmSchema`, `AlgorithmCaseSchema`,
  `AlgorithmSubsetSchema`, `AlgorithmMethodSchema`), `getSeedData`,
  `seedIfEmpty`/`isSeeded` (siembra idempotente a SQLite),
  `computeMoveMetricsFromString`/`FromTokens` (métricas de movimientos),
  `VisualizationStyle`/`VisualizationConfig` (estilos de diagramas),
  `CaseVerifier`, helpers de subsets (`getSubsetsForMethod`, `getChildSubsets`,
  `resolveVisualizationStyleForSubset`), `METHODS`/`SUBSETS`.
- **Dependencias:** `@cubeforge/math-core`, `@cubeforge/solver-engine`, `zod`.
- **Consumido por:** web (Algorithms, Training, widgets algorithm-db),
  `@cubeforge/database` (seed), `@cubeforge/models`.

## `@cubeforge/models` — modelos de datos (6 archivos)

**Propósito:** modelos tipados de las entidades de BD (solves, sesiones,
algoritmos) con validación zod.

- **API:** re-exports (modelos zod de dominio, p.ej. schemas de solves).
- **Dependencias:** `zod`, `@cubeforge/algorithm-db`, `@cubeforge/types`.
- **Consumido por:** `@cubeforge/database` (filas tipadas).

## `@cubeforge/types` — tipos compartidos (4 archivos)

**Propósito:** tipos TS compartidos del dominio del cubo: eventos de movimiento
(`CubeMoveEvent`), caras (`OuterFace`, `CubeFace`), direcciones, eventos de
giroscopio (`GyroEvent`, `GyroVelocity`), ejes de rotación, mappings de caras.

- **Dependencias:** ninguna.
- **Consumido por:** todo el monorepo (es el paquete hoja de tipos).
