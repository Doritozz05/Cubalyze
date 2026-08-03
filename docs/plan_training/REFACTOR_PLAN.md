# CubeForge — PLAN DE REFACTOR: Sistema de Training Profesional

> **Plan de corrección derivado de la auditoría integral del sistema de Training.**
> Fecha: Agosto 2026 · Estado: Propuesta — pendiente de aprobación e implementación
> Base: `docs/plan_training/README.md` (v1) y `docs/plan_training/TRAINING_SYSTEM_v2.md` (v2)

---

## 0. Resumen ejecutivo

El núcleo algorítmico de `@cubeforge/training` (FSRS, scheduler, insights, `ProgressTracker`,
`generateRandomSetup`) está bien diseñado y correctamente consumido por las apps. El problema es
que **el modelo de ejercicios, la sesión y las métricas no tienen una fuente de verdad única**:

1. **Ejercicios**: el `exerciseRegistry` del paquete es código muerto; la app hardcodea su propio
   catálogo (fases, modos, subset-mapping, mastery labels) y persiste `exercise_id` ad-hoc
   (`drill-${subsetId}`, `blind-${phaseId}`…) que no coinciden con ningún catálogo canónico.
2. **Sesión**: `TrainingSessionEngine` y `createTrainingTimer` del paquete no se usan; cada vista
   reimplementa su máquina de estados y su timer.
3. **Métricas**: los % son incorrectos por diseño — ejecución y reconocimiento comparten contadores
   (la mastery se diluye con Recognize), los contadores se reconstruyen desde porcentajes
   redondeados (drift), el Cross Trainer mide contra el óptimo absoluto (accuracy ≈ 0 %), y Full
   Solve fabrica verdicts contra targets hardcodeados que contaminan las stats de fase.
4. **Tipos**: las mismas entidades están definidas en 3 capas (`training`, `database`, adapter web).
5. **Base de datos**: la auditoría global de `packages/database` revela deuda real (tabla legacy
   muerta, sin FKs/CHECKs, 3 formatos de tiempo, agregados snapshot, upserts no atómicos) — y como
   **no hay usuarios, se resuelve con wipe + baseline v2** (§5) en lugar de apilar más ALTERs.

**Objetivo de este plan**: convertir `@cubeforge/training` en la fuente de verdad única de
ejercicios, sesiones y métricas; recalcular todas las estadísticas con datos exactos y no mezclados;
y rehacer las vistas "chapuza" (FullSolve, Cross, EO/LSE/Blind) sobre los mismos primitivos que las
vistas que ya están bien (Drill, Recognize).

---

## 1. Problemas raíz (evidencia)

### 1.1 Métricas incorrectas (el % que no tiene sentido)

| # | Problema | Evidencia | Impacto |
|---|---|---|---|
| M1 | `totalAttempts` es compartido entre execution y recognition; `computeMastery` divide `correctCount` (solo exec) entre `totalAttempts` (exec + rec) | `progress/progress-tracker.ts` — rama exec: `computeMastery(correctCount, totalAttempts, …)` | **Mejorar en Drill y luego hacer Recognize BAJA la mastery.** El usuario ve % sin sentido |
| M2 | `correctCount` y `recognitionAccuracy` se reconstruyen por redondeo en cada intento: `Math.round((prev.accuracy/100) * execAttempts)` | `progress-tracker.ts` (ambas ramas) | Drift acumulativo; contadores nunca exactos |
| M3 | Recognize (timeMs=0) hace bootstrap SM-2: `srsNextReviewAt = now + interval*86400000` | `progress-tracker.ts` rama recognition (sin advanceSRS) | Recognize empuja la fecha de revisión sin señal de ejecución real |
| M4 | `getPhaseStats` mezcla execution y recognition en accuracy/failRate | `repositories/training.repository.ts` `getPhaseStats` (+ comentario "Recognition attempts ARE included") | La "accuracy de fase" no es ni ejecución ni reconocimiento |
| M5 | `getMethodMastery` promedia `COALESCE(ap.mastery, 0)` sobre **todos** los casos del catálogo, incluidos los no practicados | `training.repository.ts` `getMethodMastery` | El % del método está diluido por casos nunca tocados; nunca llega alto |
| M6 | Cross Trainer: `efficient = userMoves <= cross.optimalDepth` (en el óptimo absoluto) | `CrossTrainerView.tsx` `handleSubmitMoves` | Accuracy ≈ 0-5 %; el % no representa nada |
| M7 | Cross Trainer: las stats visibles se calculan de **estado local** (`attempts`), no de la DB | `CrossTrainerView.tsx` `stats = useMemo(...)` | Al salir y volver, las stats desaparecen; incoherencia UI vs DB |
| M8 | FullSolve persiste splits con `verdict: correct/incorrect` según targets hardcodeados arbitrarios | `FullSolveView.tsx` `getPhaseTargets` + persist de splits | Los splits de un solve completo contaminan la accuracy/failRate de fase |
| M9 | Cuatro copias de los umbrales de mastery: `masteryLabel` (Dashboard), `mastered>=90/learning>=60` (PhaseStats), Profile, y `MASTERY_THRESHOLDS` muerto en el paquete | `TrainingDashboard.tsx`, `PhaseStatsView.tsx`, `types/progress.ts` | Incoherencias de criterio entre pantallas |
| M10 | BUG: `totalSessions` de `exercise_progress` nunca se incrementa (`?? 1` en cada upsert) | `progress-tracker.ts` rama común | El contador de sesiones por ejercicio es siempre ≤ 1 |

### 1.2 Fuente de verdad inexistente (hardcode)

