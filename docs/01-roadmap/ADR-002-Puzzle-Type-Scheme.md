# ADR-002 — Esquema de `puzzle_type`: normalización a códigos WCA

**Fecha**: 2026-08-15
**Estado**: **Aprobado** (decisión tomada — implementar la normalización a códigos WCA)
**Contexto**: Fase A2 del [Plan_Eventos_WCA_2026-08](./Plan_Eventos_WCA_2026-08.md)

---

## 1. Problema

La DB guarda `puzzle_type` con tres convenciones conviviendo:

| Convención | Dónde aparece hoy |
|---|---|
| `'3x3x3'` / `'2x2x2'` | Valor canónico en solves/sessions, algoritmo catálogo, defaults de migraciones |
| `'3x3'` / `'2x2'` | Alias legado escrito por `usePersistentSession` / `seedDemoData` (bug real que la A2 expuso) |
| `'333'` / `'222'` / `'333oh'` | `id` del registro de eventos (`packages/events`), códigos csTimer en imports |

Esto obligó a la migración 026 a incluir un *heal* (CASE WHEN → `'3x3x3'`), que es el
síntoma de una raíz: **no hay un único esquema**. El plan de la A2 era validar contra el
registro; la pregunta que queda es **cuál es el esquema canónico** antes de que la
validación lo congele para siempre.

## 2. Candidatos

| Criterio | `'3x3'` (UI) | `'3x3x3'` (actual) | `'333'` (WCA) |
|---|---|---|---|
| Coincide con el registro (`id`) | ✗ | ✗ | ✅ (mismo string) |
| Import csTimer (`333`) | mapeo | mapeo | **identidad** |
| OH como evento (`333oh`) | `'3x3oh'` (feo) | legacy `'3x3x3'` (mezcla) | ✅ directo |
| Eventos futuros (FTO=`fto`, Clock=`clock`) | inconsistente | inconsistente | ✅ |
| Legibilidad cruda en DB | buena | buena | media |
| Diferenciación UI vs DB | **nula** (mismo string que el label) | confusa (`3x3` vs `3x3x3` — causa del bug) | clara (`3x3` UI, `333` DB) |
| Esfuerzo de migración de datos | alto | ~nulo | alto |
| Esfuerzo de refactor de código | medio | nulo | alto (mecánico) |

**Análisis clave:**
- `'3x3'` (UI): elegante porque `puzzleCategoryToType` casi sería identidad, pero `'3x3 OH'`
  lleva espacio (pésimo como clave de DB), los no-cúbicos (`minx`, `pyram`) ya no siguen el
  patrón dimensional, y no coincide con nada externo.
- `'3x3x3'` (actual): el único mérito es "ya está". Mantiene la dualidad id/puzzleType en el
  registro y la ambigüedad `3x3` vs `3x3x3` que originó el bug. El usuario pidió quitarlo.
- `'333'` (WCA): es el código oficial; colapsa `id` y `puzzleType` en **un solo identificador**;
  el import csTimer pasa a ser identidad; OH se separa naturalmente (`333oh` ≠ `333`), arreglando
  de paso el bug #2 de la investigación sin fases extra; futuro-proof para FTO/Clock.

## 3. Decisión: `puzzle_type` = código WCA (`'333'`, `'222'`, `'333oh'`, …)

`PuzzleType` pasa a ser **exactamente** `WcaEventCode`. El registro deja de tener un
`puzzleType` separado del `id`: la DB persiste el mismo código. `legacyPuzzleType` deja de
tener sentido (OH ya persiste como `'333oh'` desde el día uno tras la migración).

