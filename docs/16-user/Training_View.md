# Vista Training (Entrenamiento)

> Documentada el 2026-08-12 a partir del código real (`apps/web/src/views/Training/`),
> hooks (`apps/web/src/hooks/`) y paquetes `@cubalyze/training`, `@cubalyze/database`,
> `@cubalyze/algorithm-db`. Verificable contra el código.

## Qué es

La tab **Training** es el centro de entrenamiento de CubeForge: práctica de
algoritmos por método/fase, planificación de sesiones con calendario y repaso
diario con **SRS** (spaced repetition, FSRS). Toda la lógica vive en el cliente
(SQLite local) — es offline-first, sin backend.

## Estructura de la pantalla

`TrainingDashboard` es el shell con 3 secciones (tabs con subrayado animado,
toolbar interna sin header de página):

| Sección | Id | Qué hace |
| --- | --- | --- |
| **Practice** | `practice` | Landing: rail de métodos y fases con ejercicios; cada fila abre un drill |
| **Calendar** | `calendar` | Planificación semanal/mensual de tareas + repaso de hoy |
| **Review** | `review` | Cola SRS del día (badge con nº de pendientes) |

**Selector de puzzle** (2x2, 3x3…) junto a las tabs: filtra los métodos del
catálogo (`METHODS` de `@cubalyze/algorithm-db`) según `puzzleType`. Al cambiar
de puzzle se resetea el método activo al primero compatible.

Las sub-vistas (drills, stats, review, insights) toman la pantalla completa con
navegación de vuelta; al volver se refrescan los porcentajes de maestría y el
contador de pendientes.

## Sección Practice

`TrainingPractice` (en `components/DashboardSections.tsx`) renderiza el rail:

- **Método** (ej. CFOP, Roux, 2x2…) → **fases** (`getPhasesForMethod`, p.ej.
  Cross, F2L, OLL, PLL) → **subconjuntos de casos** (subsets del catálogo).
- Cada fila de fase muestra precisión real por fase (`getPhaseStats`) y la
  maestría del método (`getMethodMastery`) — sin fórmulas fabricadas.
- Acciones por fila: **Drill** (ejecución), **Reconocer** (reconocimiento),
  **Práctica** (modos específicos según el tipo de fase), **Stats** (histórico
  de la fase), **Full Solve** (resolución completa).
- Existe un puente **Algorithms → Training**: si se navega con un
  `preset {subsetId, caseId}`, el shell abre directamente el drill del caso.

## Los drills (12 sub-vistas)

| Vista | Qué hace |
| --- | --- |
| `AlgorithmDrillView` | Ejecución de algoritmos de un subset. Modos: `single`, `random`, `sequential`, `weakness` (los casos débiles primero) |
| `AlgorithmRecognizeView` | Reconocimiento: muestra el diagrama y el usuario identifica el caso (recognition) |
| `PlainPracticeView` | Práctica genérica de una fase. Modos: `plain` y `speed-vs-eff` (velocidad vs. eficiencia, con su propio exercise id) |
| `BlindPracticeView` | Práctica a ciegas (sin pistas visuales) |
| `CrossTrainerView` | Entrenamiento de Cross: intentos con `userMoves` vs. `optimalDepth`, tolerancia de eficiencia = 2 movimientos. Modos: `optimal`, `cn` (color neutral) |
| `LSESubPhaseView` | Sub-fases de LSE (Roux): `eo`, `ulur`, `mslice` |
| `EODetectView` | Detección de orientación de aristas (EO) |
| `EOEfficiencyView` | Eficiencia en EO |
| `FullSolveView` | Resolución completa. Modos: `targets`, `move-limit`, `tps-challenge`, `rotationless` |
| `PhaseStatsView` | Estadísticas de una fase (precisión, tiempos, intentos) |
| `SRSReviewView` | Sesión de repaso SRS del día (ver sección Review) |
| `SRSInsightsView` | Dashboard de salud de memoria del SRS (agregados de `computeSRSInsights`) |

Los drills registran intentos con `recordAttempt` (tiempo, veredicto, playMode,
scramble, métricas como moveCount/optimalMoves/tps) y actualizan el progreso.

## Sección Calendar

- Calendario mensual con **tareas de entrenamiento** (`TrainingTask`): título,
  descripción, fecha inicio, repetición, días de semana, color.
- Tipos de repetición: `none`, `daily`, `weekdays`, `weekly`, `monthly`, `custom`
  (días concretos). La lógica de "qué días aplica la tarea" es
  `getTasksForDate` (en `TrainingCalendar.tsx`).
- Panel lateral: próximos 7 días con tareas + **plantillas de un clic**
  (F2L drill diario, PLL recognition entre semana, Cross blind, Full solve semanal).
