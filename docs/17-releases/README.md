# 17 — Releases y Changelog

Cómo se versiona y se publica CubeForge. Documentado el 2026-08-12 (Fase 8 del
plan de documentación). Estado real en el momento de escribir esto: **0 releases,
0 tags git, todo en `0.x`**.

## Contenido

- [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md) — el proceso completo: flujo de
  commits → changesets → versionado → tag → publicación.
- Primer release: ver el checkpoint al final de [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md).

## Resumen

| Vía | Qué publica | Estado |
|---|---|---|
| **Vercel (CD)** | la web/PWA (merge a `main`) | ✅ funcionando (ADR-023) |
| **NPM (changesets)** | paquetes con `private: false` | 🔴 nunca usado — solo `cube-3d-engine` es público hoy |
| **Git tag** | el hito de cada release | 🔴 nunca creado |

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md).
