# Plan de Unificación — Sistema de Análisis (Texto ↔ Smart)

> **Principio rector:** Un solo pipeline. Una sola segmentación de pares. Una sola fuente de
> datos para la UI. La ruta *smart* y la ruta *texto* dejan de tener lógica propia de
> detección: ambas llaman a la **misma función** con las mismas opciones y producen
> **exactamente los mismos datos**. Nada puede divergir.

Fecha: 2026-08-09 · Estado: **Fases 1–7 completadas** · Pendiente: Fase 8 (mejoras)

---

## 0. Contexto: las dos rutas hoy

| | **Texto (reconstrucción)** | **Smart (stats insights)** |
|---|---|---|
| Análisis | `analyzeSolveText.ts` (analysis-engine) | `runAnalysis()` en `useSolveSession.ts` → `MetricsAggregator` |
| Split de fases | `PhaseSplitter.splitAndAnnotate(..., { colorNeutral: true, preferredCrossIdx })` | `PhaseSplitter.splitAndAnnotate(..., { colorNeutral: true })` |
| Pares F2L | `buildPairs` (marco del solver, scheme, premade/auf/colors) | `CFOPMetricsCalculator.analyzeF2LPairs` (marco canónico, sin premade/auf/colors) |
| P2 frame recovery | ✅ `findRecoveryRotation()` + re-detección | ❌ no existe |
| UI | `OurDetectionPanel` + `ReconstructionDetailView` | `SolveAnalysisPanel` |
| Coherencia/warnings | ✅ badge + tooltip | ❌ no se muestran |

Divergencias detectadas (ver análisis en el chat 2026-08-09):

1. **P2 frame recovery** — solo texto (`analyzeSolveText.ts` ~L370-400).
2. **Detección de pares en el marco del solver** — texto usa `countCompletedF2LSlotsInFrame`
   (con scheme); smart usa `countCompletedF2LSlotsCanonical` (canónico).
3. **Datos por par**: `premade`, `auf`, `colors`, `moves` en notación cruda — solo texto.
4. **Tiebreak `preferredCrossIdx`** — solo texto (no hay texto en smart; se pasa `undefined`).
5. **Coherencia + warnings + skips** — datos compartidos (`PhaseDetectionReport`), UI de smart
   no los renderiza.
6. **Comentario obsoleto en `useSolveSession.ts` (L143-145)** — menciona pasar el
   `CubeState` rastreado como initial state; el parámetro `initialState` ya no existe en
   `TimelineBuilder.build` (solo `scramble`).

---

## 1. Arquitectura objetivo

```
                    ┌─────────────────────────────────────────────┐
                    │  analyzeSolve()  (NUEVO, en analysis-engine) │
                    │  packages/analysis-engine/src/pipeline/     │
                    │                                             │
 texto ──► parse ──►│  1. TimelineBuilder.build(                  │
 (analyzeSolveText) │       moves, method, orientations,          │
                    │       scramble, initialFacelets?,           │
 smart ─► compact ─►│       stateTokens?)                         │
 (useSolveSession)  │  2. solveTimeMs override                    │
                    │  3. PhaseSplitter.splitAndAnnotate(         │
                    │       { colorNeutral: true,                 │
                    │         preferredCrossIdx? })               │
                    │  4. recoverRotatedFrame()  ← P2 (no-op si   │
                    │       final canónico)                       │
                    │  5. MetricsAggregator.computeAll            │
                    │       → cfop.f2lPairs via segmentF2LPairs   │
                    └───────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────┴──────────────────┐
                    │ { timeline, metrics }            │
                    │   └─ metrics.cfop.f2lPairs lleva │
                    │      premade/auf/colors/moves    │
                    └───────┬───────────────┬──────────┘
                            ▼               ▼
                SolveAnalysisPanel   OurDetectionPanel
                (añade lo que falta)  (consume atoms compartidos)
```

---

## 2. Fases

### ✅ FASE 1 — Núcleo compartido: `analyzeSolve()`

**Hecho.** Nuevos archivos:

- `packages/analysis-engine/src/pipeline/analyzeSolve.ts`
- `packages/analysis-engine/src/pipeline/frameRecovery.ts`

`analyzeSolve(input): Promise<{ timeline, metrics }>` ejecuta en orden idéntico para ambas
rutas: build → solveTimeMs → split (`colorNeutral: true` + `preferredCrossIdx?`) →
`recoverRotatedFrame` (P2, no-op si final canónico) → `computeAll`.

