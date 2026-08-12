# 18 Archive

## Purpose

Almacén de documentos cuyo ciclo de vida ha terminado: planes implementados,
propuestas superadas o artefactos fechados. **Nada se borra** — todo lo que deja
de estar activo se mueve aquí con una nota de estado.

## Governance

Archivos viejos de `docs/` se mueven aquí con `git mv` (historial preservado).
Siempre que se archive algo, actualizar la tabla de inventario de abajo con fecha
y motivo.

## Inventory

| Carpeta / archivo | Archivado el | Estado al archivar | Motivo |
| ----------------- | ------------ | ------------------ | ------ |
| `plan_analysis_unification/` | 2026-08-12 | Implementado (un solo pipeline de análisis) | Plan completado |
| `plan_cube_simulator/` | 2026-08-12 | Implementado (PR #13, vista Cube) | Plan completado |
| `plan_i18n/` | 2026-08-12 | Implementado (tandas 1–13 completadas) | Plan completado |
| `plan_mobile/` | 2026-08-12 | "Aprobado para implementación por fases" | ⚠️ Pendiente de verificar qué fases se implementaron |
| `plan_onboarding/` | 2026-08-12 | Fases F0–F5 implementadas; verificación browser pendiente | Mayormente implementado |
| `plan_profile/` | 2026-08-12 | Fases F0–F6 implementadas; F7 futuro no implementada | Mayormente implementado |
| `plan_reconstruction/` | 2026-08-12 | Fases 0–2 ejecutadas (rama `algortihms`) | Plan completado |
| `plan_training/` (incluye `REFACTOR_PLAN.md` y `TRAINING_SYSTEM_v2.md`) | 2026-08-12 | Implementación base completada | Plan completado |

> Nota: si una fase pendiente (mobile, onboarding) se retoma, los planes siguen
> disponibles aquí — solo hace falta moverlos de vuelta a `docs/`.
