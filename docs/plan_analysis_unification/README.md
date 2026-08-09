# Plan de Unificación — Sistema de Análisis (Texto ↔ Smart)

> **Principio rector:** Un solo pipeline. Una sola segmentación de pares. Una sola fuente de
> datos para la UI. La ruta *smart* y la ruta *texto* dejan de tener lógica propia de
> detección: ambas llaman a la **misma función** con las mismas opciones y producen
> **exactamente los mismos datos**. Nada puede divergir.

Fecha: 2026-08-09 · Estado: **Fase 1+2 implementadas** · Pendiente: Fases 3–7

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
  `premade`, `auf`, lateCross guard, trailing moves del último par) **+** los campos de
  tiempo/tps/pause por par que hoy calcula `CFOPMetricsCalculator`.
- `F2LPairMetrics` (types) ampliado con campos OPCIONALES: `colors`, `auf`, `premade`,
  `movesNotation`, `completionIndex` → retrocompatible con JSON y tests existentes.
- `CFOPMetricsCalculator` delega en `segmentF2LPairs` (se eliminan `analyzeF2LPairs`,
  `analyzeF2LPairsHeuristic`, `detectCrossFace`, `countCompletedF2LSlots`).
- `analyzeSolveText.buildPairs` pasa a ser un mapeo fino sobre `segmentF2LPairs`
  (misma fuente de datos que la UI smart).

### ⏳ FASE 3 — `analyzeSolveText` como adaptador fino

Pendiente. `analyzeSolveText` conservará solo su parseo (rawPhases, inspección, conjugación,
`displayTokens`, `preferredCrossIdx`, `stateTokens`) y delegará todo lo demás a
`analyzeSolve` (split, P2, metrics, pares). Eliminar la re-detección propia.

### ⏳ FASE 4 — UI unificada

Pendiente. `SolveAnalysisPanel` añade: badge Coherent/Inconsistent (`finalStateSolved`),
warnings tooltip, badges OLL/PLL skipped, colores/premade/auf por par. Extraer atoms
compartidos (`FaceChip`, `CoherenceBadge`, `WarningsBadge`, `SkippedBadge`).

### ⏳ FASE 5 — Ruta smart: delegación y limpieza

Pendiente. `runAnalysis` de `useSolveSession` llama a `analyzeSolve`. Eliminar el comentario
obsoleto (initialState). Mantener `compactCubeMoves` como entrada (hardware GAN Gen2).

### ⏳ FASE 6 — Tests de paridad

**Hecho.** `packages/analysis-engine/src/__tests__/unified-parity.test.ts`: mismo solve →
ruta smart (`analyzeSolve`) y ruta texto (`analyzeSolveText`) → mismas fases, mismo report,
mismos pares. Cubre 8 scrambles (T-perm, 8-move, 4-move, FRUR'U'F', Sune, pair+OLL, corner
shuffle) con aserción estructural completa por par (slot, colors, auf, premade, completion,
moves). Ampliar cuando se hagan Fases 3-5.

### ⏳ FASE 7 — Validación

Pendiente. `pnpm test`, `typecheck`, lint, code-review.

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
