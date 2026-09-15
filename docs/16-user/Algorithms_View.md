# Vista Algorithms (Algoritmos)

> Documentada el 2026-08-12 a partir del código real
> (`apps/web/src/views/Algorithms/`). Verificable contra el código.

## Qué es

La tab **Algorithms** es el explorador del catálogo de algoritmos: navega por
método → subset → caso, visualiza cada caso con diagramas 2D/3D, edita algoritmos
personalizados y salta a entrenar un caso concreto en la tab Training.

## Estructura de la pantalla

`AlgorithmDashboard` es el shell con 3 zonas:

- **Árbol de métodos** (desktop, ≥1024px): `MethodTree` — navegación puzzle →
  método → subset con colapso.
- **Navegador móvil** (touch, <1024px): `MobileMethodNavigator` — drill-down con
  breadcrumb (ej. "3×3 › CFOP › PLL") + búsqueda instantánea de subsets hoja.
- **Grid de casos**: `CaseGrid` — tarjetas de los casos del subset seleccionado.
- **Panel de detalle** (al seleccionar un caso): desktop = panel lateral;
  touch = overlay a pantalla completa con slide-in (framer-motion).

El estilo de visualización se resuelve por subset
(`resolveVisualizationStyleForSubset`: `full-color` para PLL/F2L, `yellow-gray`
para OLL, etc.). El subset inicial por defecto es **PLL**.

## Inventario archivo por archivo

| Archivo | Qué es |
| --- | --- |
| `AlgorithmDashboard.tsx` | Shell: estado de subset/caso seleccionado, filtrado del catálogo, estilo de visualización, layout desktop/touch, puente a Training (`onPracticeCase`) |
| `components/MethodTree.tsx` | Árbol puzzle→método→subset (desktop); resalta el subset seleccionado |
| `components/MobileMethodNavigator.tsx` | Navegación drill-down touch con breadcrumb (`pathLabelFor`) y búsqueda por nombre de subset |
| `components/CaseGrid.tsx` | Grid de tarjetas de casos (memoizado), selección toggle |
| `components/CaseDetailPanel.tsx` | Panel de detalle del caso: algoritmos del caso, botón de práctica, cierre; variantes side-panel (desktop) y overlay (touch) |
| `components/CaseDiagram.tsx` | Diagrama 2D SVG genérico (PLL, OLL, COLL, WV…): generación dinámica de facelets desde movimientos/scrambles; estilos `full-color` y `yellow-gray`; flechas e rotación |
| `components/Case2x2Diagram.tsx` | Diagrama 2D adaptado a 2×2 (Ortega OLL/PBL): grid 2×2 de la cara U + tiras laterales |
| `components/Case3DDiagram.tsx` | Diagrama 3D del caso (facelet string → estado 3D) con ángulo de cámara configurable (`customViewAngle`, theta/phi/radius) |
| `components/Case3DPanel.tsx` | Panel 3D por caso; extrae el slot F2L de las notas del algoritmo (ej. "Slot: FR") |
| `components/AlgorithmEditorDialog.tsx` | Diálogo editor de **algoritmos personalizados** (ids `custom-*`): captura de orientación de cámara 3D (`cameraToSpherical`), edición y creación |
| `components/SortableAlgorithmItem.tsx` | Tarjeta de algoritmo **ordenable por drag-and-drop** (dnd-kit) con acciones select/edit/delete y marcado de primario |

## Datos

- El catálogo (métodos, subsets, casos, algoritmos) proviene de
  `getSeedData()` de `@cubalyze/algorithm-db`. El código comenta
  "in-memory for now; database integration later" — la vista lee el catálogo en
  memoria (la siembra a SQLite ocurre en el lado de Training vía
  `seedIfEmpty`).
- Los algoritmos personalizados se crean/editan en el editor (ids `custom-*`);
  el orden de las tarjetas es arrastrable dentro del caso.

## Dependencias de paquetes

- `@cubalyze/algorithm-db` — catálogo + `resolveVisualizationStyleForSubset`.
- `@cubalyze/math-core` — estado de cubo y facelets (vía diagramas).
- `@cubalyze/cube-3d-engine` — render del diagrama 3D.
- `@cubalyze/solver-engine` — scrambles de setup (diagramas).
- dnd-kit (ordenar tarjetas), Radix UI (dialog), framer-motion (overlay touch).

## ADRs relacionados

- **ADR-017** — extensibilidad: el catálogo vive en un paquete de dominio
  (`algorithm-db`), no en la UI.
- **ADR-024** — el puente "Practice case" abre el drill del caso en Training.
- **ADR-015** — los diagramas usan scrambles de setup del solver.
