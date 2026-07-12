---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-004-Code_Quality_Standards"
tags: "tooling, linters"
document_type: "ADR"
---

# ADR-004-Code_Quality_Standards

## Context and Problem Statement

Con el crecimiento de CubeForge en un ecosistema de monorepo gestionado por Turborepo, es imperativo mantener un estándar de código unificado en todos los paquetes (UI, core, configs). Permitir configuraciones libres por desarrollador generará inconsistencias, "guerras de formato" en las revisiones de código y dificultará la mantenibilidad a largo plazo. Se requiere una solución estandarizada para formateo y linting.

## Decision Drivers

* **Consistencia:** Mantener el mismo estilo de código a lo largo de todo el proyecto sin intervención manual.
* **Productividad:** Prevenir que los desarrolladores pierdan tiempo discutiendo sobre el formato durante los Code Reviews.

## Considered Options

* **Opción 1:** ESLint (Flat Config) + Prettier.
* **Opción 2:** Biome (anteriormente Rome).

## Decision Outcome

Chosen option: **Opción 1: ESLint (Flat Config) + Prettier**.
Se elige esta opción debido a la madurez actual del ecosistema de ESLint/Prettier, especialmente en su soporte robusto para plugins específicos de React y Three.js, necesarios para nuestro motor 3D. Se ha decidido no utilizar Husky ni Conventional Commits para priorizar la agilidad y evitar fricciones en el flujo de desarrollo local.

### Positive Consequences

* Formateo unificado y automático en todo el proyecto.
* Uso de la sintaxis moderna Flat Config para mayor claridad en el monorepo.

### Negative Consequences

* La Flat Config de ESLint requiere asegurar la compatibilidad de todos los plugins, lo que puede requerir actualizaciones si algunas dependencias están desactualizadas.

## Pros and Cons of the Options

### Opción 1: ESLint + Prettier
* **Good, because:** Estándar de la industria con soporte absoluto para nuestro stack tecnológico (React, TypeScript, Three.js).
* **Bad, because:** Múltiples herramientas a configurar en comparación con soluciones todo-en-uno.

### Opción 2: Biome
* **Good, because:** Herramienta escrita en Rust, excepcionalmente rápida.
* **Good, because:** Unifica linting y formatting en una sola dependencia.
* **Bad, because:** Su soporte para reglas específicas de React y frameworks 3D no es tan exhaustivo como el ecosistema consolidado de ESLint.