Efectos colaterales positivos:
- **OH como evento propio** (bug #2): `puzzleCategoryToType('3x3 OH')` → `'333oh'`, sesiones y
  stats de OH separadas de 3×3 sin migración de datos especial.
- **Import/export csTimer**: `mapPuzzleCode('333')` → `'333'` (identidad); export escribe lo
  que hay (`'333'`), redondea perfecto.
- **Registro SSoT**: un solo string por evento en `packages/events`, la DB, los filtros de UI.

## 4. Alcance del cambio (inventario)

**Código** (mecánico, `'3x3x3'`→`'333'`, `'2x2x2'`→`'222'` en valores; claves i18n renombradas
solo donde son lookup de puzzle, p. ej. `catalog.phase.3x3x3.cross` → `catalog.phase.333.cross`;
los **strings de display** —"2×2×2 Block" del Petrus— NO se tocan):
- `packages/events`: `PUZZLE_TYPES` = `WCA_EVENT_CODES`; se elimina el campo `puzzleType` del
  `EventSpec` (queda solo `id`); `getEventByPuzzleType` = `getEvent`.
- `packages/models`: defaults `'3x3x3'` → `'333'` (schema refine sin cambio).
- `packages/database`: repos (defaults), `restore.ts`, tests.
- `packages/algorithm-db`: `schema.ts` (defaults), `methodRegistry.ts`, seeds (~3.000 líneas,
  replace mecánico) — el catálogo se siembra en runtime desde este código (`seedIfEmpty`).
- `apps/web`: `puzzleUtils` (mapeos), `importSolves`, `usePersistentSession`, `seedDemoData`,
  `subBadges`, `TimesList`, `InsightsDashboard`, `DashboardSections` (claves `333:cross`…),
  `MethodTree`/`CaseGrid`/`CaseDetailPanel`/… (comparaciones `'2x2x2'`), `ProfileSection`,
  `puzzleTypes.ts` (labels/orden), i18n `es.json`/`en.json` (claves de catálogo), tests.
- `packages/training`: `setup-generator.ts` (guard de 2×2).

## 5. Plan de preservación de datos (solves reales — crítico)

**Dónde viven los datos hoy**: en la OPFS del origen web (per-origin por puerto). `apps/desktop`
no toca puzzle_type. Los solves se escriben con `puzzleCategoryToType` → `'3x3x3'`/`'2x2x2'`;
las sesiones por defecto fueron creadas como `'3x3'` por el código viejo; `profiles.main_puzzle`
usa `'3x3x3'`; las tablas de algoritmos están sembradas con `'3x3x3'`/`'2x2x2'` desde el código.

**Principios**:
1. **Cero pérdida, cero wipes**: ninguna tabla se dropea; migración **aditiva** que convierte
   valores en sitio. Funciona igual da igual el historial de la DB (migraciones 001-025, o 026
   ya aplicada).
2. **Una sola migración nueva (027)** que convierte todo en un paso, con UPDATE por tabla:
   - `solves.puzzle_type` y `sessions.puzzle_type`: `'3x3x3'`/`'3x3'` → `'333'`,
     `'2x2x2'`/`'2x2'` → `'222'`, cualquier otro valor desconocido → `'333'` (default).
   - `algorithm_methods`/`algorithm_subsets`/`algorithm_cases`: `'3x3x3'` → `'333'`, `'2x2x2'` → `'222'`.
   - `profiles.main_puzzle`: `'3x3x3'` → `'333'`, `'2x2x2'` → `'222'`.
3. La migración 026 queda como está (ya pusheada): su heal a `'3x3x3'` queda **supersedido**
   por la 027 en el mismo arranque — nunca se ve un estado intermedio fuera del run de
   migraciones, que es transaccional por migración.
4. **Imports**: `mapPuzzleCode`/`inferPuzzleType` pasan a devolver `'333'`/`'222'` — los
   ficheros csTimer/exportados importan directo. **Exports**: sin cambio (escriben lo almacenado).
5. **Idempotencia**: 027 se registra en `_migrations`; un segundo arranque no la re-ejecuta.

**Verificación obligatoria antes de cerrar**:
- Test de migración real: DB sembrada con datos legados (sesiones `'3x3'`, solves `'3x3x3'`/
  `'2x2x2'`, perfil `'3x3x3'`, algoritmo catálogo `'3x3x3'`) → aplicar migraciones → **contar
  filas antes/después idénticas** y valores convertidos correctamente.
- Smoke test del motor real (sqlite-wasm) con la conversión.
- Suite completa + typecheck + preview (la DB OPFS real de este thread migra de `'3x3x3'` a
  `'333'` en vivo y la app sigue funcionando; sus solves de sesión se conservan).

## 6. Riesgos

- Refactor amplio (≈40 archivos + seeds) → riesgo de romper el catálogo de algoritmos; se
  mitiga con replace mecánico + suite de tests (que cubre MethodTree, training, imports) +
  typecheck.
- Migraciones históricas (001-025) conservan strings `'3x3x3'` en sus SQL (son snapshots
  inmutables — correcto por diseño; el esquema efectivo post-027 es `'333'`).

## 7. Alternativa conservadora

Si se prefiere minimizar riesgo: mantener `'3x3x3'` (candidato B), aceptando la dualidad
id/puzzleType y sin arreglar OH de paso. **No recomendado**: el usuario pidió quitar `3x3x3` y
es el momento ideal (rama sin mergear, sin usuarios web).
