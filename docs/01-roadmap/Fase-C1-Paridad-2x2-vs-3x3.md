# Fase C1 — Auditoría de paridad 2×2 vs 3×3

> Fase C del plan `Plan_Eventos_WCA_2026-08.md`. Decide, con evidencia, si
> 2×2 está al mismo nivel que 3×3 y qué brechas hay que cerrar en C2.
> Cada ❌ lleva **dueño + fase asignada** (criterio de salida de C1).

Fecha: 2026-08 · Estado del código: rama `feat/wca-events` (bloque A + B cerrados).
Método: inspección de código real por dimensión (no suposiciones), sobre la
checklist de la investigación §13 y la matriz B1.

---

## Verdicto por dimensión

| # | Dimensión | 3×3 | 2×2 | Veredicto | Evidencia |
|---|---|---|---|---|---|
| 1 | **Scramble** | random-state Min2Phase (WASM) | random-state TwoByTwo (tabla BFS ~800 ms) | ✅ **igual** | A4: 1.000 scrambles verificados por evento (apply + no resuelto + mínimo movs) |
| 2 | **Reglas WCA (timer)** | `SPEED_RULES` | `SPEED_RULES` (mismo objeto del registro) | ✅ **igual** | A5: el perfil de 222 == el de 333 == default del TimerEngine (test de igualdad de referencia) |
| 3 | **Sesiones / persistencia** | repos + migraciones | los mismos; `'222'` canónico (ADR-002, migración 027) | ✅ **igual** | `SessionsRepository`/`SolvesRepository` agnósticos; CHECK valida `'222'` |
| 4 | **Stats** | `computeStats` agnóstico | igual | ✅ **igual** | `useStatsFilters` filtra por `puzzleType`; `useProfileStats.byPuzzle` agrupa `'222'`; widgets filtran por tipo |
| 5 | **Catálogo de algoritmos** | 9 seeds (CFOP OLL/PLL/F2L + COLL/WV/SV/CLS/ELL/Anti-PLL) | Ortega sembrado (OLL 7 + PBL 6); **CLL (42) y EG-1/EG-2 (42+42) registrados pero VACÍOS** | ⚠️ **parcial** | `seed/index.ts` importa solo `ortega.ts`; `methodRegistry` declara CLL/EG (hallazgo §12.4 sin cerrar) |
| 6 | **Análisis por solve** | PhaseSplitter CFOP/Roux/ZZ/Petrus + métricas + Efficiency vs óptimo | **nada** — `analysis: NONE_ANALYSIS` declarado honestamente | ❌ **brecha mayor** | `analysis-engine` no toca `Cube2x2`; solo existe `Cube2x2State` en `math-core` (applySequence/isSolved para validación de scrambles) |
| 7 | **Reconocimiento de casos desde solves** | ❌ (SRS no alimentada por solves reales) | ❌ (igual) | 🟡 **gap compartido, no específico** | Investigación §13.5 #57; dueño: Fase D (genérico), no C |
| 8 | **Import / Export** | csTimer `333` + JSON | csTimer `222` → identidad; `inferPuzzleType` distingue 2×2 (solo R/U/F ≤12 movs) | ✅ **igual** (mejor que 3×3 en inferencia) | `mapPuzzleCode` (`c.startsWith("222")`), `inferPuzzleType` en `importSolves.ts` |
| 9 | **Widgets** | pb-progression / time-distribution / times-log / solve-timeline | los agnósticos filtran por `'222'` igual | ✅ **igual** en los de stats | `FloatingPbProgression` filtra `puzzleType === puzzleCategoryToType(puzzle)` |
| 10 | **Widget phase-balance** | ✅ (usa análisis) | ❌ (no hay fases que balancear) | ❌ **hereda gap 6** | `phaseBalance` consume `analysis` del solve |
| 11 | **Training** | drills, SRS, CrossTrainer | OLL(2×2)/PBL drills funcionan; **CLL/EG drills vacíos** (hereda gap 5); metrónomo igual | ⚠️ **parcial** | `training/src/exercises/catalog.ts` declara `cll/eg1/eg2` con `hasAlgorithms: true` pero sin seed |
| 12 | **Perfil / badges / labels** | `PUZZLE_LABELS` 18 códigos | `'222'` → "2×2" | ✅ **igual** | `puzzleTypes.ts` (SSoT, B) |

---

## Brechas abiertas (todo ❌ con dueño)

| # | Brecha | Impacto | Esfuerzo | Dueño | Fase asignada |
|---|---|---|---|---|---|
| G1 | **Seeds CLL / EG-1 / EG-2 vacíos** (126 casos) | Los drills CLL/EG del training y el catálogo de Algoritmos prometen casos que no existen; el usuario los ve "vacíos" | Medio (entrada de datos 42+42+42 desde SpeedCubeDB, mismo formato que Ortega) | Fase **C2** | C2 (primer item) |
| G2 | **Análisis de solve 2×2** (capas: cara → OLL → PBL) | Sin fases, sin TPS por fase, sin Efficiency vs óptimo (el óptimo 2×2 SÍ existe: TwoByTwoSolver) | Alto (nuevo splitter 2×2 + integración con el pipeline) | Fase **C2** | C2 (segundo item, opcional) |
| G3 | **Widget phase-balance para 2×2** | Depende de G2 | Bajo (una vez existe G2) | Fase **C2** (hereda) | C2 |
| G4 | Reconocimiento de casos desde solves reales | 2×2 y 3×3 por igual | Alto (genérico) | Fase **D** (no específico de 2×2) | D (futuro) |

---

## Decisión para C2 (orden por valor/esfuerzo)

1. **G1 — Sembrar CLL/EG** (alto valor, esfuerzo medio, cero riesgo de datos):
   completa el catálogo 2×2 que ya está declarado y arregla de paso el
   hallazgo §12.4. Verificar con un test que los 126 casos existen y que
   cada caso resuelve su setup (mismo patrón de verificación que Ortega).
2. **G2 — Análisis mínimo 2×2 por capas** (valor medio, esfuerzo alto):
   splitter simple (face → OLL → PBL) sobre `Cube2x2State`; el óptimo ya
   existe (`TwoByTwoSolver`) → Efficiency es gratis una vez hay estado.
   Opcional: hacerlo después de G1 si el valor percibido lo justifica.
3. **G3** se resuelve solo con G2.
4. **G4** queda para Fase D (no es una brecha de 2×2).

---

## Conclusión

2×2 está **al mismo nivel que 3×3 en 8 de 12 dimensiones** (scramble, reglas,
sesiones, stats, import/export, widgets de stats, perfil y — clave — la
infraestructura del bloque A: el selector, la DB validada y el registro ya
lo tratan como ciudadano de primera clase). Las brechas reales son **el
catálogo CLL/EG vacío (G1)** y **el análisis por solve (G2)** — la misma
columna 6 que B1 identificó como el único acoplamiento real a 3×3.
