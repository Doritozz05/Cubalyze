# 09 — Testing

> Estado real (2026-08-12): la estrategia y los gates viven en
> `docs/11-devops/` y en los ADRs; esta carpeta recoge estudios puntuales.

## Stack y gates (documentados en detalle)

- **Vitest** + **fast-check** (property-based) — ADR-005.
- **Quality gates en CI** (typecheck 0 errores, lint 0 warnings, 100% tests,
  coverage >80% en 5 paquetes core, property-based) —
  [`../11-devops/CI_and_Quality_Gates.md`](../11-devops/CI_and_Quality_Gates.md)
  y ADR-028.
- **Gate de líneas** (TDD-0006, 1000 líneas con allowlist que solo encoge) —
  [`../11-devops/Monorepo_and_Build.md`](../11-devops/Monorepo_and_Build.md).
- **TDDs** con criterios de aceptación: [`../05-tdd/`](../05-tdd/).

## Estudios en esta carpeta

- [`CFOP-CROSS-RELAXED-STUDY.md`](./CFOP-CROSS-RELAXED-STUDY.md) — estudio
  exhaustivo del criterio de cross relajado + detección F2L + pseudo-cross
  (completado y activado, 2026-08-10).

## Notas honestas

- **Sin Playwright/E2E** (ADR-005 lo descarta por ahora).
- Los benchmarks existen pero están **deshabilitados en CI** (no deterministas).
- Los tests de Rust del puente Tauri (CRC del timer) están **pendientes**
  (ver TDD frontend/0002).

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md).