| # | Problema | Evidencia |
|---|---|---|
| S1 | `exerciseRegistry` (12 ejercicios), `ITrainingExercise`, `TrainingSessionEngine`, `createTrainingTimer`, `MASTERY_THRESHOLDS`, `MasteryLevel`, `MethodProgress`, `PhaseProgress`, `TrainingSessionSummary`, `ExercisePreset`, `AttemptSnapshot`… **0 usos fuera del paquete** | Búsqueda de usos (verificado) + knip |
| S2 | `exercise_id` persistido es ad-hoc por vista: `drill-${subsetId}`, `recognize-${subsetId}`, `blind-${phaseId}`, `plain-${phaseId}`, `cross-trainer-${phaseId}`, `lse-${subPhase}-${phaseId}`, `eo-detect-${phaseId}`, `eo-eff-${phaseId}`, `full-solve-${methodId}`, `srs-review-${methodId}` | `AlgorithmDrillView.tsx:190`, `SRSReviewView.tsx:125`, `FullSolveView.tsx:165`, `CrossTrainerView.tsx:132`, etc. |
| S3 | `METHOD_PHASES` duplica las definiciones de fases que ya existen en `algorithm-db` (`METHODS`, `SUBSETS`, `parent_id`) | `TrainingDashboard.tsx` |
| S4 | `findSubsetId` (Dashboard) y `phaseToName` (PhaseStats) hardcodean el mapeo fase→subset | `TrainingDashboard.tsx`, `PhaseStatsView.tsx` |
| S5 | Targets de Full Solve hardcodeados por método (2.0s cross, 6.0s F2L…) | `FullSolveView.tsx` `getPhaseTargets` |
| S6 | `useDrillTimer` y `useSolveSession` duplican el mismo `mapState`/`mapEngineStateToUIState` y el mismo manejo global de Espacio | `hooks/useDrillTimer.ts`, `hooks/useSolveSession.ts` |
| S7 | `generateRandomSetup` crea `new Min2PhaseSolver()` por llamada (sin singleton, coste WASM repetido); el resto de la app usa `getMin2PhaseSolver()` | `generators/setup-generator.ts` vs `utils/puzzleUtils.ts` |
| S8 | Constantes duplicadas en la app: `srsEaseFactor: 2.5`, `srsDifficulty: 5` (no exportadas por el paquete) | `hooks/useTrainingProgress.ts` `getCaseProgress` |
| S9 | Tipos de dominio definidos en 3 capas (`training` record-types, `database` domain types, adapter web) | `progress/progress-tracker.ts`, `repositories/training.repository.ts`, `hooks/useTrainingProgress.ts` |
| S10 | `apps/web/src/lib/training/__tests__/setupGenerator.test.ts` prueba una función del paquete | — |

### 1.3 Vistas "chapuza" vs. vistas modelo

| Vista | Líneas | Problema principal | Modelo a seguir |
|---|---|---|---|
| `AlgorithmDrillView` | 762 | — (modelo) | Se mantiene; migra a IDs canónicos y al engine compartido |
| `AlgorithmRecognizeView` | 655 | — (modelo) | Ídem |
| `FullSolveView` | 927 | Targets hardcodeados, splits con verdicts fabricados, `new Min2PhaseSolver()` por scramble, máquina de estados propia | Reconstruir sobre primitivos compartidos + targets como datos |
| `CrossTrainerView` | 856 | Sin timer, métrica "al óptimo" imposible, stats locales, sin verdict real | Añadir timing + eficiencia real + stats de DB |
| `TrainingDashboard` | 895 | Fases/subset/mastery hardcodeados | Data-driven desde `algorithm-db` + paquete |
| `PhaseStatsView` | 538 | `void phaseId`, 3ª copia de thresholds/subset-map, eje con `maxTime=2.5` fijo | Consumir umbrales y mapeos unificados; separar exec/rec |
| `PlainPracticeView` / `BlindPracticeView` / `LSESubPhaseView` / `EODetectView` / `EOEfficiencyView` | 177-348 | Estructura ok (envuelven `usePracticeSession`); IDs ad-hoc y tips hardcodeados | IDs canónicos + datos de ejercicio del paquete |
| `useSolveSession` | 872 | Duplica mapper de estados + keyboard (no es training, pero comparte el timer) | Extraer `mapTimerState` + `useTimerKeyboard` compartidos |
| `SRSReviewView` | 825 | Muy grande, pero lógica FSRS correcta (consume el paquete) | Refactor de tamaño; sin cambio de lógica |

---

## 2. Diseño — Nuevo modelo de métricas (corazón del plan)

### 2.1 Principio

> **Cada métrica se calcula sobre una población bien definida y con contadores exactos.**
> Ejecución y reconocimiento son sistemas de medida **separados**. Los objetivos (targets de fase,
> límites de movimientos, TPS) son **metas**, no correctness — nunca fabrican un verdict.

### 2.2 Esquema: contadores exactos (parte del **baseline v2**, ver §5)

```sql
-- en algorithm_progress (baseline v2)
exec_attempts INTEGER NOT NULL DEFAULT 0,
exec_correct  INTEGER NOT NULL DEFAULT 0,
rec_attempts  INTEGER NOT NULL DEFAULT 0,
rec_correct   INTEGER NOT NULL DEFAULT 0,
```

- `total_attempts`, `accuracy`, `recognition_attempts`, `recognition_accuracy`, `correct_streak`
  pasan a ser **derivados** (se recalculan en el paquete; las columnas se mantienen para
  compatibilidad de lectura de los repos existentes, o se eliminan si se refactorizan los
  consumidores — decisión en la Fase 1).
- **No hay backfill**: al ser baseline v2 con wipe (no hay usuarios), las columnas nacen a cero.

