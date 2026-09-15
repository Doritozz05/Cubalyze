---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-001"
supersedes: "None"
superseded_by: "None"
tags: "tooling, monorepo, turborepo"
document_type: "ADR"
---

# ADR-001-Monorepo_Strategy

## Context and Problem Statement

Cubalyze es un ecosistema que incluirá un SDK público, aplicaciones nativas, PWA y servicios en la nube. Gestionar estos componentes en múltiples repositorios dificultaría enormemente la experiencia de desarrollo local y el testing cruzado. Se requiere una herramienta que orqueste las construcciones (builds) y centralice el ecosistema sin introducir una curva de aprendizaje abismal para contribuidores Open Source.

## Decision Drivers

* Tiempos de CI/CD rápidos para evitar bloqueos.
* Baja barrera de entrada para desarrollo Open Source.
* Flexibilidad para escalar componentes sin atarse a un solo stack tecnológico de UI.

## Considered Options

* Nx
* Lerna / Rush
* Turborepo

## Decision Outcome

Chosen option: "Turborepo", porque equilibra de forma óptima un rendimiento extremo de CI/CD (Zero-config caching) con una curva de aprendizaje muy baja que es ideal para proyectos Open Source basados en TypeScript/JavaScript, minimizando la carga cognitiva de los colaboradores.

### Positive Consequences

* Reducción dramática de los tiempos de ejecución de CI/CD al usar la caché remota y paralelización.
* Las tareas complejas se pueden definir y abstraer de forma sencilla en `turbo.json`.

### Negative Consequences

* Mayor complejidad en la depuración de variables de entorno frente a un repositorio monolítico estándar.
* **Riesgo de Cache Poisoning (Mitigado)**: Es obligatorio configurar Turborepo y el CI para que solo se pueda escribir en la caché remota desde `main` o con privilegios explícitos, y que los *forks* solo tengan permisos de lectura.

## Pros and Cons of the Options

### Turborepo
* Good, because es fácil de configurar y el archivo mental de *pipelines* es muy natural.
* Good, because permite caché remota con mínima configuración.
* Bad, because el ecosistema no-JS (como WASM/Rust futuro) requerirá scripts adicionales customizados.

### Nx
* Good, because tiene plugins nativos y es más robusto para mega-repositorios corporativos.
* Bad, because introduce demasiada magia y archivos de configuración que espantan a contribuidores ocasionales (Open Source).
