# API — Paquetes del monorepo

> Documentado el 2026-08-12 (Fase 4 del plan de documentación). API pública y
> dependencias verificadas contra el código real de `packages/`.

## Índice por sub-fase

| Doc | Paquetes |
| --- | --- |
| [Core](./core.md) | `math-core`, `solver-engine`, `algorithm-db`, `models`, `types` |
| [3D](./3d.md) | `cube-3d-engine` |
| [Datos y estado](./data.md) | `database`, `state`, `sync-engine` (planeado) |
| [Hardware](./hardware.md) | `hardware-hal`, `gan-protocol`, `timer-engine` |
| [IA y análisis](./analysis.md) | `analysis-engine`, `statistics`, `training`, `ai-core` (planeado) |
| [UI y utilidades](./ui.md) | `ui`, `identicon`, `config-eslint`, `config-typescript` |

## Convenciones

- **Layering** (ADR-003): los paquetes (`packages/`) son librerías de dominio;
  jamás dependen de una app. Las apps (`apps/`) son consumidores.
- **Sin backend** (ADR-007/019 pendiente): toda la lógica es cliente.
- Los paquetes marcados como **planeado** no tienen fuentes todavía
  (`echo "no sources"` en su script de typecheck).

## Relación con otras docs

- Estado (Zustand): [`../02-architecture/web/State_and_Stores.md`](../02-architecture/web/State_and_Stores.md).
- Training/FSRS: [TDD-0001](../../05-tdd/training/0001-srs-training-system.md) y
  ADR-024. Widgets: [`../02-architecture/Widgets_System.md`](../02-architecture/Widgets_System.md).
- Motor 3D: [TDD-0006](../../05-tdd/TDD-0006-3D-Engine.md).
