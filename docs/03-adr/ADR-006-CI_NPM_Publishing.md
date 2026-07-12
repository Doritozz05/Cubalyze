---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-006-CI_NPM_Publishing"
tags: "ops, CI, github actions, turborepo, changesets"
document_type: "ADR"
---

# ADR-006-CI_NPM_Publishing

## Context and Problem Statement

Para escalar el desarrollo de CubeForge como monorepo y asegurar la calidad continua del código, se requiere automatizar los procesos de validación (lint, build, tests) ante cada Pull Request. Además, la estrategia técnica contempla exponer el "Hardware Abstraction Layer" y el "Math Core" como librerías públicas (SDK) en NPM. Se necesita una plataforma unificada para orquestar la integración continua, aprovechar la estructura monorepo eficientemente, y versionar/publicar paquetes de manera automatizada.

*(Nota: La estrategia de Alojamiento y Despliegue Continuo (CD) del Frontend/Backend está deliberadamente fuera del alcance de este ADR y se evaluará en un futuro RFC-007).*

## Decision Drivers

* **Rendimiento de CI:** Tiempos de compilación y prueba mínimos para un monorepo en crecimiento.
* **Automatización:** Ejecución automática de controles de calidad en los PRs.
* **Gestión de Versiones:** Facilitar el versionado semántico y la publicación NPM basada en el historial de commits.
* **Integración:** Reducir la fricción usando herramientas integradas en la plataforma de alojamiento de código.

## Considered Options

* **Opción 1:** GitHub Actions + Turborepo Remote Caching + Changesets.
* **Opción 2:** GitLab CI / CircleCI + Lerna.

## Decision Outcome

Chosen option: **Opción 1: GitHub Actions + Turborepo Remote Caching + Changesets**.
Se elige esta opción porque GitHub Actions se integra nativamente en el entorno del repositorio. Combinado con el caché remoto de Turborepo, evitamos ejecutar tareas (`build`, `test`) redundantes en paquetes del monorepo que no han sufrido modificaciones. Finalmente, `Changesets` se enlaza perfectamente con Conventional Commits y GitHub Actions mediante bots para automatizar releases a NPM.

### Positive Consequences

* Reducción drástica del tiempo y coste de computación en CI gracias al caché de Turborepo (`turbo run test --filter=...`).
* Versionado y publicación a NPM totalmente delegados a un bot en GitHub, eliminando errores manuales.
* Todo el pipeline como código (`.github/workflows`) alojado junto al repositorio.

### Negative Consequences

* Dependencia directa y "vendor lock-in" parcial con el ecosistema de GitHub Actions.
* Configuración inicial compleja para sincronizar el caché de Turborepo en los runners de GitHub Actions.

## Pros and Cons of the Options

### Opción 1: GitHub Actions + Turborepo + Changesets
* **Good, because:** Integración impecable en la interfaz de PRs de GitHub.
* **Good, because:** Caching inteligente a nivel de tareas en toda la matriz del monorepo.
* **Bad, because:** Posible cuota de minutos costosa en repositorios privados (aunque manejable con caché agresivo).

### Opción 2: GitLab CI / CircleCI + Lerna
* **Good, because:** Plataformas de CI extremadamente potentes con runners customizados avanzados.
* **Bad, because:** Requiere mantener y enlazar servicios de terceros; Lerna tiene un modelo de caché menos optimizado que Turborepo para pipelines de tareas complejas.