`recoverRotatedFrame` = extracción exacta del bloque P2 de `analyzeSolveText`:
si `report.finalStateSolved && !finalState.isSolved()` → `findRecoveryRotation()` →
rotar snapshots → re-split con las mismas opciones. Devuelve el report final o `null`.

### ✅ FASE 2 — Una sola segmentación de pares F2L

**Hecho.** Nuevo archivo: `packages/analysis-engine/src/pipeline/segmentF2LPairs.ts`

- `segmentF2LPairs(timeline, { crossFace?, scheme?, displayTokens? }): UnifiedF2LPair[]`
- Contiene la lógica completa de `buildPairs` (marco del solver con scheme, `unsolvedMask`,
  `auf`, lateCross guard, trailing moves del último par) **+** los campos de
  tiempo/tps/pause por par que hoy calcula `CFOPMetricsCalculator`.
- `F2LPairMetrics` (types) ampliado con campos OPCIONALES: `colors`, `auf`, `movesNotation`,
  `completionIndex` → retrocompatible con JSON y tests existentes. (El flag `premade` se
  añadió y luego se ELIMINÓ en Fase 7 — ver §4.7.)
- `CFOPMetricsCalculator` delega en `segmentF2LPairs` (se eliminan `analyzeF2LPairs`,
  `analyzeF2LPairsHeuristic`, `detectCrossFace`, `countCompletedF2LSlots`).
- `analyzeSolveText.buildPairs` pasa a ser un mapeo fino sobre `segmentF2LPairs`
  (misma fuente de datos que la UI smart).

### ✅ FASE 3 — `analyzeSolveText` como adaptador fino

**Hecho.** `analyzeSolveText` conserva SOLO su parseo (rawPhases, inspección, conjugación,
`displayTokens`, `preferredCrossIdx`, `stateTokens`) y la reconstrucción de display
(scheme/orientación, pares con notación cruda, OLL/PLL, rotations). Toda la detección
delega en el núcleo síncrono compartido:

- Nuevo export: `buildAnnotatedTimeline(input)` en `pipeline/analyzeSolve.ts` — build →
  split → P2 recovery, el MISMO código que `analyzeSolve` envuelve (este añade metrics).
  `analyzeSolve` queda como wrapper: `buildAnnotatedTimeline` + `MetricsAggregator.computeAll`.
- Se eliminó del adaptador: `TimelineBuilder.build` + `splitAndAnnotate` + `recoverRotatedFrame`
  inline y el bloque P2 duplicado.
- **Decisión de `solveTimeMs`:** el adaptador NO pasa `solveTimeMs` al núcleo y lo aplica
  DESPUÉS de la detección (como antes). La línea de tiempo texto usa timestamps sintéticos;
  construir el report con el override fabricaría el warning `unattributed-time`. La ruta
  smart lo pasa a través del núcleo (timestamps reales). La duración es semántica de
  entrada por ruta; fases/report/pares son un único pipeline.

### ✅ FASE 4 — UI unificada

**Hecho.** `SolveAnalysisPanel` (ruta smart) muestra ahora exactamente lo que ya mostraba
`OurDetectionPanel` (ruta texto):

- **Atoms compartidos** en `apps/web/src/components/Insights/atoms/`: `FaceChip`,
  `CoherenceBadge`, `WarningsBadge`, `SkippedBadge` + `faceColors` (FACE_HEX/FACE_NAME/
  `colorName`, movido desde `SolveAnalysisPanel`, que los re-exporta por compatibilidad).
  `OurDetectionPanel` refactorizado a los mismos atoms — cero cambio visual.
- **Hero**: badge Coherent/Inconsistent (`m.detectionReport.finalStateSolved`) + warnings
  tooltip (`m.detectionReport.warnings`).
- **Phase breakdown**: badge `skipped` en filas OLL/PLL (`p.skipped`).
- **F2L pairs**: colores del pipeline unificado (`pair.colors` — marco del solver — con
  fallback a `slotFaceColors` para datos persistidos antiguos), badge `premade` y chip
  `auf` por par.

### ✅ FASE 5 — Ruta smart: delegación y limpieza

**Hecho.** `runAnalysis` de `useSolveSession` delega TODO el pipeline en `analyzeSolve`:

- Se eliminó el pipeline manual (`TimelineBuilder.build` + `splitAndAnnotate` +
  `MetricsAggregator.computeAll`) y el `METHOD_DEFS` local — `analyzeSolve` ya mapea
  CFOP/Roux/ZZ/Petrus.
- Se eliminó el comentario obsoleto sobre `initialState` (parámetro que ya no existe).
- Se conserva `compactCubeMoves` como entrada (GAN Gen2 no tiene 180° nativo), el
  `logSolveDiagnostic` (gated por flags) y la compresión de orientation timeline.
