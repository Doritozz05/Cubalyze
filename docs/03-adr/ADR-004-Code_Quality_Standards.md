---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-004-Code_Quality_Standards"
tags: "tooling, linters, pre-commit, conventional-commits"
document_type: "ADR"
---

# ADR-004-Code_Quality_Standards

## Context and Problem Statement

Con el crecimiento de CubeForge en un ecosistema de monorepo gestionado por Turborepo, es imperativo mantener un estándar de código unificado en todos los paquetes (UI, core, configs). Permitir configuraciones libres por desarrollador generará inconsistencias, "guerras de formato" en las revisiones de código y dificultará la mantenibilidad a largo plazo. Se requiere una solución estandarizada para formateo, linting y convenciones de mensajes de commit.

## Decision Drivers

* **Consistencia:** Mantener el mismo estilo de código a lo largo de todo el proyecto sin intervención manual.
* **Productividad:** Prevenir que los desarrolladores pierdan tiempo discutiendo sobre el formato durante los Code Reviews.
* **Automatización:** Validar el código únicamente antes de confirmar los cambios (pre-commit) para no afectar la velocidad de desarrollo.
* **Mantenibilidad del Historial:** Asegurar que el changelog y el versionado puedan generarse automáticamente.

## Considered Options

* **Opción 1:** ESLint (Flat Config) + Prettier + Husky (lint-staged) + Conventional Commits.
* **Opción 2:** Biome (anteriormente Rome) + Conventional Commits.

## Decision Outcome

Chosen option: **Opción 1: ESLint (Flat Config) + Prettier + Husky (lint-staged) + Conventional Commits**.
Se elige esta opción debido a la madurez actual del ecosistema de ESLint/Prettier, especialmente en su soporte robusto para plugins específicos de React y Three.js, necesarios para nuestro motor 3D. Además, la integración obligatoria de Conventional Commits (`commitlint` y `commitizen`) permite escalar la publicación automatizada de versiones.

### Positive Consequences

* Formateo unificado y automático en todo el proyecto.
* Historial de git estructurado semánticamente, habilitando el uso de herramientas como Changesets.
* El uso de `lint-staged` previene que los hooks de pre-commit evalúen el repositorio completo, mejorando los tiempos.
* Uso de la sintaxis moderna Flat Config para mayor claridad en el monorepo.

### Negative Consequences

* La Flat Config de ESLint requiere asegurar la compatibilidad de todos los plugins, lo que puede requerir actualizaciones si algunas dependencias están desactualizadas.
* Instaurar Conventional Commits impone una pequeña curva de aprendizaje a nuevos contribuidores.

## Pros and Cons of the Options

### Opción 1: ESLint + Prettier + Husky + Conventional Commits
* **Good, because:** Estándar de la industria con soporte absoluto para nuestro stack tecnológico (React, TypeScript, Three.js).
* **Good, because:** Conventional Commits se integra de forma natural con CI/CD.
* **Bad, because:** Múltiples herramientas a configurar en comparación con soluciones todo-en-uno.

### Opción 2: Biome + Conventional Commits
* **Good, because:** Herramienta escrita en Rust, excepcionalmente rápida.
* **Good, because:** Unifica linting y formatting en una sola dependencia.
* **Bad, because:** Su soporte para reglas específicas de React y frameworks 3D no es tan exhaustivo como el ecosistema consolidado de ESLint.
