# Vista Reconstructions (Reconstrucciones)

> Documentada el 2026-08-12 a partir del código real
> (`apps/web/src/views/Reconstructions/`). Verificable contra el código.

## Qué es

La tab **Reconstructions** es un explorador de reconstrucciones de solves
(famosos/récords): lista indexada con filtros por puzzle, detalle por solve con
fases del reconstructor, y un **panel de detección propio** que compara la
segmentación del reconstructor con la detección automática por estados del motor
de análisis.

## Inventario archivo por archivo

| Archivo | Qué es |
| --- | --- |
| `ReconstructionsView.tsx` | Explorador: índice con filtro por puzzle (3x3…megaminx, con "All"), ordenación por fecha (`getSortDate`), formato de fecha (`formatDisplayDate`), navegación al detalle |
| `reconData.ts` | Capa de datos: los assets viven en `public/reconstructions/` (generados por `pruebas/scripts/build-recon-web-data.ts` a partir de crawls de CubeRoot + reco.nz): `index.json` (metadatos de cada solve) y los JSON de reconstrucción; tipos `ReconIndexEntry`, `ReconPhase`, `ReconFullRecord` |
| `ReconstructionDetailView.tsx` | Detalle de una reconstrucción: badges de método (`getMethodBadgeClass`), fases del reconstructor, solución, consumo del motor de replay |
| `OurDetectionPanel.tsx` | **Fase 3** de la unificación del análisis: ejecuta la API headless `analyzeSolveText` (mismo setup + inspección + solución que consume el ReplayEngine) sobre el registro y renderiza la detección por estados propia, junto a las fases crudas del reconstructor, en forma de tabla (Fase | Caso | Movimientos | #) |

## Datos

- Dataset **estático** (no de la base de datos): reconstrucciones de récords
  crawleadas (CubeRoot + reco.nz) compiladas a JSON en `public/reconstructions/`.
- El panel de detección usa el mismo pipeline de análisis que las stats
  (`analyzeSolveText` del paquete `@cubeforge/analysis-engine`) — ver
  `docs/18-archive/plan_analysis_unification/` para el plan original.

## Dependencias de paquetes

- `@cubeforge/analysis-engine` — API headless de análisis (`analyzeSolveText`).
- ReplayEngine (componentes de la web) — consume setup/inspección/solución.

## ADRs relacionados

- **ADR-015 / ADR-016** — el análisis y el replay corren en cliente.
- (El análisis por estados se documentará a nivel de paquete en la Fase 4 del
  plan de documentación.)
