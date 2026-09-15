# Sistema de Widgets — Arquitectura

> Documentado el 2026-08-12 (Fase 2) a partir del código real
> (`apps/web/src/widgets/`). Verificable contra el código.

## Qué es

Cubalyze tiene un **sistema de widgets**: paneles flotantes portaleados que el
usuario puede activar desde el Explorer, fijar en el dock del header o dejar
flotando sobre la vista. El sistema es un mini-SDK inspirado en el patrón de
activación de extensiones de VS Code y la API de widgets de Figma: los widgets
se comunican con la app solo a través de una **Host API** acotada, nunca con los
stores internos.

## Piezas del sistema

| Zona | Archivos | Responsabilidad |
| --- | --- | --- |
| **SDK** | `sdk/types.ts`, `sdk/HostAPI.ts`, `sdk/WidgetLifecycle.ts` | Contrato del plugin (`WidgetPlugin`), API pública hacia la app (`WidgetHostAPI`), ciclo de vida activate/deactivate |
| **Registry** | `registry.ts`, `WidgetRegistry.ts`, `registerAllWidgets.ts` | Catálogo (`BUILT_IN_WIDGETS`), **registro lazy** con `import()` dinámico por widget (code-splitting) |
| **Store** | `widgetStore.ts` (+ `migration.ts`, `types.ts`) | Estado persistido (Zustand vanilla + `persist` v8): instancias, dock, áreas, layouts custom |
| **Dock** | `dock/` (`WidgetDock`, `DockExplorer`, `DockItemCard`, `dockAreasRegistry`, `dockEditStore`, `dockZoneState`, `pieces/*`) | Barra del header: pills de widgets + **piezas de sistema** (reloj, batería, puzzle, perfil…) |
| **Explorer** | `explorer/` (`WidgetExplorer`, `WidgetCard`, `WidgetHost`, `WidgetPreviews`, `WidgetExplorerSidebar`) | Navegador de widgets por categoría; `WidgetHost` monta los activos |
| **Wrapper** | `components/FloatingWidgetWrapper.tsx` | Panel flotante común: drag, minimizar, snap al dock (zona con histéresis), z-index |

## Contrato del SDK

### `WidgetPlugin` (lo que exporta cada widget)
```ts
{ id, definition, activate(api), deactivate(), component, preview? }
```
- `activate(api)` se llama una vez al activarse (OFF → ON); `deactivate()` al apagarse.
- `component` recibe `{ api, minimized, onToggleMinimize }`.

### `WidgetHostAPI` (lo único que un widget ve de la app)
```ts
{ solves (readonly), on("solve:completed" | "session:changed" | "scramble:new", cb),
  log(level, msg), preferences: { method, theme }, navigateTo("timer"|"insights") }
```
Cada instancia de widget tiene su propio `HostAPI` (`createHostAPI`): las
suscripciones a eventos están **scopeadas por widget** y se limpian al desactivar.

### Ciclo de vida
`connectWidgetLifecycle` se suscribe al store y, cuando un widget pasa de
`inactive` → activo, llama `widgetLifecycle.activate()` (con deps frescas vía
callback); al volver a `inactive`, `deactivate()`.

## Registry y carga perezosa

- `registry.ts` declara los 11 built-ins (`BUILT_IN_WIDGETS`), cada uno con su
  `WidgetDefinition` (id, nombre, icono, categoría, autor, versión, source,
  defaultActive, defaultPosition, tags).
- `WidgetRegistry.registerLazy(id, loader)` registra el **loader dinámico**; el
  `ensure(id)` resuelve el componente la primera vez que se necesita. Esto saca
  dependencias pesadas (motor 3D, iconos de banderas…) del bundle inicial.
- `registerAllWidgets()` se llama una vez al arrancar la app (efecto de módulo).

## Store (`widgetStore`)

- **Modelo de estado único**: `WidgetStatus = "inactive" | "docked" | "floating" | "minimized"`.
  Reemplaza el trío anterior `{visible, dockMode, minimized}` que permitía
  estados contradictorios ("ghost widgets").