- Firma de `runAnalysis` intacta → `useSolveCompletion.ts` no se tocó.
- Garantizado por el test de paridad: `analyzeSolve` reproduce exactamente el pipeline
  manual que usaba `runAnalysis`.

### ✅ FASE 6 — Tests de paridad

**Hecho.** `packages/analysis-engine/src/__tests__/unified-parity.test.ts`: mismo solve →
ruta smart (`analyzeSolve`) y ruta texto (`analyzeSolveText`) → mismas fases, mismo report,
mismos pares. Cubre:

- 8 scrambles (T-perm, 8-move, 4-move, FRUR'U'F', Sune, pair+OLL, corner shuffle) con
  aserción estructural completa por par (slot, colors, auf, completion, moves).
- **Rotación (CubeRoot 2510):** grip `z y` + `x'/y'` inline — las rotaciones escritas se
  conjugan al MISMO stream físico que la smart recibe (helper `physicalMovesFor` usa el
  mismo `conjugatePhaseStream` de `analyzeSolveText`). Paridad estructural completa
  (`compareMoves: false`).
- **XCross (reconz-11413):** par ya en casa al empezar F2L → `crossType: 'xcross'` +
  `xcrossPairs` idénticos en ambas rutas (ver §4.7 sobre el flag `premade` eliminado).
- Helper `expectParity` reutilizable; con `compareMoves: false` excluye `movesNotation` y
  `auf` (frame-dependentes por diseño en solves rotados — comportamiento preexistente a
  la unificación, no regresión).

### ✅ FASE 7 — Validación global + corrección de hallazgos

**Hecho.** Validación completa del monorepo tras Fases 1-6:

- ✅ `pnpm test`: 24/24 tasks OK (0 fallos).
- ✅ `pnpm typecheck`: 31/31 tasks OK (un EPERM transitorio en `@cubeforge/types:build`
  al borrar `dist/index.cjs` en Windows — archivo bloqueado, reintento OK; no es del código).
- ✅ `pnpm lint`: 10/10 tasks OK.
- ✅ Revisión de código de los cambios.

**Hallazgos corregidos (preexistentes o no):**

1. **Flag `premade` muerto en toda la cadena (ELIMINADO).** `segmentF2LPairs` computaba
   `premade = prevMask & (1 << b)` con `b ∈ newBits ⊆ unsolvedMask = ~prevMask` →
   estructuralmente SIEMPRE `false` (flag muerto preexistente al port Fase 2). La Fase 4
   añadió un badge `premade` en la UI que **nunca renderizaba**. Corrección: se eliminó el
   campo de `UnifiedF2LPair`, `F2LPairResult`, `F2LPairMetrics` (types) y de las dos UIs
   (`SolveAnalysisPanel`, `OurDetectionPanel`). Los pares xcross ya se reportan vía
   `report.xcrossPairs`/`crossType` (badge XCross en el phase breakdown).
2. **Hallazgo documentado (no es bug):** en solves xcross, el slot del par pre-hecho PUEDE
   aparecer también como primer par F2L — el detector sitúa la completación del cross donde
   termina la máscara, y los moves de cola del segmento xcross escrito caen dentro del span
   F2L. `report.xcrossPairs` es la etiqueta del cross; `f2lPairs` atribuye los moves
   restantes. Es consistente entre rutas (paridad exacta en `unified-parity.test.ts`) e
   histórico (fixture 11413 ya validado por `PhaseSplitter.xcross.test.ts`).

### ⏳ FASE 8 — Mejoras

Pendiente — lista priorizada en §5.

---

## 5. Mejoras propuestas para Fase 8 (priorizadas)

> Base: el pipeline actual detecta fases CFOP, crossType, pares F2L (slot, colors,
> auf, timing) y coherencia — con paridad perfecta entre rutas. Las mejoras se
> ordenan por impacto / esfuerzo. Cada una indica QUÉ añadir, DÓNDE y POR QUÉ
> existe margen (qué mide hoy el pipeline y qué le falta para el diagnóstico real
> de CFOP).

### M1 — Eficiencia de cross REAL (solver de cross, no heurística ÷8)

- **Qué:** `CFOPMetricsCalculator.crossEfficiency` hoy hace `moveCount/8` (8 = cota
  teórica). Un cross de 7 moves da 0.875 aunque sea óptimo. Margen real: el cross
  óptimo medio está en ~6.2 moves y el máximo es 8, así que la métrica confunde
  "lejos de óptimo" con "malo".
- **Cómo:** añadir un solver de cross por aristas (BFS acotado a 8 ply sobre 4
  aristas + centros, ~ms) que devuelva el óptimo real; `crossEfficiency =
  optimalCross/actual` (1 = óptimo). El solver-engine ya tiene infraestructura
  (PhaseSolver) para reutilizar.
- **Impacto:** la tile "Cross eff" del panel pasa a ser diagnóstica de verdad
  (0.9 real ≠ 0.9 ficticio).

### M2 — Identificación del caso OLL (57) y PLL (21)

- **Qué:** el pipeline detecta las fases OLL/PLL pero no identifica el caso concreto.
  No sabemos QUÉ algoritmo hizo el solver. (Los campos `ollAlgorithmId`/`pllAlgorithmId`
  que existían en `CFOPMetrics` se eliminaron como dead code junto al reconocimiento de
  casos — Fase 8c —; M2 deberá re-añadirlos para exponer el caso.)
- **Cómo:** tras la fase F2L (OLL) y tras OLL (PLL), clasificar el estado de la
  última capa contra las tablas canónicas (orientación de las 8 aristas/corners →
  57 casos; permutación + AUF → 21). El `CubeState` del timeline ya permite leer el
  estado exacto. También permite detectar 2-look (dos mini-secuencias separadas por
  pausa) vs 1-look.
- **Impacto:** diagnóstico real ("hizo OLL 33"), reconocimiento por caso, y base
  para M3 (eficiencia por algoritmo).

### M3 — Eficiencia por par F2L vs óptimo del caso

- **Qué:** `f2lPairs` reporta moves/time/tps por par pero no compara contra lo
  óptimo del caso concreto (los algoritmos F2L estándar son 3-11 moves). Un par de
  11 moves con pausas largas es señal de caso difícil mal ejecutado.
- **Cómo:** por cada slot, usar el solver/BD de pares (o heurística de piezas
  involucradas) para el óptimo del caso; exponer `movesOptimal` por par en
  `F2LPairMetrics`.
- **Impacto:** "Pair 3: 12m vs óptimo 7" — la primera métrica de eficiencia
  verdaderamente actionable de F2L.

### M4 — Lookahead real (pausas entre pares, no solo CV de tiempos)

- **Qué:** `f2lLookaheadScore = 1 − CV(times)` premia consistencia de tiempo, no
  ausencia de pausas. Un solver que mira antes no pausa entre pares.
- **Cómo:** redefinir con `pauseBeforeMs` por par (ya existe en `segmentF2LPairs`):
  score = fracción de pares con `pauseBeforeMs < umbral` (~150-250ms) + penalización
  por pausas largas dentro de F2L.
- **Impacto:** la tile "Lookahead" del panel pasa a medir lo que dice su nombre.

### M5 — `overturns` reales en EfficiencyCalculator

- **Qué:** `EfficiencyMetrics.overturns` está hardcodeado a 0 ("not detectable" con
  el tipo actual `CubeMoveDirection`). Un overturn = giro de 90° que se deshace
  (p. ej. R2 equivalente a R+R) o face que podría cancelar.
- **Cómo:** detectar en el timeline secuencias `X X` y `X X'`/`X' X` (ya lo hace
  RedundancyDetector para cancels/reps) y alimentar `overturns` desde ahí.
- **Impacto:** tile "Drift"/efficiency sin campos fantasma.

### M6 — Rotaciones evitables por fase (ya hay datos; falta la recomendación)

- **Qué:** `RotationCounter` ya computa `byPhase`, `redundantRotations` (y seguido
  de y' = rotación redundante). Falta la lectura pedagógica: "podrías haber evitado
  2 rotaciones en F2L" (y/wide).
- **Cómo:** en la UI, tile "Rotations" con la proporción de rotaciones redundantes
  y una sugerencia por fase (datos ya existen — solo consumo).
- **Impacto:** CERO pipeline nuevo; solo render del dato existente.

### M7 — Métricas de reconocimiento honradas en texto

- **Qué:** con timestamps sintéticos (gap 100ms), `ollRecognitionMs`/`pllRecognitionMs`
  en texto siempre salen ~0-100ms (ruido). El panel las muestra como si fueran reales.
- **Cómo:** si el input es texto sin timestamps reales, no exponer recognitionMs
  (o marcarlo explícitamente como "—"). Es honestidad de datos, no una métrica nueva.
- **Impacto:** elimina lecturas falsas en reconstrucciones.

### M8 — Hardening de `initialFacelets` (smart con facelets reales)

- **Qué:** `AnalyzeSolveInput.initialFacelets` existe (facelet 54 real del
  smartcube al inicio) pero `runAnalysis` no lo pasa. Si se alimenta, el seed del
  timeline deja de ser "scramble aplicado" (fuente de error si el scramble del
  usuario difiere del real).
- **Cómo:** en `useSolveSession`, capturar el facelet inicial del cubo (si el
  firmware lo expone) y pasarlo a `analyzeSolve`.
- **Impacto:** precisión del estado en solves donde el scrambler y el cubo
  divergen (piezas caídas, recogida distinta).

### M9 — Tests de paridad para `metrics` completos (no solo detección)

- **Qué:** `expectParity` compara fases/report/pares/finalSolved. Las métricas de
  tiempo (tps, pauses, rotation, efficiency) dependen de timestamps → en texto son
  sintéticos. Falta un test que fije la SEMÁNTICA (no el valor): p. ej. que las
  pausas de texto son 0 (gap 100ms < umbral 500ms) y que `recognitionMs` de texto
  no se fabrica (M7).
- **Impacto:** la paridad queda garantizada también para la capa de métricas.

---

## 3. Garantías de no-divergencia

1. **Invariante F1:** ambas rutas ejecutan el MISMO código de detección (`analyzeSolve`).
   La diferencia entre rutas es solo de **entrada** (`stateTokens`, `preferredCrossIdx`,
   `initialFacelets`), nunca de lógica.
2. **Invariante F2:** `segmentF2LPairs` es la ÚNICA fuente de pares.
   `metrics.cfop.f2lPairs` y `reconstruction.pairs` se generan con la misma función.
3. **Test de paridad:** cualquier solve produce las mismas fases/report/pares por ambas rutas.
4. **Regresión cero:** `analyzeSolveText.test.ts`, `PhaseSplitter.*`,
   `CFOPMetricsCalculator.integration.test.ts`, `Pipeline.e2e.test.ts`,
   `recon-rotated-solve.test.ts` y `fase2-comparison.test.ts` deben pasar sin cambios.

---

## 4. Riesgos y decisiones

1. `preferredCrossIdx` — solo texto puede generarlo; smart pasa `undefined` (dato de entrada
   ausente, no divergencia de lógica).
2. `stateTokens` — smart nunca emite M/E/S; pasa `undefined` sin pérdida de exactitud.
3. P2 en smart — no-op funcional (cubo físico termina canónico); se ejecuta por uniformidad.
4. Timestamps sintéticos en texto (gap 100ms) vs reales en smart — pares de texto con timeMs
   proporcional a moves; la UI smart ya tolera timestamps uniformes.
5. `F2LPairMetrics` amplía con campos opcionales → el JSON persistido antiguo sigue parseando.
   Decidir si subir `ANALYSIS_PIPELINE_VERSION` a `0.3.0` al terminar todas las fases.
6. **`auf`/`moves` por par (decisión tomada):** `segmentF2LPairs` usa los `displayTokens`
   (notación cruda, ruta texto) cuando existen; si no, deriva los tokens de los propios
   entries del timeline (`entriesToTokens`) para que la ruta smart produzca los mismos
   `auf`/`moves` sobre timelines idénticos. Las dos fuentes coinciden siempre que los
   movimientos son de cara (siempre en smart; en texto, si no hay rotaciones x/z antes de
   un par que empiece por U — y las rotaciones y preservan U). El test de paridad cubre
   todos los casos de cara-pura.
7. **Flag `premade` eliminado en Fase 7.** Era estructuralmente siempre `false` por
   construcción (`newBits ⊆ unsolvedMask = ~prevMask`), flag muerto preexistente al port.
   Se eliminó de toda la cadena (pipeline + tipos + UIs); los pares xcross se reportan vía
   `report.xcrossPairs`/`crossType`. Ver nota 2 de la Fase 7: el slot xcross también puede
   aparecer como primer par F2L (moves de cola del segmento escrito) — consistente entre
   rutas.
8. **`auf` con rotaciones (documentado en Fase 6):** en solves rotados el `auf` del texto
   (leading U de la notación cruda del solver) puede diferir del de smart (leading moves
   físicos conjugados — tras `y'` un `U` escrito es físicamente `D`). Es divergencia
   representacional por diseño (mismo frame que `movesNotation`), preexistente a la
   unificación; el helper `expectParity({ compareMoves: false })` la excluye del
   matching estricto.
9. **Bucle muerto en `computeForwardDriftFast` corregido en Fase 7:** el primer
   `for (const entry of entries)` contaba piezas sin resolver y descartaba el resultado
   (código duplicado sin efecto). Se extrajo `unsolvedCount` y se mantuvo la semántica
   original (fracción de estados con menos piezas sin resolver que el anterior).