### 2.3 `ProgressTracker.recordAttempt` (nuevo contrato)

```
rama exec:  exec_attempts += 1;  exec_correct  += (verdict === 'correct') ? 1 : 0
rama rec:   rec_attempts  += 1;  rec_correct   += (verdict === 'correct') ? 1 : 0

accuracyExec        = round(100 · exec_correct / exec_attempts)
recognitionAccuracy = round(100 · rec_correct / rec_attempts)
```

- **Mastery** (por caso) = f(ejecución únicamente), con denominador exacto:

```
accuracyScore = 100 · exec_correct / exec_attempts          // exacto, sin redondeo previo
streakScore   = min(streak, 10) · 10
speedScore    = clamp(200 − 100 · avgExecMs / bestExecMs, 0, 100)
mastery       = round(0.5 · accuracyScore + 0.2 · streakScore + 0.3 · speedScore)
```

- **Propiedades exigidas (tests de invarianza):**
  1. Un intento exec **correcto y más rápido que la media** nunca reduce `mastery`.
  2. Un intento de **reconocimiento nunca cambia** `mastery`, `bestTimeMs`, `avgTimeMs`, `accuracy`.
  3. `accuracyExec + recognitionAccuracy` son reconstruibles desde los counters exactos con
     **error cero** (test de ida y vuelta tras 100 intentos aleatorios).
- **Reconocimiento**: solo actualiza `rec_*`, `recognitionAccuracy` y (si `advanceSRS`) FSRS.
  Eliminar el bootstrap SM-2 en la rama recognition: si no hay FSRS previo, no se toca
  `srs_next_review_at` (el caso entra en la cola por `totalAttempts`/debilidad cuando proceda).

### 2.4 Mastery levels — una sola fuente

En el paquete, exportar y **hacer que toda la UI consuma**:

```ts
masteryLevel(pct: number): MasteryLevel   // 'new' | 'learning' | 'practicing' | 'mastered' | 'expert'
MASTERY_LEVEL_LABELS: Record<MasteryLevel, string>
```

- Umbrales únicos (reutilizar `MASTERY_THRESHOLDS`): new 0 / learning 30 / practicing 70 /
  mastered 90 / expert 95.
- Eliminar: `masteryLabel` (Dashboard), thresholds en `PhaseStatsView`, y cualquier copia en
  `ProfileView`.

### 2.5 Stats de fase (`getPhaseStats`) — semántica nueva

```ts
PhaseStatsRecord = {
  execution:   { attempts, accuracy, avgTimeMs, bestTimeMs, failRate, efficiency },
  recognition: { attempts, accuracy },
  lastPracticedAt,
}
```

- `attempts` de ejecución = verdicts en (correct, incorrect, dnf) — **excluye skipped** (los
  splits de FullSolve pasan a persistirse como `skipped` + timeMs real, ver §3.3).
- `time` se calcula sobre cualquier intento con `time_ms > 0` (incluye splits) — es un dato de
  tiempo real, correcto por construcción.
- `accuracy` de ejecución = solo `metric_kind='execution'`; `recognition.accuracy` = solo
  `metric_kind='recognition'`.

### 2.6 Stats de método — dos números en vez de uno

| Métrica | Definición | Uso |
|---|---|---|
| `coverage` | `casosMastereados / totalCasos` | Progreso del catálogo ("12/57") |
| `performance` | `avg(mastery) sobre casos practicados` | Rendimiento real del usuario |

- `getMethodMastery` SQL actual (COALESCE 0 sobre todo el catálogo) se sustituye por dos queries
  exactas. El dashboard muestra ambos ("Coverage 12/57 · Perf 78%").

### 2.7 Cross Trainer — métricas con sentido

- **Timing real**: añadir `useDrillTimer` (misma base que Drill) → `timeMs` real, TPS real.
- **Eficiencia**: `efficiency = round(100 · optimalDepth / userMoves)` (0-100, escalada).
- **Correcto ≠ óptimo**: `efficient = userMoves <= optimalDepth + 2` (umbral en la definición del
  ejercicio, ver §3.4). Un usuario a 2 movimientos del óptimo es "correcto", no un fracaso.
- **Stats desde DB**: la vista lee `getPhaseStats(method, phase)` + los últimos intentos de
  `training_attempts` (nuevo repo query `getAttemptsByPhase`), no estado local.
- Persistencia estándar: `recordAttempt({ moveCount, optimalMoves, tps, verdict, metricKind })`.

### 2.8 Fórmulas auxiliares que se corrigen

- `intervalFor('again')` → 0 días (FSRS estándar) en vez de 1.
- Documentar (y testear) la desviación "lite" de FSRS-4: `intervalFor` usa multiplicadores fijos;
  dejar `REQUEST_RETENTION` realmente conectado al scheduling o eliminar el constant si no se usa.
- Exportar constantes del paquete: `DEFAULT_EASE_FACTOR`, `FSRS_DEFAULTS`, `MASTERY_THRESHOLDS`
  (ya exportado pero muerto) → eliminar hardcodes en `useTrainingProgress`.

---

## 3. Diseño — Fuente de verdad única (nada hardcodeado)

### 3.1 Catálogo de ejercicios real (`exerciseRegistry`)

`ITrainingExercise` se amplía y se convierte en **el** catálogo consumido por las vistas:

```ts
interface ITrainingExercise {
  id: string;                 // ID canónico y ESTABLE que se persiste en exercise_id
  label: string;
  category: ExerciseCategory;
  metricKinds: MetricKind[];  // 'execution' | 'recognition'
  hasTimer: boolean;
  smartCubeRequirement: SmartCubeRequirement;
  scramble: ScrambleStrategy;
  validation: ValidationRule;
  defaults?: Record<string, number | string | boolean>;  // targets, umbrales, modos
  variants?: string[];        // p.ej. lse: ['eo','ulur','mslice']; cross: ['plain','blind',...]
}
```