- **Persistencia**: Zustand `persist` v8, key `cubeforge:widgets`, con
  migración (`migratePersistedWidgetState`): limpia instancias huérfanas,
  rellena built-ins nuevos, y versiona (`nextFreeDockAreaInstanceId` para áreas
  repetibles).
- **Bandas z**: los widgets viven en la banda **z-25..49**, por debajo del
  chrome de la app (sidebar/dialogs/settings = z-50). `focusWidget()` renormaliza
  toda la pila al enfocar (el último arrastrado queda arriba, pero nunca supera
  z-49).
- **Self-heal**: reactivar un widget resetea su posición al default de la
  definición (nunca reaparece fuera de pantalla con una posición corrupta).
- **Layouts custom**: `saveCustomLayout`/`deleteCustomLayout` guardan snapshots
  de posiciones flotantes nombrados.
- `NO_DOCK_WIDGETS` (`cube-button`): widgets que no usan el dock (launcher
  circular independiente).

## Dock (barra del header)

- `WidgetDock` renderiza pills de widgets activos + **piezas de sistema**
  (`dockAreasRegistry` → `DOCK_AREAS`):
  - **core** (por defecto): widgets, manual-solve, session, puzzle.
  - **system**: clock, profile, battery.
  - **layout** (repetibles): spacer, separator.
- `dockAreaOrder` (persistido) determina qué áreas aparecen y en qué orden;
  `areaBaseId` quita el sufijo de instancia (`spacer-2` → `spacer`).
- **Modo edición** (`dockEditStore`): añadir/quitar/reordenar áreas; los
  espaciadores/separadores son repetibles con ids únicos.
- **Pill macOS-style**: el widget abierto como panel mantiene su pill con un
  **punto de running indicator**; clic en el pill togglea lanzar/fijar.
- **Drag al dock**: arrastrar un panel flotante hacia la parte superior
  (`DOCK_THRESHOLD = 30px`) activa la zona del dock (`dockZoneState`, con
  histéresis anti-vibración); el drop lo inserta en la posición calculada.

## Explorer y Host

- `WidgetExplorer` (abierto desde la nav) lista los widgets por categoría
  (visual / timer / analysis / training) con tarjetas y **previews** live.
- `WidgetHost` monta los widgets activos como paneles portaleados, resolviendo
  cada componente vía registry y traduciendo `WidgetHostProps` a las props de
  cada widget con su `mapProps` (sin switch-case).

## Fichas por implementación

Ver [`widgets/`](./widgets/) — 11 fichas (una por built-in):
[times-log](./widgets/README.md), scramble-2d, cube-button, time-distribution,
pb-progression, solve-timeline, phase-balance, metronome, notes, algorithm-db,
layout-organizer.

## ADRs y TDDs relacionados

- **ADR-017** (Plugin System) — la decisión de extensibilidad a alto nivel
  (implementada como widgets, no `packages/plugins/*`).
- **ADR-026** — **Widget SDK y Arquitectura del Host** (`docs/03-adr/ADR-026-Widget_SDK_Host_Architecture.md`):
  el SDK host-aislado (`WidgetPlugin`/`WidgetHostAPI`), el modelo de estado único,
  la banda z y la política de seguridad (solo built-ins; URL-imports eliminados).
- **TDD-0002** — diseño concreto del sistema
  (`docs/05-tdd/frontend/0001-widget-sdk-dock-system.md`): contrato del SDK,
  lifecycle, registry lazy, estado/migraciones del store (persist v8), dock
  (áreas/pieces/zona de drag) y explorer/host.
- **ADR-009** (Zustand) — el `widgetStore` es un store Zustand vanilla persistido.
- **ADR-016** (Comlink/Workers) — el registro lazy aplica code-splitting.

> Nota: abrir el sistema a **widgets de terceros** (source: "community" |
> "custom") con un mecanismo seguro requeriría un ADR nuevo — hoy es
> built-in-only por seguridad local-first.
