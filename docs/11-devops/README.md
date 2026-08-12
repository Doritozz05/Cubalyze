# 11 — DevOps e Integración

Documentación de la **plombería** del monorepo: cómo se construye, se valida en
CI, se despliega y se versiona. Todo verificado contra la configuración real
(`turbo.json`, `.github/workflows/*`, `vercel.json`, `.changeset/`, `commitlint.config.mjs`).

## Contenido

- [`Monorepo_and_Build.md`](./Monorepo_and_Build.md) — Turborepo, pnpm workspace,
  scripts de raíz, tsconfig, vitest, prettier, knip, límite de líneas (TDD-0006).
- [`CI_and_Quality_Gates.md`](./CI_and_Quality_Gates.md) — los 2 workflows
  (`ci.yml`, `quality-gates.yml`), qué gate exige qué, y lo que está
  deliberadamente **fuera** de CI.
- [`Deploy_and_Hosting.md`](./Deploy_and_Hosting.md) — `vercel.json`, cabeceras
  de cross-origin isolation, CSP, build PWA y análisis de bundle.
- [`Releases_and_Conventions.md`](./Releases_and_Conventions.md) — convención de
  commits (czg/commitlint/husky) y el pipeline de releases (changesets).

## Estado de la plombería (2026-08-12)

| Área | Estado | Detalle |
|---|---|---|
| Monorepo | ✅ | Turbo 2 + pnpm 11, 19 paquetes + 2 apps |
| CI | ✅ | `ci.yml` (lint/test/build) + `quality-gates.yml` (typecheck, lint, tests, coverage, property-based) |
| Remote cache | 🔴 | ADR-006 lo previó; `turbo.json` **sin** `remoteCache` |
| Deploy | ✅ | Vercel (web, SPA + cabeceras); Supabase pendiente (ADR-023) |
| Releases | 🔴 | Changesets configurado pero **sin uso**: 0 tags, 0 releases (v0.0.0) |
| Commit conventions | 🟡 | `czg`/commitlint instalados; hook **deliberadamente no bloqueante** |

## Decisiones relacionadas

- [ADR-004](../03-adr/ADR-004-Code_Quality_Standards.md) — estándares de calidad
  (ESLint/Prettier; cláusula de Husky superada).
- [ADR-005](../03-adr/ADR-005-Testing_Stack.md) — Vitest + fast-check (sin Playwright).
- [ADR-006](../03-adr/ADR-006-CI_NPM_Publishing.md) — GitHub Actions + Turbo + Changesets.
- [ADR-022](../03-adr/ADR-022-Open_Source_Readiness.md) — OSS: Conventional Commits, MIT.
- [ADR-023](../03-adr/ADR-023-Continuous_Deployment.md) — CD Vercel (+ Supabase pendiente).
- [ADR-028](../03-adr/ADR-028-CI_Quality_Gates.md) — la estructura real de gates de CI
  (registrado retroactivamente en Fase 6).

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md)
para las reglas de documentos de esta carpeta.