**IDs canónicos** (constantes exportadas, únicas por ejercicio — el subset/método/fase viven en
sus columnas propias, no en el ID):

```
drill, recognize, plain, blind, cross-trainer, lse-eo, lse-ulur, lse-mslice,
eo-detect, eo-efficiency, full-solve, srs-review
```

- Todas las vistas generan `exercise_id` desde `EXERCISE_IDS.*` (sin interpolación).
- Migración de datos legacy: `UPDATE training_attempts SET exercise_id = ...` normalizando
  `drill-* → drill`, `blind-* → blind`, `cross-trainer-* → cross-trainer`, `lse-* → lse-{sub}`,
  `eo-detect-* → eo-detect`, `eo-eff-* → eo-efficiency`, `full-solve-* → full-solve`,
  `srs-review-* → srs-review`, `recognize-* → recognize`, `plain-* → plain`.
- `getMethodExerciseProgress` y el análisis "¿qué ejercitó el usuario?" vuelven a ser consultables.

### 3.2 Fases y subset-mapping — desde `algorithm-db`

- `TrainingDashboard.METHOD_PHASES` → sustituido por `buildMethodPhases(method)` (helper en el
  paquete o en `algorithm-db`) derivado de `METHODS` + `SUBSETS` (+ `parent_id` para
  Advanced F2L / sub-fases) + convención `hasAlgorithms` (subset asociado o no).
- `findSubsetId` / `phaseToName` → `subsetForPhase(methodId, phaseId)` exportado por
  `algorithm-db` (que ya conoce subsets y métodos), una única implementación con tests.

### 3.3 Full Solve — targets como datos, splits honestos

- **Targets por defecto por método** → `full-solve-targets.ts` en `packages/training` (data con
  defaults), consumidos por la vista; la vista puede ofrecer editarlos (persistencia en
  `preferencesStore` o `app_meta`). Nada hardcodeado en el componente.
- **Splits**: persistir cada split con `timeMs` real y `verdict: 'skipped'` (dato de tiempo, no de
  correctitud). La accuracy de fase queda limpia (los `skipped` se excluyen de accuracy/failRate).
  El cumplimiento de target se muestra en la UI (y opcionalmente se persiste en el resumen de la
  sesión), pero **nunca fabrica un verdict de ejecución**.
- `new Min2PhaseSolver()` → `getMin2PhaseSolver()` (singleton, como el resto de la app).

### 3.4 Datos de ejercicio que migran al catálogo

| Dato hoy hardcodeado | Destino |
|---|---|
| `PHASE_MODES` (modos por tipo de fase) | `variants` + `defaults` del ejercicio |
| `getPhaseTargets` (FullSolve) | `defaults.targets` por método en `full-solve-targets.ts` |
| `efficient = userMoves <= optimalDepth` | `defaults.efficiencyTolerance = 2` del ejercicio `cross-trainer` |
| `maxMoveLimit`, `tpsThreshold` (FullSolve) | `defaults` del ejercicio `full-solve` |
| Tips por fase (Plain/LSE/EO) | (contenido editorial) se mantiene en la vista o se mueve a `defaults.tips` — decisión del equipo |
| `createTrainingTimer` (muerto) | se adopta (ver §4) |

### 3.5 Sesión y timer compartidos

- **Adoptar `TrainingSessionEngine`**: nuevo hook `useTrainingEngine({ preset })` en la app que
  compone: `TrainingSessionEngine` (estados) + `useDrillTimer` (timer) + `useTrainingProgress`
  (persistencia) + `useTrainingSession` (agrupación). Las vistas migran a él; el engine del
  paquete deja de ser código muerto y sus 45 tests se convierten en la garantía del flujo.
- **Unificar timer**: extraer `mapTimerState(engineState)` y `useTimerKeyboard({ press, release,
  enabled })` a un módulo compartido (`apps/web/src/hooks/timerShared.ts`); `useDrillTimer` y
  `useSolveSession` dejan de duplicarlos.
- `createTrainingTimer` se usa dentro de `useDrillTimer` (factory real).

### 3.6 Tipos — una sola definición

- `@cubeforge/database` pasa a depender de `@cubeforge/training` (deps del package.json) e
  **importa** los record-types (`TrainingAttemptRecord`, `AlgorithmProgressRecord`, …) en vez de
  redefinirlos. El adapter de `useTrainingProgress` se reduce a un thin-mapping (o desaparece si
  los repositorios ya devuelven el tipo del paquete).
- Mover `setupGenerator.test.ts` a `packages/training/src/generators/__tests__/`.

---

## 4. Refactor por vista (qué y cómo)

