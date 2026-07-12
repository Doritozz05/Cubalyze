---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-008-Frontend_Framework_Architecture"
tags: "frontend, react, vite, spa, pwa"
document_type: "ADR"
---

# ADR-008-Frontend_Framework_Architecture

## Context and Problem Statement

CubeForge es, en esencia, un cronómetro de alto rendimiento y una herramienta de análisis 3D. El PRD exige un funcionamiento **100% Offline-First** y capacidades de PWA para instalación nativa. Se necesita decidir la arquitectura y framework base para el cliente (frontend) que garantice compatibilidad total con Service Workers y ejecución offline sin dependencias de servidor.

## Decision Drivers

* **Offline-First / PWA:** Requisito no negociable para funcionar sin red e instalarse como PWA local.
* **Rendimiento:** Alta eficiencia para cálculos de tiempos sub-milisegundos e integración de WebAssembly (WASM) para el Solver.
* **Ecosistema 3D:** Flexibilidad y comunidad para integrar renderizado 3D de cubos rubik.

## Considered Options

* **Opción 1:** React 18+ con Vite (SPA Pura) y Vite PWA Plugin.
* **Opción 2:** Next.js (SSG/Export) u otro framework SSR (Server-Side Rendering).
* **Opción 3:** Preact o SolidJS.

## Decision Outcome

Chosen option: **Opción 1: React 18+ con Vite (SPA Pura) y Vite PWA Plugin**.
Se elige esta opción porque un enfoque de SPA (Single Page Application) servida estáticamente es la forma más robusta de garantizar un funcionamiento Offline-First impecable mediante Service Workers (gestionados por el plugin de Vite PWA). Vite provee empaquetado extremadamente veloz y soporte nativo ESModules para el WASM Solver. El ecosistema 3D de React (ej. `react-three-fiber`) es insuperable frente a las alternativas. Se descarta Next.js porque el SSR no aporta valor a una aplicación que depende de APIs del cliente, y su capa de servidor dificultaría la PWA.

### Positive Consequences

* Arquitectura puramente estática, simplificando el caching del Service Worker para soporte offline real.
* Excelente velocidad de desarrollo y HMR con Vite.
* Ecosistema masivo de React disponible para integraciones complejas (3D, gestión de estado).

### Negative Consequences

* SEO pobre para el contenido de la aplicación.
* Potencial tamaño de bundle inicial grande si no se aplica *code splitting* agresivo.

## Pros and Cons of the Options

### Opción 1: React + Vite (SPA Pura)
* **Good, because:** Caching offline predecible y nativo sin dependencias de servidor.
* **Good, because:** Ecosistema 3D y WASM excelentemente soportados.
* **Bad, because:** SEO nulo (aunque irrelevante por el dominio de la app).

### Opción 2: Next.js (SSG/Export)
* **Good, because:** Permite exportación estática con un ecosistema maduro.
* **Bad, because:** Fuerte acoplamiento con soluciones de servidor, añadiendo complejidad innecesaria para una PWA local.

### Opción 3: Preact / SolidJS
* **Good, because:** Menor peso y mejor rendimiento de manipulación del DOM.
* **Bad, because:** Ecosistema menor, especialmente para la manipulación y renderizado 3D abstracto frente a la madurez del de React.
