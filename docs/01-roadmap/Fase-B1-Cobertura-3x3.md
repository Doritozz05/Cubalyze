# Fase B1 — Mapa de cobertura 3×3 (matriz de dependencias)

> Fase B del plan `Plan_Eventos_WCA_2026-08.md`. Recorre el flujo completo
> de un solve 3×3 (timer → scramble → sesión → stats → análisis → catálogo →
> import/export → widgets) y documenta **qué pieza depende del evento**.
> Sirve de checklist para la Fase D: cada evento nuevo debe decidir qué
> columnas toca y cuáles declara "no aplica".

Fecha: 2026-08. Estado del código: rama `feat/wca-events` (bloque A cerrado).

---

## El flujo, etapa por etapa

| # | Etapa | Archivos clave | ¿Depende de 3×3? | Qué necesita un evento nuevo |
|---|---|---|---|---|
| 1 | **Selector / estado de puzzle** | `apps/web/src/utils/puzzleUtils.ts` (`PUZZLE_SELECTOR`, `SELECTABLE_PUZZLE_CATEGORIES`), `apps/web/src/hooks/useScrambleState.ts`, `apps/web/src/types/index.ts` (`PuzzleCategory`) | Generado del registro (A6) — **no** hardcodeado | Nada: declarar el evento con `scrambleProvider` lo hace seleccionable automáticamente |
| 2 | **Scramble** | `packages/events/src/providers.ts` (contrato), `packages/events/src/registry.ts` (ids), `apps/web/src/utils/scrambleProviders.ts` (impl 2×2/3×3), `packages/solver-engine` (Min2Phase, TwoByTwo) | **Sí** — solo 2×2/3×3 tienen provider real | Un `ScrambleProvider` que genere el scramble oficial del evento + validación de estado (`applySequence` + `!isSolved()`) |
| 3 | **Timer + reglas WCA** | `packages/timer-engine/src/WcaRules.ts` (perfiles SPEED/BLD/FMC/MBLD, A5), `packages/timer-engine/src/TimerEngine.ts` (consume `rules`), `apps/web/src/hooks/useSolveSession.ts`, `apps/web/src/App.tsx` (pasa `rules` del evento) | **No** — perfilado por evento (A5) | Nada: el perfil de reglas ya se declara en el registro; BLD/FMC/MBLD ya tienen el suyo |
| 4 | **Sesiones / persistencia** | `apps/web/src/hooks/usePersistentSession.ts`, `packages/database/src/repositories/{solves,sessions}.repository.ts`, migraciones 001–027 (`packages/database/src/migrations/migrations.ts`) | **No** — `puzzle_type` = código WCA (ADR-002), validado contra el registro (A2) | Nada: los solves se guardan con el código del evento y la DB lo acepta |
| 5 | **Stats** | `packages/statistics` (`computeStats`, `averageOf`, `computeBpaWpa`), `apps/web/src/hooks/useProfileStats.ts` (agregación por puzzle) | **No** — motor agnóstico; filtra por `puzzle_type` | Nada (stats de tiempo); FMC/MBLD necesitarán scoring propio (`fmc-moves`, `mbf-points` ya declarados) |
| 6 | **Análisis por solve** | `packages/analysis-engine` (`PhaseSplitter`, `MetricsAggregator`, `analyzeSolve`), `packages/math-core` (`CubeState`, 54 stickers), `apps/web/src/hooks/useSolveSession.ts` (`runAnalysis`), `apps/web/src/utils/solveAnalysisCoordinator.ts` | **Sí — 3×3-only hoy** (CFOP/Roux/ZZ/Petrus) | Un modelo de estado del puzzle + definiciones de método (`MethodDefinition`) + fases |
| 7 | **Catálogo de algoritmos** | `packages/algorithm-db` (`methodRegistry`, `schema`, `seed/cfop-*.ts`, `coll.ts`, `wv.ts`, `ortega.ts`), `apps/web/src/views/Algorithms/*` | **Sí** — seeds 3×3 (CFOP, COLL, WV, …) y 2×2 (Ortega); subset "2x2x2 Block" de Petrus | Seeds de métodos del evento (CLL/EG para 2×2 en C2; métodos de Fase D) |
| 8 | **Import / Export** | `apps/web/src/utils/importSolves.ts` (`mapPuzzleCode`, `inferPuzzleType` — sesgo 3×3), `apps/web/src/utils/exportSolves.ts` (JSON full-fidelity) | **Parcial** — csTimer usa códigos WCA (identidad, ADR-002), pero `inferPuzzleType` asume 3×3 sin columna de puzzle | Revisar `inferPuzzleType` cuando existan scrambles de otros eventos; export no cambia |
| 9 | **Widgets** | `apps/web/src/widgets/implementations/{pb-progression,time-distribution,phase-balance,solve-timeline,times-log,scramble-2d}` | **Parcial** — `phase-balance` usa análisis → 3×3-only; pb-progression/time-distribution solo stats (agnósticos) | El análisis (6) es el cuello de botella: widgets basados en análisis quedan bloqueados hasta que el evento tenga fases |
| 10 | **Perfil / identidad** | `apps/web/src/hooks/useProfileStats.ts`, `apps/web/src/utils/subBadges.ts`, `apps/web/src/utils/puzzleTypes.ts` (`PUZZLE_LABELS` — los 18 códigos), `apps/web/src/components/Identity/*` | **No** — labels y badges ya cubren los 18 eventos | Nada |

