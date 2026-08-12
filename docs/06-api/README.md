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

## API reference generada (TypeDoc) — `pnpm docs:api`

> Configurada el 2026-08-12 (Fase 7 del plan). **Se regenera, no se edita:**
> la salida vive en `docs/api/`, ignorada en git.

- **Comando:** `pnpm docs:api` (o `pnpm --filter` no — es script de raíz).
- **Configuración:** `typedoc.json` + `tsconfig.typedoc.json` + `typedoc-env.d.ts`
  en la raíz. Cubre los **15 paquetes con fuentes** y **todo `apps/web/src`**
  (estrategia `expand`: un módulo por archivo). ~2.000 páginas HTML.
- **Resolución:** los `@cubeforge/*` apuntan a sus barrels de `src/` (sin
  necesitar build de `dist/`); `@/` → web, `@/components/ui/*` → kit UI.
- **Tipos residuales:** corre con `skipErrorChecking` — documenta pese a
  errores de tipos preexistentes del repo (no es un gate de typecheck).

### Auditoría de JSDoc (2026-08-12) — mejoras propuestas, no aplicadas

La generación avisa de 8 problemas menores (cosméticos, no bloquean):

1. **Tag `@file` desconocido** en 8 archivos de `apps/web/src/utils` (p.ej.
   `insights.ts`, `phaseColors.ts`): TypeDoc no lo reconoce → el primer párrafo
   del archivo no se renderiza. Cambiar `@file` por `@module` o una descripción
   normal.
2. **4 links `{@link}` rotos** (se renderizan sin href): `CrossScrambleGenerator`
   (solver-engine, no exportado del barrel), `useCalendarTasks`
   (`hooks/useSkillProgress.ts:60` — no importado en el archivo),
   `UseSolveCompletionResult.handleComplete` (`hooks/useSolveCompletion.ts:25`),
   `useFormContext` (ui/form, externo react-hook-form). Arreglar el nombre/import
   en el comentario.

Ambas mejoras tocan fuentes (no `docs/`) y son opcionales; quedan como
propuesta para una pasada futura de limpieza de JSDoc.

## Relación con otras docs

- Estado (Zustand): [`../02-architecture/web/State_and_Stores.md`](../02-architecture/web/State_and_Stores.md).
- Training/FSRS: [TDD-0001](../../05-tdd/training/0001-srs-training-system.md) y
  ADR-024. Widgets: [`../02-architecture/Widgets_System.md`](../02-architecture/Widgets_System.md).
- Motor 3D: [TDD-0006](../../05-tdd/TDD-0006-3D-Engine.md).