| Vista | Acción |
|---|---|
| `TrainingDashboard` | Fases desde `buildMethodPhases`; subset desde `subsetForPhase`; mastery desde `masteryLevel`; coverage/performance; eliminar `masteryLabel`, `findSubsetId`, `METHOD_PHASES`, `PHASE_MODES` |
| `AlgorithmDrillView` | `exercise_id` canónico; envolver en `useTrainingEngine`; resto intacto (es el modelo) |
| `AlgorithmRecognizeView` | Ídem |
| `FullSolveView` | Reconstruir: targets desde el paquete; splits como `skipped` + timeMs; singleton solver; extraer sub-paneles a archivos propios (<300 líneas) |
| `CrossTrainerView` | Añadir timer (useDrillTimer); eficiencia con tolerancia; stats desde DB; `exercise_id` canónico; conservar el excelente reuso de `useCrossScramble`/`ReplayEngine`/`useCube3D` |
| `PlainPracticeView` / `BlindPracticeView` / `LSESubPhaseView` / `EODetectView` / `EOEfficiencyView` | `exercise_id` canónico; `useTrainingEngine`; (opcional) tips desde `defaults` |
| `SRSReviewView` | `exercise_id` canónico (`srs-review`); partir en componentes (<300 líneas); sin cambio de lógica FSRS |
| `PhaseStatsView` | `masteryLevel` + `subsetForPhase`; tabs de ejecución vs reconocimiento; eje del gráfico con escala real (percentil 90, no `maxTime=2.5`); quitar `void phaseId` |
| `ProfileView` (sección mastery) | Consumir `masteryLevel`/`MASTERY_LEVEL_LABELS` del paquete |
| `useTrainingProgress` | Eliminar hardcodes (2.5/5); adaptar a los nuevos counters; quitar el default-duplicado de `getCaseProgress` |
| `useDrillTimer` / `useSolveSession` | Usar `mapTimerState` + `useTimerKeyboard` compartidos |

---

## 5. Base de datos — baseline v2 (esquema limpio desde cero)

### 5.1 Veredicto de la auditoría global de `packages/database`

No es un desastre (hay migraciones versionadas, worker, repos con tests), pero no es una BD
profesional: coexisten dos eras de esquema (`algorithms` legacy muerta + catálogo canónico), no hay
FKs ni CHECKs fuera del catálogo, hay **3 formatos de tiempo mezclados** (TEXT ISO en
`solves`/`created_at`, INTEGER epoch en training/profiles/skill_progress), los agregados de sesión
son snapshots congelados, los upserts no son atómicos, `exercise_progress.UNIQUE` no garantiza nada
con `phase_id NULL`, las migraciones están desordenadas (011 antes de 010), y el override de
escritorio es un shim frágil (rutas relativas a packages + `getStorageType()` que miente).

### 5.2 Decisión: wipe + baseline v2

**No hay usuarios y los datos pueden borrarse** → NO se apilan más ALTERs. Se define el **esquema
final en una sola migración baseline v2** y se recrea la BD:

- Mecánica: el runner de migraciones aplica `BASELINE_V2`; si la BD actual no lo tiene, **DROPs
todas las tablas v1 conocidas** y crea el esquema v2 (en la práctica, en OPFS basta con borrar
`/cubeforge.sqlite3` y volver a migrar — equivalente).
- El esquema v2 incluye TODO lo que hoy se parchea con ALTERs:

| Área | Esquema v2 |
|---|---|
| **Tiempos** | `INTEGER` epoch ms en TODAS las tablas (`solves.timestamp` sustituye a `solves.date TEXT`; `created_at`/`updated_at` INTEGER). Un solo formato, agregaciones directas |
| **FKs** | `solves.session_id → sessions(id)`; `training_attempts.case_id → algorithm_cases(id)`; `algorithm_progress.algorithm_id → algorithm_cases(id)` (UNIQUE); `exercise_progress.exercise_id → training_exercises(id)`; `training_attempts.exercise_id → training_exercises(id)` |
| **CHECKs** | `penalty IN ('none','+2','DNF')`; `verdict IN ('correct','incorrect','skipped','dnf')`; `play_mode IN ('manual','smart-cube')`; `source IN ('manual','smart')`; `status IN ('active','completed')`; `srs_state IN ('new','learning','review','relearning')`; `metric_kind IN ('execution','recognition')` |
| **Catálogo** | Nueva tabla `training_exercises(id, label, category, has_timer, metric_kinds, ...)` sembrada desde `exerciseRegistry` del paquete (seed idempotente tipo `seedIfEmpty`); `exercise_id` canónico con FK real |
| **Legacy** | Se ELIMINA la tabla `algorithms` y el CRUD muerto de `AlgorithmsRepository` (quedan `seedAll` + métodos del catálogo canónico) |
| **Contadores** | `exec_attempts/exec_correct/rec_attempts/rec_correct` nacen a cero (sin backfill) |
| **Ejercicio** | `exercise_progress` con UNIQUE correcto: `(exercise_id, method_id, phase_id)` sin NULLs (fase por defecto `'generic'`) |
| **Atomicidad** | Helper `withTransaction(executor, fn)` (BEGIN/COMMIT/ROLLBACK) usado por `completeTrainingSession`, `replaceAll`, upserts |
| **Agregados en vivo** | `total_attempts/accuracy/avg_time` de sesión se calculan por QUERY al leer (derivados), no se congelan en el UPDATE de cierre |
| **Desorden** | Migraciones renumeradas/ordenadas de forma limpia (baseline único + migraciones futuras correlativas) |
| **Pragmas** | `PRAGMA foreign_keys = ON` + `PRAGMA journal_mode = WAL` al abrir la BD (worker y desktop) — hoy las FK existen solo sobre el papel |

### 5.2.1 Inventario completo de tablas v1 → v2 (la BD entera, no solo training)

