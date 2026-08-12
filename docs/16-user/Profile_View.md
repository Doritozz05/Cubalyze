# Vista Profile (Perfil / Centro de Identidad)

> Documentada el 2026-08-12 a partir del código real
> (`apps/web/src/views/Profile/ProfileView.tsx`). Verificable contra el código.

## Qué es

La tab **Profile** es el centro de identidad del usuario (implementación F0–F6
del plan de perfil, ver `docs/18-archive/plan_profile/`): hero con identidad
local (CubeMark), tira de estadísticas y pestañas de contenido con **datos
reales** de las demás áreas de la app.

## Estructura

- **Hero (B1)** — `ProfileHero` (componente de `@/components/Identity/`):
  avatar CubeMark (`IdenticonAvatar` renderiza el identicon como SVG inline vía
  `@cubeforge/identicon`: `generateCubeMarkSpec` + `renderCubeMark`), nombre y
  datos de identidad local; botones de navegación y ajustes.
- **Stat strip (B2)** — `StatStrip`: métricas rápidas (solves, tiempos, rachas).
- **Pestañas de contenido (B3)** — con datos reales de cada área:
  - **Stats** — solves de todas las sesiones (`useProfileStats`: normalización
    por puzzle, rachas `computeStreak`, heatmap `buildHeatmapCounts`).
  - **Training** — cola SRS de review (`useSRSQueue`) y progreso
    (`useTrainingProgress`).
  - **Algorithms** — catálogo de algoritmos (conocimiento).
  - **Skills** — XP del árbol de habilidades (`useSkillProgress` + dataset de
    `@/views/SkillTree/skillTreeData`).

## Datos

- Identidad local: avatar CubeMark derivado de un seed (sin backend).
- Estadísticas calculadas de las solves reales (SQLite) vía
  `useProfile` / `useProfileStats`.
- Progreso de entrenamiento y habilidades de sus respectivas tablas.

## Dependencias

- `@cubeforge/identicon` (CubeMark), `@cubeforge/statistics` (agregados),
  `@cubeforge/training` + `@cubeforge/database` (progreso vía hooks),
  componentes de Insights (ActivityHeatmap, MetricRing, SectionHeader).

## ADRs relacionados

- **ADR-024** — el perfil consume la cola SRS y el progreso de Training.
- **ADR-013** — los datos reales vienen de SQLite.
