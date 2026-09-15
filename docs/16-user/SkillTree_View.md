# Vista SkillTree (Árbol de Habilidades)

> Documentada el 2026-08-12 a partir del código real
> (`apps/web/src/views/SkillTree/`). Verificable contra el código.

## Qué es

La tab **SkillTree** muestra un grafo de habilidades de speedcubing organizado en
categorías (fundamentals, cross, f2l, last-layer, lookahead, finger-tricks,
inspection) con **prerrequisitos**: completar una habilidad desbloquea las
siguientes. El progreso persiste localmente.

## Estructura de la pantalla

- `UltraSkillTreeView` — vista principal: filtros por categoría (`all` +
  categorías), calcula el **estado dinámico** de cada nodo
  (completed / unlocked / locked) a partir de los ids completados
  (`useSkillProgress`) y los prerrequisitos del dataset.
- `SkillGraphCanvas` — lienzo canvas con zoom/pan (ZoomIn/ZoomOut/Maximize),
  enlaces de prerrequisito (líneas que se iluminan al desbloquear), y nodos con
  estado visual (completado/desbloqueado/bloqueado con candado).
- `SkillNodeModal` — modal de detalle del nodo: descripción, estado, y
  completar/descompletar la habilidad.
- `skillTreeData.ts` — **dataset estático** de nodos (`ALL_SKILL_NODES`) con
  ids, títulos localizados, categorías, prerrequisitos y descripciones;
  `NODE_BY_ID` para resolver prerrequisitos.
- `skillTreeLayout.ts` — algoritmo **determinista** de layout: calcula
  coordenadas (x, y) del canvas con cero solapamientos, columnas por rama
  verticales y progresión topológica.

## Datos y persistencia

- El progreso (`completedIds`) lo gestiona `useSkillProgress` (hook de
  `@/hooks`), persistido en SQLite en la tabla **`skill_progress`**
  (migración `013_create_skill_progress`, reemplaza el localStorage como fuente
  de verdad).
- Los títulos/descripciones se localizan por clave i18n
  (namespace `skillTree`).

## Dependencias

- `@cubalyze/database` (tabla `skill_progress`), i18n (`useTranslation`),
  framer-motion (animaciones de canvas/zoom), lucide-react (iconos).
- El XP de habilidades se consume también desde el perfil
  (vista Profile, tab "Skills").

## ADRs relacionados

- **ADR-013** — persistencia en SQLite (tabla `skill_progress`).
- **ADR-021** — el dataset y la lógica viven en el repo, versionados.
