---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-005-Testing_Stack"
tags: "tooling, testing, vitest, playwright"
document_type: "ADR"
---

# ADR-005-Testing_Stack

## Context and Problem Statement

El stack tradicional de pruebas (Jest para unitario y Cypress para End-to-End) presenta fricciones con el ecosistema moderno de Vite (ESModules). Configurar Jest para entender y transpirar correctamente TypeScript y dependencias en ESM es complejo e inestable. Además, Cypress tiene limitaciones arquitectónicas para realizar pruebas multiplataforma en WebKit (motor de iOS/Safari) y para gestionar múltiples contextos/pestañas de forma nativa, lo cual es vital para probar el "Sync Engine" (sincronización offline-first) de CubeForge.

## Decision Drivers

* **Soporte ESM Nativo:** Compartir el pipeline de compilación (Vite) para pruebas unitarias.
* **Soporte PWA/WebKit:** Garantizar que la aplicación funcione en dispositivos iOS a través del motor WebKit.
* **Velocidad:** Ejecución rápida del motor matemático (Solver) para pruebas exhaustivas.
* **Capacidades E2E:** Soporte fluido para múltiples pestañas para probar características colaborativas o de sincronización.
* **Prevención de Regresiones:** Necesidad de Visual Regression Testing automatizado desde el principio.

## Considered Options

* **Opción 1:** Vitest (Unit/Integration) + Playwright (E2E y Visual Regression).
* **Opción 2:** Jest (Unit/Integration) + Cypress (E2E).

## Decision Outcome

Chosen option: **Opción 1: Vitest + Playwright**.
Se elige esta opción porque Vitest se integra sin configuración adicional en proyectos basados en Vite, ofreciendo ejecución nativa en ESM. Playwright supera las limitaciones de red e in-browser de Cypress, proporcionando soporte de primer nivel para WebKit, manipulación de múltiples contextos de navegación y capacidades nativas de Visual Regression Testing, vitales para proteger el motor de visualización 3D.

### Positive Consequences

* Reutilización de la configuración de Vite (`vite.config.ts`) para los entornos de prueba.
* HMR (Hot Module Replacement) ultra rápido durante las pruebas unitarias.
* Capacidad para realizar pruebas de UI completas en Safari/WebKit sin fricciones.
* Visual Regression Testing integrado out-of-the-box con Playwright.

### Negative Consequences

* La sintaxis de Playwright difiere de Cypress, requiriendo un proceso de adaptación para desarrolladores acostumbrados al encadenamiento de Cypress.
* Los tests de E2E vivirán en un paquete separado (`apps/e2e`) para evitar contaminación de dependencias.

## Implementation Status (2026-08-12)

Vitest implementado (unit/integración en paquetes y web). **Playwright pendiente**: no existe `playwright.config.*` ni suite E2E; el `apps/e2e` mencionado en Negative Consequences no se ha creado.

## Pros and Cons of the Options

### Opción 1: Vitest + Playwright
* **Good, because:** Vitest es el estándar de facto para proyectos Vite.
* **Good, because:** Playwright permite pruebas multi-tab (crucial para testing de sincronización offline/online).
* **Bad, because:** Curva de aprendizaje para transicionar de Cypress a la API de Playwright.

### Opción 2: Jest + Cypress
* **Good, because:** Excelente experiencia de desarrollo y comunidad gigante.
* **Bad, because:** Problemas crónicos de soporte con ESModules puros.
* **Bad, because:** Arquitectura in-browser de Cypress limita la manipulación de ciertas APIs de red y el soporte de WebKit es secundario.
