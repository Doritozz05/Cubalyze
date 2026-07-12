---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-002"
supersedes: "None"
superseded_by: "None"
tags: "tooling, package-manager, pnpm"
document_type: "ADR"
---

# ADR-002-Package_Manager

## Context and Problem Statement

En un monorepo, instalar dependencias para múltiples aplicaciones y librerías genera problemas de velocidad y un consumo excesivo de disco. Además, si el gestor de paquetes utiliza elevación plana de dependencias (hoisting), los paquetes pueden usar dependencias no declaradas que otros paquetes instalaron, creando "Ghost Dependencies" que rompen en producción o al publicarse en un SDK.

## Decision Drivers

* Prevención estricta de *Ghost Dependencies* para asegurar que el SDK sea estable.
* Velocidad máxima en instalaciones CI/CD y en local.
* Integración fluida con Turborepo.

## Considered Options

* npm (workspaces)
* yarn (v1 y Berry)
* bun
* pnpm

## Decision Outcome

Chosen option: "pnpm", porque utiliza una estrategia de enlazado duro (*hard links* y *symlinks*) para crear una estructura `node_modules` no plana y totalmente estricta. Esto evita por defecto cualquier *Ghost Dependency* y asegura un alto rendimiento.

### Positive Consequences

* Si un desarrollador olvida agregar una librería en su `package.json`, pnpm forzará el fallo en desarrollo local, previniendo errores en producción.
* Optimiza fuertemente el uso del disco y el tiempo de instalación.

### Negative Consequences

* Los desarrolladores deben usar siempre `pnpm` y tenerlo instalado globalmente, por lo que requerirá configurar `engines` en el `package.json` raíz.
* Posibles edge-cases menores de configuración de `peerDependencies`.

## Pros and Cons of the Options

### pnpm
* Good, because es determinista y estricto arquitectónicamente.
* Good, because la velocidad es casi inigualable en entornos JS/TS modernos.

### npm / yarn (classic)
* Bad, because su *hoisting* por defecto facilita la inyección accidental de dependencias fantasma.

### bun
* Good, because la velocidad es extremadamente alta.
* Bad, because la estabilidad y madurez del ecosistema para orquestar monorepos es menor en comparación con pnpm, priorizando la estabilidad (*toolchain maturity*).
