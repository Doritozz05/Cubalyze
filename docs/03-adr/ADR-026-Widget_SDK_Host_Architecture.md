---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-08-12"
last_updated: "2026-08-12"
version: "1.0.0"
related_rfc: "Ninguno (decisión registrada retroactivamente el 2026-08-12)"
supersedes: "Ninguno"
superseded_by: "None"
tags: "widgets, sdk, extensibility, host-api, dock"
document_type: "ADR"
---

# ADR-026 — Widget SDK y Arquitectura del Host

> **Nota de registro:** decisión ya implementada (`apps/web/src/widgets/`), registrada
> retroactivamente el 2026-08-12 (Fase 2 de documentación). Complementa al
> ADR-017, que registra la decisión de extensibilidad a alto nivel; este ADR
> registra **cómo** se materializó (el SDK y el host).

## Context and Problem Statement

El sistema de widgets (ADR-017) necesita una arquitectura de host que permita
paneles flotantes seguros y mantenibles dentro de la app:

- **Aislamiento**: los widgets no deben depender de los stores internos de la
  app (si cambia el estado interno, se rompen los widgets).
- **Carga perezosa**: los widgets pesados (motor 3D, iconos) no deben inflar el
  bundle inicial.
- **Estados no contradictorios**: el modelo anterior de visibilidad
  (`{visible, dockMode, minimized}`) permitía estados imposibles que renderizaban
  "ghost widgets" (visible + docked sin renderizar en ningún sitio).
- **Orden de capas**: los widgets flotantes deben poder superponerse entre sí
  pero **nunca** tapar el chrome de la app (sidebar, dialogs, settings).
- **Seguridad local-first**: el proyecto es 100% local; importar código de
  terceros en runtime (widgets por URL) es un riesgo de seguridad.

## Decision Drivers

- **Aislamiento del host**: un contrato de API público (`WidgetHostAPI`) como
  única vía de interacción widget↔app.
- **Rendimiento**: `import()` dinámico por widget (code-splitting).
- **Determinismo**: un único modelo de estado por widget (`WidgetStatus`).
- **Persistencia sin corrupción**: migraciones versionadas del estado guardado.
- **Seguridad**: sin ejecución de código de terceros no empaquetado.

## Considered Options

- **Opción 1 (elegida): SDK interno con Host API acotada.** `WidgetPlugin` +
  `WidgetHostAPI` (eventos, solves readonly, preferencias, navegación), ciclo de
  vida activate/deactivate, registro lazy, modelo de estado único.
- **Opción 2: pasar los stores de Zustand directamente a los widgets.**
  Máxima flexibilidad, pero acopla los widgets a la forma interna del estado
  (cualquier refactor interno rompe el ecosistema).
- **Opción 3: widgets como paquetes separados con Module Federation**
  (inyección remota). Poderoso, pero overkill para una app local-first y con
  riesgo de seguridad (ADR-017 ya lo descartó para esta iteración).

## Decision Outcome

Chosen option: **Opción 1 — SDK interno con Host API acotada.**

- **Contrato**: cada widget exporta un `WidgetPlugin` (`id`, `definition`,
  `activate(api)`, `deactivate()`, `component`, `preview?`); el componente recibe
  `{ api, minimized, onToggleMinimize }`. La `WidgetHostAPI` expone solo
  `solves` (readonly), eventos (`solve:completed`, `session:changed`,
  `scramble:new`), `log`, `preferences` y `navigateTo`.
- **Ciclo de vida**: `WidgetLifecycleManager` activa/desactiva plugins cuando el
  estado cambia de `inactive` ↔ activo; cada instancia tiene su propio HostAPI
  (suscripciones scopeadas y auto-limpiadas).
- **Registro lazy**: `WidgetRegistry.registerLazy` con `import()` dinámico;
  el bundle inicial no incluye el motor 3D ni iconos pesados.
- **Modelo de estado único**: `WidgetStatus = inactive | docked | floating | minimized`
  (reemplaza al trío contradictorio).
- **Banda z fija**: los widgets viven en z-25..49, bajo el chrome (z-50);
  `focusWidget()` renormaliza la pila al enfocar.
- **Seguridad**: solo built-ins (source: "built-in"). Los widgets custom por
  **URL-import se eliminaron** (migración v6 del store) — ejecutar código de
  terceros no empaquetado viola el modelo local-first.

### Positive Consequences

- Widgets desacoplados del estado interno (refactors de stores no los rompen).
- Bundle inicial ligero (code-splitting real, verificado en el registro).
- Sin "ghost widgets" (estado determinista).
- Los widgets nunca tapan sidebar/dialogs (banda z garantizada).

### Negative Consequences

- El contrato `WidgetHostAPI` hay que extenderlo cada vez que un widget nuevo
  necesite acceso al host (trade-off aceptado del aislamiento).
- Los widgets built-in viven en la app (`apps/web/src/widgets/`), no en
  `packages/` — reutilizables solo dentro de la web (la decisión de ADR-017 de
  no hacer `packages/plugins/*` se mantiene).

## Unresolved Questions

- ¿Se abrirá el sistema a widgets de **terceros** (source: "community" |
  "custom") con un mecanismo seguro (packaging firmado, sandbox)? El ADR-017 y
  este ADR asumen built-in-only; si se abre, requiere un ADR nuevo.
- ¿Debe el SDK salir a `packages/widgets-sdk` para que apps/desktop lo reutilice?
