---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-05"
tags: "tooling, testing, vitest, playwright"
document_type: "RFC"
---

# RFC-005-Testing_Stack

## Summary
Este RFC propone la adopción de **Vitest** para pruebas unitarias y de integración, y **Playwright** para pruebas End-to-End (E2E), reemplazando al tradicional stack de Jest y Cypress.

## Motivation
Dado que estamos usando **Vite** para la aplicación principal, tener un framework de pruebas que comparta la misma canalización de construcción (build pipeline) y configuración resolverá los clásicos problemas de "Jest no entiende ESModules". Para E2E, necesitamos soporte cross-browser moderno que permita testing en WebKit (iOS) para validar nuestro PWA.

## Proposed Solution
*   **Vitest:** Para todo el unit testing (especialmente en `core`, el solver de min2phase, y utilidades). Es nativo de ESM, rápido y compatible con el API de Jest.
*   **Playwright:** Para E2E testing. A diferencia de Cypress, Playwright permite iterar fácilmente sobre WebKit, Chrome y Firefox, e interactuar con múltiples pestañas y contextos (útil si hay que testear la sincronización en la nube entre dos usuarios).

## Detailed Design
*   Los tests unitarios vivirán junto a los archivos fuente: `Component.test.tsx`.
*   Los tests de E2E vivirán en un paquete aislado: `apps/e2e` para no mezclar las dependencias de Playwright con el frontend.
*   Se usarán utilidades como `happy-dom` o `jsdom` en Vitest para renderizar componentes de React si es necesario, aunque se priorizará el testing de lógica pura.

## Drawbacks
*   Si la base de desarrolladores está muy acostumbrada a Cypress, la curva de aprendizaje de Playwright toma un tiempo.
*   Vitest aún puede tener *edge cases* con dependencias muy antiguas que no exponen ESM correctamente (raro en proyectos nuevos).

## Alternatives
*   **Jest:** Sigue siendo el rey, pero su configuración con Vite + TypeScript es verbosa e inestable comparada con Vitest.
*   **Cypress:** Excelente DX, pero su arquitectura in-browser limita el testing de ciertos escenarios de red o cross-origin, y su soporte para WebKit no es tan de primera clase como en Playwright.

## Resolved Questions
*   **¿Cuándo incluiremos Visual Regression Testing?** Lo implementaremos desde el día 1 utilizando las capacidades nativas de Playwright. Dado que dependemos críticamente de un motor 3D (WebGL) para la UI principal, es obligatorio prevenir regresiones visuales severas, y Playwright ofrece esta funcionalidad sin requerir herramientas externas adicionales.