- Los colores usan las variables CSS de fase (`--phase-*`), una sola fuente de color.
- **Persistencia**: SQLite (`CalendarRepository` de `@cubalyze/database`) como
  fuente de verdad + caché en localStorage con **migración única** (flag-guarded)
  para compatibilidad con la versión anterior.

## Sección Review (SRS / FSRS)

- `useSRSQueue` carga la cola del día (`getTodayQueue`): prioridad FSRS + tope de
  casos nuevos. El badge de la toolbar y la sección Review comparten la misma cola.
- Cada ítem de la sesión pasa por **3 etapas**:
  1. **Reconocimiento** — se muestra el caso (diagrama + etiqueta); no reconocer
     auto-califica "again".
  2. **Ejecución cronometrada** — scramble dirigido, el usuario ejecuta contra el
     temporizador y marca correcto/incorrecto.
  3. **Calificación FSRS** — botones Again / Hard / Good / Easy que avanzan la
     máquina de estados vía `ProgressTracker.recordReview`.
- `SRSInsightsView` muestra agregados: casos, revisados, retención por rangos de
  retrievability, crecimiento de intervalos y proyección de pendientes.

## Inventario archivo por archivo (`apps/web/src/views/Training/`)

### Vistas (sub-vistas de la shell)

| Archivo | Qué es | Detalles clave |
| --- | --- | --- |
| `TrainingDashboard.tsx` | Shell de la tab (3 secciones + enrutado de sub-vistas) | Estado de sub-vista por tipo (`drillView`, `practiceView`, `recognizeView`, `statsView`, `fullSolveView`, `reviewView`, `insightsView`); puente Algorithms→Training (`preset`); refresco de maestría al volver (`masteriesKey`); cola SRS vía `useSRSQueue` |
| `TrainingCalendar.tsx` | Calendario mensual + panel de tareas (Dialog) | Lógica de repetición `getTasksForDate`; plantillas de un clic; colores vía `var(--phase-*)`; estado elevado opcional (tasks/setTasks) |
| `AlgorithmDrillView.tsx` | Drill de algoritmos (ejecución) | Modos `single`/`random`/`sequential`/`weakness`; `StatChip`, `VerdictOverlay`; estilos de visualización por subset |
| `AlgorithmRecognizeView.tsx` | Reconocimiento de casos | `pickRandom` con exclusión de ids; métrica de recognition |
| `PlainPracticeView.tsx` | Práctica genérica de fase | Modo `plain` y `speed-vs-eff` (con `EXERCISE_IDS.speedEfficiency`) |
| `BlindPracticeView.tsx` | Práctica a ciegas | Sin pistas visuales (`EyeOff`) |
| `CrossTrainerView.tsx` | Entrenamiento de Cross | `EFFICIENCY_TOLERANCE = 2` (a ±2 movimientos del óptimo es eficiente); modos `optimal` y `cn` (color neutral) |
| `LSESubPhaseView.tsx` | Sub-fases de LSE (Roux) | `subPhase`: `eo` / `ulur` / `mslice` |
| `EODetectView.tsx` | Detección de EO | Fase tipo `eo`, modo `detect` |
| `EOEfficiencyView.tsx` | Eficiencia de EO | Fase tipo `eo`, modo `efficiency` |
| `FullSolveView.tsx` | Resolución completa | Modos `targets` (splits por fase), `move-limit`, `tps-challenge`, `rotationless` |
| `PhaseStatsView.tsx` | Estadísticas de fase | Precisión, tiempos, intentos por fase |
| `SRSReviewView.tsx` | Sesión de repaso SRS | 3 etapas: recognition → execution → grading (FSRS) |
| `SRSInsightsView.tsx` | Dashboard de memoria SRS | Agregados de `computeSRSInsights` (retención, intervalos, proyección) |

### Componentes (`components/`)

