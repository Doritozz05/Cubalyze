---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-003"
supersedes: "None"
superseded_by: "None"
tags: "architecture, folder-structure"
document_type: "ADR"
---

# ADR-003-Repository_Structure

## Context and Problem Statement

Para materializar un monorepo que albergue un SDK reutilizable, una web PWA, y envoltorios de aplicaciones de escritorio/móviles, el código debe estructurarse de una manera que prohíba estrictamente el acoplamiento entre la lógica de interfaz de usuario (ej. React) y la lógica de negocio pura (ej. cálculos 3D, scramble generation).

## Decision Drivers

* Domain Driven Design (DDD) y Clean Architecture plasmados físicamente en el repositorio.
* Fuerte desacoplamiento técnico.
* Reusabilidad del código y futura extracción a SDK (NPM packages).

## Considered Options

* Repositorio monolítico (`src/` único).
* Separación estricta de Monorepo: `/apps` y `/packages`.

## Decision Outcome

Chosen option: "Separación estricta de Monorepo: /apps y /packages", porque divide lógicamente el repositorio en "Consumidores / Desplegables" (`apps`) y "Productores / Librerías Aisladas" (`packages`). 

### Positive Consequences

* **Regla Inquebrantable**: Un `package` jamás podrá depender de una `app`. Los `packages` (ej. `core-math`) se mantienen agnósticos al marco de trabajo de UI.
* Total aislamiento del dominio; simplifica pruebas unitarias sin levantar entornos DOM.

### Negative Consequences

* Sobrecarga inicial de configuración ("wiring") con los ficheros TSConfig, ESLint, etc.
* Incrementa el número de ficheros `package.json` a mantener y coordinar.

## Pros and Cons of the Options

### Separación estricta (apps / packages)
* Good, because garantiza que las responsabilidades de UI no se mezclen con el núcleo, alineado con Clean Architecture.
* Good, because permite publicación individual a NPM de cualquier paquete interno como SDK público.

### Monolítico (src/ único)
* Bad, because inevitablemente derivará en una "bola de fango" (Big Ball of Mud) a medida que diferentes frentes (web, desktop, scripts) crezcan y referencien dependencias circulares.
