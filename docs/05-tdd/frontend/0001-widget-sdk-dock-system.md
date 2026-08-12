# TDD-0002 — Widget SDK & Sistema de Dock

> **Dominio:** frontend · **Estado:** Implementado (as-built, documentado 2026-08-12)
> **Traduce:** ADR-017 + ADR-026 · **Código:** `apps/web/src/widgets/`
>
> Este TDD documenta el diseño **ya implementado** del sistema de widgets
> (SDK, registry, store, dock, explorer, host) — referencia de diseño, no plan
> previo a codificar.

---

## 1. Objetivo

Sistema de widgets como paneles flotantes portaleados, aislados del estado
interno de la app vía una Host API acotada, con carga perezosa y un dock
persistente en el header. Cubre: contrato del SDK, ciclo de vida, registry,
store (estado + persistencia + migraciones), dock (áreas/pieces), banda z y
explorer/host.

## 2. Contrato del SDK (`sdk/`)

### `WidgetPlugin` (lo que exporta cada widget)
```ts
{ id: WidgetId, definition: WidgetDefinition,
  activate(api: WidgetHostAPI): void, deactivate(): void,
  component: ComponentType<{ api, minimized, onToggleMinimize }>, preview? }
```

### `WidgetHostAPI` (única vía de interacción)
```ts
{ solves: readonly Solve[],
  on("solve:completed" | "session:changed" | "scramble:new", handler): () => void,
  log(level: "info"|"warn"|"error", msg): void,
  preferences: { method: string, theme: "light"|"dark"|"system" },
  navigateTo("timer"|"insights"): void }
```
- `createHostAPI(deps)` fabrica una instancia **por widget** (suscripciones
  scopeadas; se limpian al desactivar).

### Ciclo de vida (`WidgetLifecycle.ts`)
- `WidgetLifecycleManager` (singleton): `register`, `activate` (deactivate
  primero si ya estaba activo), `deactivate`.
- `connectWidgetLifecycle(getDeps)` se suscribe al store; ante transición
  `inactive`→activo llama `activate(id, getDeps())` (deps frescas), y
  activo→`inactive` llama `deactivate`.

## 3. Registry (`registry.ts`, `WidgetRegistry.ts`, `registerAllWidgets.ts`)

- `BUILT_IN_WIDGETS`: 11 definiciones (ver fichas en `docs/02-architecture/widgets/`).
- `WidgetRegistry.registerLazy(id, loader)`: el loader devuelve
  `{ component, preview, mapProps }`; `ensure(id)` resuelve el `import()`
  dinámico la primera vez (code-splitting). Un fallo de carga descarta la
  entrada pendiente para que un reintento funcione.
- `registerAllWidgets()` (efecto de módulo, una vez al boot) registra los 11
  built-ins; `mapProps` traduce `WidgetHostProps` → props del widget.

## 4. Store (`widgetStore.ts`)

### Estado
```ts
instances: Record<WidgetId, { status: WidgetStatus, position, zIndex?, panelWidth? }>
dockOrder: WidgetId[]            // legado (pills) — preservado por migración
dockItems: string[]              // lista genérica del dock (widgets + pieces + spacers)
dockAreaOrder: string[]          // áreas del dock en orden ("spacer-2", …)
customLayouts: CustomLayout[]    // snapshots nombrados de posiciones flotantes
```

### Acciones clave
- `toggleWidget`, `setStatus` (con `clampStatus` para `NO_DOCK_WIDGETS`),
  `setPosition`, `resetWidgetPosition` (self-heal al default), `setSize`,
  `dockAt(id, index)`, `focusWidget` (renormalización z), `addDockItem`/
  `removeDockItem`, `addDockArea`/`removeDockArea` (áreas repetibles con
  `nextFreeDockAreaInstanceId`), `saveCustomLayout`/`deleteCustomLayout`.

### Persistencia y migraciones
- Zustand `persist` v8, key `cubeforge:widgets`, `partialize` elimina campos
  runtime (`zIndex`, `panelWidth`).
- `migratePersistedWidgetState` (pura, testeada en `widgetStore.migration.test.ts`):
  - v<4: convierte `{visible, dockMode, minimized}` → `WidgetStatus`.
  - Limpia instancias de ids no built-in (v6: **custom URL-imports eliminados**).
  - Rellena built-ins nuevos (append, sin reordenar el workspace del usuario).
  - v8: areas repetibles con ids de instancia únicos (`spacer-0`, `spacer-1`).

### Banda z
- `Z_MIN = 25`, `Z_MAX = 49` (chrome de la app = z-50: sidebar, dialogs, settings).
- `focusWidget` renormaliza toda la pila en la banda: el último enfocado arriba,
  ninguno puede superar z-49.

## 5. Dock (`dock/`)

- `dockAreasRegistry.ts`: `DOCK_AREAS` — core (widgets, manual-solve, session,
  puzzle), system (clock, profile, battery), layout repetibles (spacer,
  separator); `DEFAULT_DOCK_AREA_ORDER`; `areaBaseId` (quita `-N`).
- `dockEditStore.ts` + `dockZoneState.ts`: estado ligero de módulo vía
  `useSyncExternalStore` — modo edición y zona de drag (Set de ids cerca del
  dock, `dropX`, `dropIndex`).
- `WidgetDock.tsx`: pills macOS-style (running indicator cuando el widget está
  abierto como panel), overflow menu, drag al dock con `DOCK_THRESHOLD = 30px`
  e histéresis anti-vibración.
- `pieces/*`: 8 piezas de sistema (battery, clock, manual-solve, profile,
  puzzle, separator, session, spacer) que comparten el estado `dockAreaOrder`.

## 6. Explorer y Host (`explorer/`)

- `WidgetExplorer`: catálogo por categoría (visual/timer/analysis/training) con
  `WidgetCard` y previews live (`WidgetPreviews`).
- `WidgetHost`: monta los widgets activos como paneles portaleados, resolviendo
  vía `WidgetRegistry.ensure` y aplicando `mapProps`.
- `FloatingWidgetWrapper`: panel común (drag, minimizar, snap al dock, z-index).

## 7. Criterios de aceptación (tests existentes)

- `widgetRegistry.test.ts` — registro lazy (ensure/resuelve/falla y reintenta).
- `widgetStore.migration.test.ts` — migración de layouts previos (v<4 y
  versiones posteriores) sin perder el orden relativo.
- Tests por widget: p.ej. `phase-balance/phaseBalance.test.ts` (lógica pura
  extraída del componente).
- E2E/Playwright: pendiente (ADR-005).