| Archivo | Qué es |
| --- | --- |
| `DashboardSections.tsx` | `TrainingPractice` (landing): rail de métodos, banner con anillo de maestría, filas de fase/set con chips de acción visibles; localización del catálogo (`METHOD_DESC_KEY`/`PHASE_DESC_KEY`/`SUBSET_DESC_KEY`); iconos y dots por fase (solo presentación — la identidad viene del catálogo de `@cubalyze/training`) |
| `ReviewQueueSection.tsx` | Cola del día: badges de razón (Overdue/Due/Weak/New), filtro por método, stats, botón Start Review; reporta `onDueCountChange` al dashboard |
| `ReviewSteps.tsx` | Pasos de la sesión SRS: `RecognitionStep`, `ExecutionStep`, `GradingStep`, `CompletionSummary`, constantes `GRADES` (Again/Hard/Good/Easy) y helpers (`formatTime`, `calculateTps`) |
| `CrossTrainerPanels.tsx` | Paneles del Cross trainer: stats (`CrossStatsPanel`), tips (`CrossTipsPanel`), scramble actual (`CrossScrambleInfoPanel`), intentos recientes (`RecentAttemptsList`) |
| `FullSolvePanels.tsx` | Paneles de Full Solve: `PhaseTargetsPanel` (splits con targets por defecto `DEFAULT_PHASE_TARGETS`), `MoveLimitInfo`, `TpsInfo`, `RotationlessInfo` |
| `VerdictOverlay.tsx` | Overlay post-intento (tiempo, TPS, Correct/Incorrect/Skip) con `useAnnounce` (a11y) |
| `StatChip.tsx` | Chip compacto de estadística (icono + label + valor) |
| `TouchAside.tsx` | Aside responsive: desktop normal; touch (<1024px) colapsa en barra "Options ▾" con bottom sheet (`TouchPanel`) |
| `TrainingBreadcrumb.tsx` | Breadcrumb de navegación de sub-vistas (← Back › segmentos) |
| `fullSolveTypes.ts` | Tipos `PhaseSplit` / `PhaseSplitTarget` |
| `index.ts` | Re-exportación del barrel |

## Datos y persistencia

- **`useTrainingProgress`** envuelve el `ProgressTracker` de `@cubalyze/training`
  (algoritmo **FSRS-4** — estabilidad S, dificultad D, retrievabilidad R, estados
  new/learning/review/relearning, lapses; implementación pura sin dependencias en
  `packages/training/src/progress/fsrs.ts`). Operaciones: `recordAttempt`,
  `recordReview`, `getMethodMastery`, `getPhaseStats`, `getSRSInsights`,
  `getTodayQueue`, sesiones de entrenamiento.
- **`useSRSQueue`** — cola diaria: el scheduler (`packages/training/src/progress/scheduler.ts`)
  prioriza por retrievabilidad R(t) (efecto spacing, Cepeda 2006), penaliza
  overdue, modela debilidad por mastery gap + fail rate + recognition, y
  **excluye casos nuevos por defecto** (solo lo practicado); el orden final
  hace *round-robin* entre subsets (interferencia contextual, Shea & Morgan 1979).
  Razones de cola: `overdue` / `due` / `weak` / `new`.
- **Esquema SQLite** (`packages/database/src/migrations/migrations.ts`):
  `training_attempts` (intentos por ejercicio/fase/caso con métricas: tps,
  move_count, optimal_moves, rotation_count, review_grade, session_id),
  `algorithm_progress` (maestría + campos FSRS: stability, difficulty, state,
  lapses, review_count, last_review_at, interval, next_review_at),
  `exercise_progress`, `training_sessions`, `training_tasks` (calendario).
- **Singleton compartido**: un solo tracker por cliente de BD (antes cada vista
  hacía `initDB()` + reseed completo). Se **pre-calienta al arrancar la app**
  (`preloadTrainingProgress`) para que las tabs no paguen la inicialización en el
  primer clic.
- **Tablas**: `algorithm_progress`, `training_attempts`, `exercise_progress`,
  `training_sessions` (repos `TrainingRepository`, `AlgorithmsRepository`,
  `CalendarRepository` de `@cubalyze/database`). El catálogo de algoritmos se
  siembra con `seedIfEmpty` (idempotente, `INSERT OR IGNORE`).
- Reset de desarrollo: `window.clearTrainingData()` en la consola borra todo el
  progreso de entrenamiento (no toca otras tablas).

## Dependencias de paquetes

- `@cubalyze/algorithm-db` — catálogo de métodos/subsets/casos y seed.
- `@cubalyze/training` — `ProgressTracker` (FSRS), `EXERCISE_IDS`, tipos
  (`PhaseStatsRecord`, `QueueItem`, `SRSGrade`, `AttemptVerdict`…).
- `@cubalyze/database` — SQLite WASM/OPFS, repos de entrenamiento/calendario.
- `@cubalyze/state` — `preferencesStore` (Zustand) para preferencias de la app.
- `@cubalyze/solver-engine` — generación de scrambles (vía caso/hint).
- UI propia de la web (`@/components/ui/*`, Radix) + `framer-motion`,
  `date-fns` (calendario), `sonner` (toasts).

## ADRs relacionados

- **ADR-009 (Zustand)**: estado via stores (`preferencesStore`).
- **ADR-013 (SQLite WASM/OPFS)**: toda la persistencia de entrenamiento.
- **ADR-016 (Web Workers + Comlink)**: el worker de BD (`packages/database/worker.ts`).
- **ADR-015 (Solver)**: scrambles generados por `min2phase.js` para los drills.
- **ADR-020 (A11y)**: `announce()` (live regions) se usa en la sesión de review
  y el entrenamiento (ver `lib/announce.ts`).
