# Widget: cube-button (3D cube)

- **id**: `cube-button` · **categoría**: visual · **autor**: cubeforge · **v1.0.0** · built-in
- **Componentes**: `FloatingCubeButton`, `CubeButtonGate`, `Cube3DPreview`
- **Definición**: `implementations/cube-button/definition.ts`

**Qué hace:** botón flotante que abre/cierra la vista 3D del cubo (el panel 3D en
sí NO es un widget — es un sidebar de MainLayout; el botón que lo abre sí).

**Props (`mapProps`)**: `onClick` (`onOpenCube`), `cubePanelOpen`,
`smartCubeConnected` (indicador de smart cube).

**Notas:** es el único widget en `NO_DOCK_WIDGETS` — no participa en el dock
(launcher circular independiente); su estado se fuerza a `docked`.
