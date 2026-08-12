# 13 — Plugins

> Estado real (2026-08-12): **no hay ecosistema de plugins de terceros**.
> El sistema de extensibilidad actual son los **widgets built-in**.

## Contexto

- ADR-017 decidió el sistema de extensibilidad; **ADR-026** lo materializó como
  **widgets built-in-only**: el SDK (`WidgetPlugin` + `WidgetHostAPI`) vive en
  `apps/web/src/widgets/` y los widgets custom por URL **se eliminaron** por
  seguridad del modelo local-first.
- Hay **11 widgets** implementados y documentados en
  [`../02-architecture/widgets/`](../02-architecture/widgets/) y
  [`../02-architecture/Widgets_System.md`](../02-architecture/Widgets_System.md).

## Cuándo se poblará esta carpeta

Si algún día se abre el sistema a plugins de **terceros** (packaging firmado,
sandbox), eso requiere un **ADR nuevo** (pregunta abierta del ADR-026) y aquí se
documentarán las reglas del ecosistema.

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md).
