---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Ops Lead"
created: "2026-08-12"
last_updated: "2026-08-12"
version: "1.0.0"
related_rfc: "Ninguno (decisión registrada retroactivamente el 2026-08-12; complementa ADR-006 y ADR-023)"
supersedes: "Ninguno"
superseded_by: "None"
tags: "ops, CI, quality-gates, github-actions, benchmarks, commitlint"
document_type: "ADR"
---

# ADR-028 — Estructura de CI y Quality Gates

> **Nota de registro:** estructura ya implementada (`.github/workflows/`),
> registrada retroactivamente el 2026-08-12 (Fase 6 de documentación).
> El ADR-006 decidió *qué* herramientas (GitHub Actions + Turborepo +
> Changesets); este ADR registra *cómo* se materializaron los gates concretos
> y qué se dejó deliberadamente fuera de CI.

## Context and Problem Statement

El ADR-006 decidió la plataforma de CI pero no la **estructura concreta de
validación**. Había que decidir:

- ¿Un workflow monolítico o varios? ¿Qué exige cada uno?
- ¿Qué gates son obligatorios en CI y con qué umbrales (typecheck 0 errores,
  lint 0 warnings, coverage mínimo, property-based)?
- ¿Los benchmarks corren en CI? (los tiempos son ruidosos en runners
  compartidos)
- ¿La convención de commits se bloquea en el commit local (husky/commitlint)
  o se deja fluida?
- ¿El dead-code (knip) y el límite de líneas (TDD-0006) se ejecutan en CI?

## Decision Drivers

- **Feedback rápido vs. confianza**: un pipeline básico que corra en cada push
  (`ci.yml`) y gates profundos en PR/merge (`quality-gates.yml`).
- **Determinismo**: no gatear nada cuyo resultado dependa del ruido del runner
  (benchmarks de timing).
- **Fricción cero en el desarrollo local**: WIP y commits rápidos no deben
  bloquearse (hook de husky vacío a propósito).
- **Coste**: evitar `npm ci` + builds redundantes por workflow es imposible sin
  remote cache (ADR-006), así que se acepta el coste de un build por job.

## Considered Options

- **Opción 1 (elegida): dos workflows — `ci.yml` (básico) + `quality-gates.yml`
  (Nivel 3).** El básico corre lint + gate de líneas + tests + build en un solo
  job; el de calidad ejecuta 6 jobs independientes (typecheck, lint, unit-tests,
  coverage, property-based, benchmarks) con umbrales estrictos. Ambos en push a
  main y PRs a main.
- **Opción 2: un solo workflow con todo.** Más simple de mantener, pero cada
  push/PR paga todos los jobs (incluidos coverage y property-based) y un fallo
  en un gate de calidad bloquea el pipeline básico sin diferenciación.
- **Opción 3: gates en pre-commit (husky + lint-staged + commitlint).**
  Feedback inmediato, pero fricción alta en el día a día y validación parcial
  (solo archivos staged, entornos locales heterogéneos).

## Decision Outcome

Chosen option: **Opción 1 — dos workflows con gates de calidad separados.**

- **`ci.yml`**: job único `build` — checkout (fetch-depth 0), pnpm con cache,
  `install --frozen-lockfile`, `lint`, `lint:lines` (gate TDD-0006),
  `test`, `build`. Es la puerta rápida de cada push/PR.
- **`quality-gates.yml`**: 6 jobs independientes (Node 22 fijo):
  1. `typecheck` → `tsc --noEmit` en todos los paquetes, 0 errores.
  2. `lint` → `eslint` 0 errores/0 warnings + gate de líneas.
  3. `unit-tests` → `vitest run` en todos los paquetes, 100% pass (timeout 30 min).
  4. `coverage` → `vitest run --coverage` en los 5 paquetes core
     (math-core, solver-engine, analysis-engine, timer-engine, database),
     umbral >80% de líneas.
  5. `property-based` → fast-check en solver-engine, 0 fallos.
  6. `benchmarks` → **deshabilitado en CI** (`if: false`): los umbrales de
     timing no son deterministas en runners compartidos; se ejecutan localmente.
- **Commit conventions NO bloqueadas localmente**: `czg` (guía interactiva)
  + `commitlint` instalados, pero el hook `.husky/commit-msg` está vacío a
  propósito — WIP sin fricción; si se quiere endurecer, basta activar
  `commitlint --edit` en el hook (sin cambios de infraestructura).
- **Knip (dead-code)**: configurado con exclusiones documentadas, ejecutable
  localmente; no forma parte de los workflows actuales.

### Positive Consequences

- Cada push/PR tiene una señal rápida (`ci.yml`) y una profunda
  (`quality-gates.yml`) sin mezclar responsabilidades.
- Umbrales explícitos y verificables (0 errores, >80% coverage, 100% tests).
- Cero falsos positivos de benchmarks en CI (no deterministas).
- La convención de commits se mantiene *sin* penalizar el desarrollo local.

### Negative Consequences

- 6 jobs × (install + build) en cada PR — coste de CI alto sin remote cache
  (ADR-006 pendiente).
- La cobertura solo se exige en 5 paquetes core; el resto del monorepo puede
  degradar cobertura sin que CI se entere.
- Los benchmarks no tienen protección automática contra regresiones de
  rendimiento (solo manual/local).
- `fetch-depth: 0` en `ci.yml` es más lento que shallow clone (necesario para
  el historial de cambiosets/convención).

## Unresolved Questions

- ¿Se activará el **remote cache de Turbo** (ADR-006 lo previó) para reducir el
  coste de los 6 builds repetidos por PR?
- ¿Los **benchmarks** vuelven a CI con umbrales de ratio (vs. línea base
  commiteada) en vez de absolutos?
- ¿Se extiende el gate de **coverage** a más paquetes (training, gan-protocol,
  state) o se mantiene en los 5 core?
- ¿Se activa **commitlint como gate** en CI (no en pre-commit) para los PRs a
  main, manteniendo el commit local sin fricción?