| Tabla v1 | Estado hoy | Destino en v2 |
|---|---|---|
| `solves` | `date` TEXT, sin FK, `penalty`/`source` TEXT libres | **Modificada** → `timestamp` INTEGER, FK `session_id → sessions(id)`, CHECK `penalty`/`source` (se mantienen `is_demo`, `moves`, `analysis`, `note`) |
| `sessions` | `created_at` TEXT | **Modificada** → timestamps INTEGER |
| `algorithms` (legacy) | **muerta** (solo tests) | **ELIMINADA** |
| `algorithm_methods` | correcta (FK desde subsets) | Se mantiene |
| `algorithm_subsets` | correcta | Se mantiene |
| `algorithm_cases` | correcta | Se mantiene (recibe las FKs de `training_attempts`/`algorithm_progress`) |
| `algorithm_records` | correcta | Se mantiene |
| `training_attempts` | sin FKs/CHECKs | **Modificada** → FK `case_id → algorithm_cases(id)`, FK `exercise_id → training_exercises(id)`, CHECKs `verdict`/`play_mode`/`metric_kind` |
| `algorithm_progress` | sin FK, sin contadores | **Modificada** → FK `algorithm_id → algorithm_cases(id)`, contadores `exec_*`/`rec_*`, CHECK `srs_state` |
| `exercise_progress` | UNIQUE roto (NULL) | **Modificada** → UNIQUE real sin NULLs, FK `exercise_id → training_exercises(id)` |
| `training_sessions` | agregados snapshot, `status` libre | **Modificada** → CHECK `status`, agregados derivados por query |
| `training_tasks` | ya INTEGER ms, correcta | Se mantiene (opcional: CHECK `repeat`/`color`) |
| `skill_progress` | ya INTEGER ms, correcta | Se mantiene |
| `profiles` | ya INTEGER ms, correcta | Se mantiene (opcional: CHECK `avatar_kind`) |
| `app_meta` | correcta | Se mantiene |
| `_migrations` | infraestructura | Se mantiene (aplica `BASELINE_V2`) |

**Ripple fuera del paquete database** (cambio de `solves.date` → `timestamp`): ajustar
`Solve` en `@cubeforge/models`, `useProfileStats.ts:108`, `usePersistentSession.ts:94` y
`db.edgeCases.test.ts` (consumidores reales: 3, sin riesgo).

### 5.4 Impacto en consumidores (qué se toca y qué sigue igual)

**A. Ripple del esquema (hay que tocar, sí o sí):**

| Archivo | Cambio |
|---|---|
| `@cubeforge/models` (`Solve`, `Session`) | `date` → `timestamp` (number), `created_at/updated_at` → number |
| `apps/web/src/hooks/usePersistentSession.ts` | 5 puntos: `toUISolve` (date), `metaSessions` (createdAt/updatedAt), `addSolve`/`importSolves` (ISO → ms), sesiones por defecto |
| `apps/web/src/hooks/useProfileStats.ts` | `toUISolveSafe` (date + createdAt) |
| `apps/web/src/utils/seedDemoData.ts` | solves demo (date) |
| `packages/database/src/__tests__/db.edgeCases.test.ts` | shape de `Solve.date` |
| `apps/desktop/src/database-override.ts` | mismo `MIGRATIONS` (wipe v2 lo cubre); re-export si cambia el listado de repos |

**B. Contrato de training que cambia (semántica):**

| Archivo | Cambio |
|---|---|
| `TrainingDashboard.tsx` | `getMethodMastery` → coverage/performance; `getPhaseStats` → bloques exec/rec; `masteryLabel` → `masteryLevel` |
| `PhaseStatsView.tsx` | `phaseStats.accuracy` → `phaseStats.execution.accuracy`; umbrales → `masteryLevel`; quitar `void phaseId` |
| `AlgorithmDrillView` / `AlgorithmRecognizeView` | umbrales 90/60 → `masteryLevel`; `exercise_id` canónico |
| Todas las vistas de Training | `exercise_id` canónico (`EXERCISE_IDS.*`) |
| `useTrainingProgress.ts` | adapter sin tipos duplicados; contadores nuevos; constantes desde el paquete |

**C. Sin cambios (todo igual):**

| Consumidor | Por qué |
|---|---|
| `useSkillProgress` (skill_progress) | tabla intacta |
| `useCalendarTasks` (training_tasks) | tabla intacta |
| `useProfile` (profiles, app_meta) | tablas intactas |
| `useSRSQueue`, `SRSReviewView`, `SRSInsightsView`, `ProfileView` | `getTodayQueue`/`getSRSInsights`/`recordReview` no cambian de shape (solo `exercise_id` en SRSReview) |
| `@cubeforge/statistics` (`computeStats`) | recibe `{time, penalty}`, sin dependencia de fechas |
| `useSolveSession` / smart cube | escriben vía `addSolve` con `timestamp` number |
| **Import/Export de solves** (`importSolves.ts`, `exportSolves.ts`) | Trabajan con `timestamp` number (epoch ms) en el lado UI, nunca con `date` de BD. Todos los formatos (csTimer CSV/JSON, TwistyTimer, CubeForge CSV/JSON, generic) ya parsean/serializan a número → **no se tocan** |
| **Perfil** (`ProfileSection`, `useProfile`, `ProfileHero`) | No existe import/export de perfil (solo edición en UI); `profiles`/`app_meta` no cambian de esquema → **sin impacto** |

**D. Nota sobre import/export**: la conversión `timestamp (number) ↔ date (ISO string)` vive SOLO en
`usePersistentSession` (adapter UI↔DB). Con baseline v2 esa conversión **desaparece** (se escribe/lee el
número directamente) → simplificación, no rotura. `importSolves.ts` y `exportSolves.ts` no cambian.

**E. Riesgo nuevo: FKs activas (`PRAGMA foreign_keys=ON`).**

Hoy cualquier string vale como `exercise_id`/`case_id`. Con FKs reales hay que garantizar el **orden de
inserción** y que todo id escrito exista en el catálogo:

- `solves.session_id → sessions(id)`: verificado — la sesión se crea antes que sus solves, y
  `deleteSession` borra solves antes que la sesión ✅
