# 12 — SDK

> Estado real (2026-08-12): **aún no hay SDK público publicado**. Esta carpeta
> se poblará cuando exista.

## Contexto

- ADR-006 contempla exponer `@cubalyze/hardware-hal` y `@cubalyze/math-core`
  como librerías públicas en NPM.
- Hoy **todos los paquetes son `private: true` excepto
  `@cubalyze/cube-3d-engine`**; nada se ha publicado (0 releases).
- La **API pública de los paquetes ya está documentada**: [`../06-api/`](../06-api/)
  y la referencia generada con TypeDoc (`pnpm docs:api` → `docs/api/`).

## Cuándo se poblará esta carpeta

Cuando se decida abrir un paquete al público (checkpoint del primer release,
Fase 8): aquí irán guías de consumo, ejemplos, y el proceso de publicación.

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md).
