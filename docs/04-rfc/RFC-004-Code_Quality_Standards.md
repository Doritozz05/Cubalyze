---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-06"
tags: "tooling, linters"
document_type: "RFC"
---

# RFC-004-Code_Quality_Standards

## Summary
Este RFC propone la estandarización del stack de calidad de código utilizando **ESLint (con Flat Config)** y **Prettier** para asegurar la consistencia y reducir errores de formato.

## Motivation
Con el crecimiento de Cubalyze a un monorepo complejo (Turborepo), mantener un estándar unificado de código a lo largo de todos los paquetes (UI, core, configs) es crucial. Dejar esto a la libre configuración de los contribuidores generará "guerras de formato" y commits innecesarios solo con cambios de espacios.

## Proposed Solution
*   **ESLint:** Usar la nueva sintaxis *Flat Config* (`eslint.config.js`) para manejar TypeScript, React, y Vanilla JS en diferentes paquetes del monorepo desde una configuración base compartida.
*   **Prettier:** Formateo opineonado sin intervención manual. Se ejecutará en conjunto con `eslint-config-prettier` para evitar conflictos.

## Detailed Design
*   Se creará un paquete interno `packages/eslint-config` que exportará la configuración estándar para el monorepo.
*   Se creará un paquete interno `packages/typescript-config` para compartir `tsconfig.json` bases.

## Drawbacks
*   Requiere sincronizar las versiones de ESLint en todos los proyectos para que la Flat Config no arroje errores de compatibilidad.

## Alternatives
*   **Biome (antiguo Rome):** Es un linter y formatter super rápido en Rust. Sería una gran alternativa, pero su ecosistema de plugins (ej. para React y Three.js) aún no es tan ubicuo y robusto como el de ESLint + Prettier. Podríamos considerarlo más adelante.

## Resolved Questions
*   **¿Deberíamos imponer "commitlint" (Conventional Commits) desde el primer día?** No. El usuario ha solicitado remover esta validación para evitar fricciones y agilizar el desarrollo local. Se confía en la disciplina del equipo sin bloqueos automáticos en local.
