# Arquitectura de la Web App (apps/web)

Documentación de la capa de aplicación de la PWA (`apps/web/`), verificada
contra el código el 2026-08-12 (Fase 3 del plan de documentación).

## Documentos

| Doc | Contenido |
| --- | --- |
| [State and Stores](./State_and_Stores.md) | Estado global (`@cubalyze/state`: preferencias, timer, sesión, conexión, orientación, algoritmos) + stores locales de la web |
| [Components](./Components.md) | Los 12 grupos de componentes (Layout, Timer, Stats, Settings, Insights, Stage, Scramble, Hardware, Identity, Onboarding, Cube3D, ContextMenu) con fichas |
| [Hooks, Services y Lib](./Hooks_Services_and_Lib.md) | Los ~40 hooks (flujo del solve, drills, SRS, perfil), los 3 servicios (orientación 3D, snapshot, render adapter) y lib (announce, keybinds, touch) |

## Decisiones cubiertas

- **ADR-009** (Zustand) — toda la capa de estado.
- **ADR-013/016** (SQLite + Workers) — persistencia de solves/sesiones.
- **ADR-020** (A11y) — `lib/announce.ts` (live regions).
- **ADR-025** (i18n) — `apps/web/src/i18n/` + namespaces.
- **TDD core/0004** — diseño del timer engine (`@cubalyze/timer-engine`).

## Vistas

Las tabs de la web están documentadas en [`docs/16-user/`](../../16-user/) y el
sistema de widgets en [`../Widgets_System.md`](../Widgets_System.md).
