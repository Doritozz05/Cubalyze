# Fase B3 — Modelo mental del 3×3 (documento de referencia)

> Fase B del plan `Plan_Eventos_WCA_2026-08.md`. El 3×3 es el *golden path*:
> documenta el modelo que los demás eventos deben imitar — notación, estado,
> scramble, solvers, métodos, reglas. Es la referencia para diseñar los
> `EventSpec` de la Fase D (qué campos declara cada evento nuevo y qué
> implementación requiere).

---

## 1. Notación (WCA)

| Familia | Movimientos | Ejemplos |
|---|---|---|
| Caras | `R U F L D B` (reloj) y `R' U' F' L' D' B'` (anti) | `R U R' U'` |
| Dobles | sufijo `2` | `R2`, `U2` |
| Capas completas (slab) | `x y z` (rotación del cubo) | `x2`, `y'` |
| Media vuelta M/S/E | `M E S` | `M2 U M2 U2 M2 U M2` |
| Wide (doble cara) | minúscula / `w` | `u`, `Rw`, `d2` |
| Inverso | `inverseScramble()` (invierte orden y sentido) | `inverseScramble("R U R' U'") = "U R U' R'"` |

- **El scramble se aplica** sobre un cubo resuelto (estado inicial = `SOLVED_FACELETS`).
- **Resolver un scramble** = aplicar su inverso (ver `apps/web/tests/integration/goldenPath.3x3.test.ts`).
- Los tokens de UI (`R`, `R'`, `R2`, `Rw`, …) se parsean a `CubeMoveEvent`
  (`{ face, direction: 1 | -1 | 2, cubeTimestamp, hostTimestamp }`).

## 2. Estado del cubo

Dos representaciones, ambas en `@cubalyze/math-core`:

- **Facelets (54 stickers)** — string de 54 chars, 9 por cara en orden
  U R F D L B (convención csTimer). `SOLVED_FACELETS` es el patrón de
  resuelto (`^(.)\1{8}...`). `FaceletStringConverter` convierte a/desde el
  formato del solver.
- **Piezas (20)** — `CubeState` modela 8 esquinas + 12 aristas con
  orientación y permutación. API principal:
  - `state.applySequence(scramble)` — aplica movimientos
  - `state.isSolved()` — ¿estado resuelto?
  - `state.multiply(rot)` / `findRecoveryRotation()` — rotaciones de frame
- **2×2** es un caso especial: `Cube2x2State` (8 esquinas), `SOLVED_FACELETS_2X2` (24 stickers).

La validación de un scramble (contrato `ScrambleProvider.validate`, A4) es:
`applySequence(scramble)` sobre un cubo resuelto y comprobar `!isSolved()` y
el mínimo de movimientos (WCA: ≥ 2, y el límite del evento).

## 3. Scramble (random-state)

- **Generación**: `Min2PhaseSolver` (WASM, tablas en `packages/solver-engine`)
  produce el scramble en el propio solver (RandomStateGenerator). 3×3 usa
  ~150–350 ms de init; 2×2 necesita ~800 ms de tabla combinada BFS
  (`TwoByTwoScrambler`).
- **Preload**: `preloadSolvers()` en `apps/web/src/utils/puzzleUtils.ts`
  (requestIdleCallback, dos slots) para que el primer scramble sea instantáneo.
- **Ruta actual (A4)**: `generateScrambleFor(category)` →
  `getEvent(id)` → `generateScramble(event)` → provider registrado.
  Eventos sin provider devuelven `""` — nunca un fallback silencioso a 3×3.
- **OH** reutiliza el provider de 3×3 (WCA: mismos scrambles).

## 4. Solvers

| Solver | Puzzle | Uso |
|---|---|---|
| `Min2PhaseSolver` | 3×3 | Generar scramble random-state; resolver estados |
| `TwoByTwoSolver` + `TwoByTwoScrambler` | 2×2 | Tabla BFS combinada (~800 ms); random-state |
| Interfaz `RandomStateGenerator` | genérico | Contrato para providers de otros eventos (Fase D) |

## 5. Métodos y análisis

- **Métodos con detección de fases** (`@cubalyze/analysis-engine` +
  `@cubalyze/math-core`): **CFOP** (Cross → F2L → OLL → PLL), **Roux**,
  **ZZ**, **Petrus** — todos 3×3 (definiciones: `CFOPDefinition`,
  `RouxFullDefinition`, `ZZDefinition`, `PetrusDefinition`).
- **Pipelines**: `analyzeSolve` (ruta smart cube, timestamps reales),
  `analyzeSolveText` (ruta reconstrucción), `PhaseSplitter.splitAndAnnotate`.
- **Métricas**: TPS, pausas, fluidez, rotaciones, eficiencia, F2L por slots,
  xcross/skips — todas sobre el timeline de fases.
- **Golden path (B2)**: `apps/web/tests/integration/goldenPath.3x3.test.ts`
  valida el flujo completo con componentes reales (scramble → timer con
  perfil de reglas → persistencia SQLite → stats → análisis CFOP).

## 6. Reglas WCA (perfil)

El perfil de 3×3 es `SPEED_RULES` (`packages/timer-engine/src/WcaRules.ts`):
inspección 15 s → `+2`, 17 s → DNF, penaltis `NONE/+2/DNF`, formato `a5`,
scoring `time`. Es **el default del TimerEngine** (A5): cualquier evento sin
perfil explícito hereda exactamente este comportamiento. Los otros perfiles
canónicos: `BLD_RULES` (sin inspección, sin `+2`, `bo3`), `FMC_RULES`
(`mo3`, scoring movimientos), `MBLD_RULES` (`bo1`, límite 1 h, puntos).

## 7. Referencias cruzadas

| Tema | Archivos |
|---|---|
| Estado / notación | `packages/math-core/src/CubeState.ts`, `FaceletStringConverter.ts`, `Cube2x2FaceletConverter.ts` |
| Solvers | `packages/solver-engine/src/Min2PhaseSolver.ts`, `TwoByTwo*`, `RandomStateGenerator.ts` |
| Análisis | `packages/analysis-engine/src/phases/PhaseSplitter.ts`, `pipeline/analyzeSolve.ts`, `metrics/*` |
| Reglas | `packages/timer-engine/src/WcaRules.ts`, `src/TimerEngine.ts` |
| Registro | `packages/events/src/spec.ts`, `registry.ts`, `providers.ts` |
| Golden path | `apps/web/tests/integration/goldenPath.3x3.test.ts` |
| Matriz de cobertura | `docs/01-roadmap/Fase-B1-Cobertura-3x3.md` |
