# Widget: algorithm-db (Algorithms)

- **id**: `algorithm-db` · **categoría**: training · **autor**: cubeforge · **v1.0.0** · built-in
- **Componentes**: `FloatingAlgorithmDbPanel`, `AlgorithmDbPreview`, `AlgorithmViewerCard`
- **Definición**: `implementations/algorithm-db/definition.ts`

**Qué hace:** navegador de algoritmos por método y subset con visualizaciones
2D/3D, scrambles de setup y desglose de solución — el catálogo en un panel
flotante, sin salir de la vista.

**Props (`mapProps`)**: `solves`, `puzzle`.

**Notas:** widget pesado (arrastra el motor 3D) — por eso se registra con
`import()` dinámico y queda fuera del bundle inicial.
