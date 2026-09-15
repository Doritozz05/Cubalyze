---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "RFC-001"
tags: "tooling, package-manager, pnpm"
document_type: "RFC"
---

# RFC-002-Package_Manager

## Summary
Este RFC propone la adopción de **pnpm** como el gestor de paquetes exclusivo para el ecosistema de Cubalyze, reemplazando la opción tradicional de `npm` o `yarn`.

## Motivation
En un monorepo administrado con Turborepo, la resolución de dependencias entre paquetes locales (`apps/` y `packages/`) debe ser determinista, extremadamente rápida, y eficiente en disco. Además, necesitamos prevenir el problema de las dependencias "fantasma" (*ghost dependencies*), donde un paquete utiliza una librería que no declaró explícitamente porque otro paquete la trajo accidentalmente al nodo raíz.

## Proposed Solution
Utilizar **pnpm** como el gestor oficial a través de `pnpm-workspace.yaml`.
*   Asegura instalaciones rápidas mediante enlaces duros (*hard links*) y enlaces simbólicos.
*   Impide que el código dependa silenciosamente de paquetes no declarados en su propio `package.json`.
*   Es el gestor por defecto y mejor integrado en la comunidad actual de Turborepo.

## Detailed Design
*   Se creará un `pnpm-workspace.yaml` definiendo las carpetas `apps/*` y `packages/*`.
*   Se añadirá una restricción de motor (`engines`) en el `package.json` principal para obligar a usar pnpm.
*   Todos los scripts en CI/CD (GitHub Actions) usarán `pnpm i`.

## Drawbacks
*   Requiere que los nuevos desarrolladores instalen pnpm globalmente (`npm i -g pnpm`) si no lo tienen.
*   En sistemas operativos con configuraciones extrañas de disco/permisos, los *symlinks* pueden causar problemas raros, aunque hoy en día es inusual.

## Alternatives
*   **npm**: Muy lento para monorepos masivos, resolución ineficiente y no previene las dependencias fantasma.
*   **yarn (v1)**: Obsoleto.
*   **yarn (Berry/Plug'n'Play)**: Demasiado complejo, rompe algunas extensiones de VS Code y TypeScript si no se configura a la perfección.
*   **bun**: Muy rápido, pero como nuestro objetivo primario es la estabilidad del *toolchain*, pnpm lleva más años de madurez.

## Unresolved Questions
* Ninguna.