---

## Matriz de dependencia por evento (estado hoy)

| Evento | Selector (1) | Scramble (2) | Reglas (3) | DB (4) | Stats (5) | Análisis (6) | Catálogo (7) | Import/Export (8) | Widgets (9) | Perfil (10) |
|---|---|---|---|---|---|---|---|---|---|---|
| **3×3** | ✅ | ✅ Min2Phase | ✅ SPEED | ✅ | ✅ | ✅ CFOP/Roux | ✅ CFOP… | ✅ | ✅ (analysis) | ✅ |
| **2×2** | ✅ | ✅ TwoByTwo | ✅ SPEED | ✅ | ✅ | ❌ (declarado `none`) | ✅ Ortega | ✅ | parcial | ✅ |
| **3×3 OH** | ✅ | ✅ (reusa 3×3) | ✅ SPEED | ✅ (`333oh`) | ✅ | ✅ (mismo motor) | ✅ (mismo catálogo) | ✅ | parcial | ✅ |
| 4×4–7×7, minx, pyram, skewb, sq1 | ❌ (no se muestran) | ❌ | ✅ declarado | ✅ | ✅ | ❌ | ❌ | ⚠️ `inferPuzzleType` | ❌ | ✅ |
| BLD×3 | ❌ | ❌ | ✅ BLD | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ |
| FMC / MBLD | ❌ | ❌ | ✅ FMC/MBLD | ✅ | ⚠️ scoring distinto | ❌ | ❌ | ⚠️ | ❌ | ✅ |
| Clock / FTO | ❌ (Clock retirado) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ |

**Leyenda**: ✅ hecho · ❌ pendiente/declarado ausente · ⚠️ parcial o necesita revisión.

---

## Conclusiones

1. **El cuello de botella es la columna 6 (análisis)** — es lo único *realmente*
   3×3 en el motor. Todo lo demás ya es genérico gracias al bloque A
   (selector del registro, reglas por evento, DB validada, stats agnósticas).
2. **La columna 2 (scramble)** es la siguiente prioridad: cada evento de la
   Fase D necesita su provider + validación de estado (requiere la decisión
   RFC de librería de scrambles para D2–D7).
3. **`inferPuzzleType` (import, columna 8)** tiene sesgo 3×3: sin columna de
   puzzle en el archivo, asume 3×3. Revisar cuando exista el primer evento
   con geometría distinta (Pyraminx, D2).
4. **El widget `phase-balance`** depende del análisis → hereda el bloqueo de
   la columna 6 para cualquier evento sin fases.
5. **Perfil, stats y sesiones ya están listos para los 18 eventos** — la
   columna 10 y la 4 no se vuelven a tocar en la Fase D.