- `training_attempts.exercise_id → training_exercises(id)`: **nuevo requisito** — el registry del
  paquete debe contener EXACTAMENTE los IDs que escriben las vistas (`drill`, `recognize`, `plain`,
  `blind`, `cross-trainer`, `lse-eo|ulur|mslice`, `eo-detect`, `eo-efficiency`, `full-solve`,
  `srs-review`); cualquier id fuera del catálogo romperá en runtime (antes no).
- `training_attempts.case_id → algorithm_cases(id)`: ok — solo drill/recognize/SRS escriben `case_id`
  real del catálogo; el resto usa NULL.
- Acción: **tests de repos con FKs activas** (insertar intentos/solves válidos e inválidos) en Fase 1,
  y el seed de catálogo (`seedIfEmpty` + `training_exercises`) debe ejecutarse antes de cualquier
  escritura de usuario (ya ocurre en `getSharedTracker`/`seedPromise`).

### 5.3 Cleanup asociado

- `apps/desktop/src/database-override.ts`: mover la re-exportación de repos a un re-export desde
  `@cubeforge/database` (sin rutas relativas a packages); `getStorageType()` devuelve el valor real
  (o se cambia la API de UI para no depender del color engañoso).
- `repositories/types.ts` ya re-exporta de `@cubeforge/models` (patrón correcto): los record-types
  de training seguirán el mismo camino desde `@cubeforge/training` (ver §3.6).
- `AlgorithmsRepository.count()` se renombra/clarifica (`countCases()`).

---

## 6. Plan por fases (orden de ejecución)

> Dependencias: las fases 1-3 desbloquean las 4-6. Cada fase termina con `typecheck` + `test` +
> `knip` verdes y, cuando toca UI, verificación manual en browser.

### Fase 0 — Baseline y tests del nuevo modelo métrico (0.5-1 día)
- [ ] Crear `packages/training/src/progress/__tests__/metrics.test.ts` con los tests de invarianza
      (§2.3: monotonicidad, no-interferencia exec/rec, error cero en reconstrucción).
- [ ] `pnpm --filter @cubeforge/training test` (los tests nuevos fallan → sirven de contrato).
- Archivos: `packages/training/src/progress/` (+ tests).

### Fase 1 — Contadores exactos y eliminación de drift (2-3 días)
- [ ] **Baseline v2**: escribir la migración `BASELINE_V2` con el esquema final completo (§5.2) +
      wipe del runner; actualizar `worker.ts` y `database-override.ts` (sin backfill, sin ALTERs).
- [ ] `recordAttempt` reescrito: contadores exactos, sin reconstrucción por redondeo, sin bootstrap
      SM-2 en rama recognition; `computeMastery` con denominador de ejecución exacto.
- [ ] `getPhaseStats` con bloques execution/recognition; `getMethodMastery` → coverage/performance;
      agregados de sesión derivados por query (fin de los snapshots congelados).
- [ ] `withTransaction` en `completeTrainingSession`/`replaceAll`/upserts.
- [ ] BUG `totalSessions` resuelto (columna derivada o contador bien mantenido en baseline v2).
- [ ] Exportar constantes (`DEFAULT_EASE_FACTOR`, `FSRS_DEFAULTS`); quitar hardcodes del hook.
- [ ] Aceptación: tests de invarianza verdes; `pnpm --filter @cubeforge/training typecheck && test`;
      `pnpm --filter @cubeforge/database test` (repo tests actualizados a la nueva semántica).
- Archivos: `progress/progress-tracker.ts`, `progress/insights.ts`, `progress/scheduler.ts`,
  `repositories/training.repository.ts`, `migrations/migrations.ts` (baseline v2),
  `worker.ts`, `apps/desktop/src/database-override.ts`, `hooks/useTrainingProgress.ts`.

### Fase 2 — Tipos unificados (1-2 días)
- [ ] `@cubeforge/database` depende de `@cubeforge/training`; eliminar tipos duplicados del repo;
      el adapter del hook se reduce/elimina.
- [ ] Mover `setupGenerator.test.ts` al paquete.
- [ ] Aceptación: `pnpm typecheck` raíz, `pnpm --filter @cubeforge/database test`.
- Archivos: `packages/database/package.json`, `repositories/training.repository.ts`,
  `packages/database/src/index.ts`, `hooks/useTrainingProgress.ts`.

### Fase 3 — Catálogo de ejercicios real (2-3 días)
- [ ] Ampliar `ITrainingExercise` + implementar los 12 ejercicios reales con IDs canónicos,
      `variants`, `defaults` (incl. `full-solve-targets`, `efficiencyTolerance`).
- [ ] `EXERCISE_IDS` + helpers; `buildMethodPhases` y `subsetForPhase` (en `algorithm-db` o paquete,
      con tests).
- [ ] Tabla `training_exercises` en baseline v2 + seed desde `exerciseRegistry` (sin migración de
      normalización: no hay datos que migrar).
- [ ] Aceptación: tests del registry (`getByMethod`, `getByPhase`, IDs únicos y estables);
      `pnpm --filter @cubeforge/training test`.
- Archivos: `packages/training/src/exercises/`, `packages/training/src/types/exercise.ts`,
  `packages/training/src/generators/setup-generator.ts` (singleton solver), `packages/algorithm-db`.

### Fase 4 — Sesión y timer compartidos (2-3 días)
- [ ] `useTrainingEngine` en la app (composición del engine del paquete + timer + persistencia).
- [ ] `mapTimerState` + `useTimerKeyboard` compartidos; refactor de `useDrillTimer` y
      `useSolveSession`.
- [ ] Migrar `AlgorithmDrillView` y `AlgorithmRecognizeView` (primeros, son el modelo) → validar.
- [ ] Aceptación: las vistas modelo siguen funcionando idénticamente (verificación browser);
      `pnpm --filter @cubeforge/training test` (engine ya tiene 45 tests); typecheck web.
