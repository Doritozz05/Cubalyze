---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-04, DEC-14"
tags: "ops, CI, github actions"
document_type: "RFC"
---

# RFC-006-CI_NPM_Publishing

## Summary
Este RFC propone **GitHub Actions** como la plataforma única de CI y publicación NPM, configurando pipelines de validación (PRs), integración continua mediante **Turborepo Remote Caching**, y publicación automatizada con **Changesets**. (Nota: El CD del Frontend/Backend se trata separadamente en el RFC-007).

## Motivation
Automatizar el proceso de lint, build y test en cada PR asegura la estabilidad del repositorio. Al ser Cubalyze un proyecto hospedado en GitHub, aprovechar las integraciones nativas reduce el rozamiento operativo y evita mantener infraestructura de CI propia.

## Proposed Solution
*   **GitHub Actions:** Única herramienta para workflows de CI. 
*   Se definirá un workflow de PR (`pr-validation.yml`) que ejecutará: lint, typecheck, tests unitarios, test E2E y build.
*   Se aprovechará **Turborepo** para no ejecutar tareas innecesarias si los paquetes no cambiaron (usando `turbo run test --filter=...`).
*   Publicación automatizada en NPM tras el merge a `main` para los paquetes que lo requieran.

## Detailed Design
*   Carpeta base: `.github/workflows/`
*   Variables de entorno y secretos inyectados vía GitHub Secrets.
*   Pipeline optimizado:
    *   Setup Node (usando `pnpm`).
    *   Restaurar caché de Turborepo.
    *   Ejecutar `pnpm run build` o `pnpm turbo run build ...`.
*   Para publicación de posibles paquetes NPM (el solver), usaremos **Changesets** automatizado con el bot de GitHub.

## Drawbacks
*   GitHub Actions puede ser costoso o lento en repositorios privados si no se usa caché agresiva, pero en repositorios públicos/OSS los minutos son gratuitos.
*   El vendor lock-in a GitHub, aunque dado el ecosistema actual, es un riesgo aceptable.

## Alternatives
*   **GitLab CI / CircleCI:** Son más poderosos, pero implicarían añadir un servicio extra de terceros, perdiendo la integración inmediata en la UI de los Pull Requests de GitHub.

## Resolved Questions
*   **¿Dónde alojaremos finalmente la PWA de producción?** Esta pregunta ha sido extraída de este documento y se tratará exclusivamente en un nuevo documento (**RFC-007-Hosting_Strategy**) para evitar acoplar decisiones prematuras de infraestructura al pipeline de CI inicial.