- Archivos: `apps/web/src/hooks/useTrainingEngine.ts`, `timerShared.ts`, vistas drill/recognize.

### Fase 5 — Refactor de vistas "chapuza" (3-5 días)
- [ ] `PhaseStatsView` (umbrales/mapeos unificados, exec/rec separados, escala real).
- [ ] `TrainingDashboard` (data-driven).
- [ ] `FullSolveView` (targets-data, splits skipped, singleton solver, <300 líneas).
- [ ] `CrossTrainerView` (timer + eficiencia tolerante + stats DB).
- [ ] Vistas thin (Plain/Blind/LSE/EO) → IDs canónicos + `useTrainingEngine`.
- [ ] Aceptación: verificación browser de cada vista (flujo completo + datos persistidos
      coherentes entre UI y DB); `pnpm --filter @cubeforge/web typecheck` y tests web.
- Archivos: `apps/web/src/views/Training/**`.

### Fase 6 — Higiene y cierre (1-2 días)
- [ ] Eliminar tabla legacy `algorithms` + CRUD muerto (`AlgorithmsRepository` CRUD legacy,
      `count()` renombrado) — ya eliminados por baseline v2, verificar que no queda código.
- [ ] Ordenar/renumerar migraciones (baseline v2 + correlativas).
- [ ] `intervalFor('again') = 0` + test; decisión `REQUEST_RETENTION`.
- [ ] Eliminar tipos muertos del paquete (los que no tengan consumidor tras las fases 3-5) —
      ejecutar knip con configuración de exports públicos antes de borrar.
- [ ] `pnpm knip`, `pnpm typecheck`, `pnpm test` en todo el repo.
- [ ] Actualizar `docs/plan_training/README.md` (estado) y este documento.

---

## 7. Criterios de éxito (verificables)

1. **% coherentes**: tras una sesión de Drill (correcto + rápido) y una de Recognize, la mastery
   **no baja por el Recognize** (test de invarianza + verificación manual).
2. **Nada hardcodeado**: ningún `exercise_id` con interpolación en las vistas; fases/subset/targets
   provienen de `algorithm-db` o del paquete. Búsqueda: `rg 'exerciseId: `' apps/web` → 0 matches.
3. **Sin tipos duplicados**: `rg 'interface (AlgorithmProgress|TrainingAttempt|PhaseStats)' packages/database` → 0 (imports desde training).
4. **Engine/session/timer reales**: `rg 'TrainingSessionEngine|createTrainingTimer|exerciseRegistry' apps` → matches en vistas, no solo tests.
5. **Stats de Cross/FullSolve con sentido**: accuracy de Cross > 0 % tras intentos razonables;
   splits de FullSolve no contaminan la accuracy de fase (verificable en PhaseStats).
6. `total_sessions` crece con cada sesión.
7. **BD limpia**: sin tabla `algorithms` legacy, un solo formato de tiempo (INTEGER ms), FKs y
   CHECKs activos, `exercise_progress` UNIQUE real, agregados de sesión derivados en vivo.
8. Tamaños: vistas de Training < 300 líneas (meta TDD-0006; excepción negociable para dashboard).

---

## 8. Fuera de alcance (decisión explícita)

- Modos no implementados del diseño v2 (F2L Trainer completo, Metronome/Look-ahead, Recall/Flash,
  Challenges, AI Coach, WeaknessDetector sobre solves reales): el paquete queda **preparado** para
  ellos (el catálogo y el engine los soportan), pero no se implementan en este refactor.
- Backend/`apps/api`: sigue vacío; el refactor no lo toca.
- 4x4+/Megaminx/etc.: se mantiene el fallback a 3x3 documentado.
- Verificación automática de casos con smart cube (CaseVerifier/StateComparer del diseño v1):
  se deja como trabajo futuro sobre `math-core`; hoy Drill/Recognize usan `manual-verdict` (y el
  smart cube para timing/validación de scramble, que ya existe).

---

## 9. Riesgos y decisiones abiertas

| Decisión | Opciones | Recomendación |
|---|---|---|
| Migrar incremental vs **wipe + baseline v2** | ALTERs 022-025 con backfill / DROP y esquema final limpio | **Baseline v2 (confirmado)**: no hay usuarios; es más simple, más correcto y elimina la tabla legacy y los snapshots |
| ¿Timer en Cross Trainer? | Sí (recomendado) / mantener sin timer | Sí: la velocidad es parte de la métrica profesional |
| ¿`buildMethodPhases`/`subsetForPhase` en `algorithm-db` o en `training`? | algorithm-db (los datos viven ahí) / training | algorithm-db, con re-export del paquete si se prefiere un único entry point |
| CHECKs/FKs ahora o después | Migración 025 ahora / deuda documentada | Ahora (barato en pre-release) |
| ¿Adoptar `TrainingSessionEngine` en todas las vistas o solo en las thin? | Todo / solo thin | Todo, con `useTrainingEngine`; FullSolve y Cross conservan orquestación propia pero sobre los mismos primitivos |

---

## 10. Validación final recomendada

Tras cada fase:
```
pnpm --filter @cubeforge/training typecheck && pnpm --filter @cubeforge/training test
pnpm --filter @cubeforge/database test
pnpm knip
pnpm typecheck   # root (turbo)
pnpm test        # root (turbo)
```
Y verificación en browser (Chrome) de: Drill → Recognize → PhaseStats (los % no bajan por
Reconocimiento), FullSolve (splits sin contaminar accuracy), Cross (accuracy real + timer),
Dashboard (coverage/performance, fases correctas por método).
