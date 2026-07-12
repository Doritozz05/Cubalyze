---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-04, DEC-05"
tags: "frontend, react, vite, spa, pwa"
document_type: "RFC"
---

# RFC-008-Frontend_Framework_Architecture

## Summary
Este RFC propone la arquitectura central del cliente: una **Single Page Application (SPA) pura basada en React y Vite**, descartando enfoques de Server-Side Rendering (SSR) como Next.js o Remix, para asegurar compatibilidad total con la estrategia Offline-First y PWA.

## Motivation
CubeForge es, en esencia, un cronómetro de alto rendimiento y una herramienta de análisis 3D. El PRD exige un funcionamiento **100% Offline-First** y capacidades de PWA para instalación nativa. Frameworks modernos como Next.js introducen una capa de servidor que dificulta severamente la creación de Service Workers robustos para funcionar sin red, y el renderizado en servidor (SSR) no aporta valor a una aplicación donde el contenido principal (un motor 3D y tiempos por Bluetooth) depende exclusivamente de las APIs del navegador cliente.

## Proposed Solution
*   **React 18+:** Como librería principal de UI, aprovechando su ecosistema para la capa 3D (`react-three-fiber` si fuera necesario, aunque el render puede ser puro).
*   **Vite:** Como empaquetador (bundler) por su extrema velocidad y compatibilidad nativa con ESModules (requerido por el Solver en WASM).
*   **SPA Pura:** Un único `index.html` servido estáticamente.
*   **Vite PWA Plugin:** Para auto-generar y gestionar el Service Worker (cacheo de assets estáticos y del motor WASM para uso offline).

## Detailed Design
*   La UI se compilará en un `dist` completamente estático.
*   El enrutamiento se manejará en cliente usando `react-router-dom`.
*   El Service Worker interceptará todas las peticiones de red y servirá el "App Shell" desde la caché en caso de no haber conexión.

## Drawbacks
*   **SEO:** El SEO puro para las páginas dinámicas es pobre en SPAs. Sin embargo, dado que CubeForge es una herramienta de productividad logada y no un blog de contenido indexable, el SEO es irrelevante para las rutas internas.

## Alternatives
*   **Next.js (SSG/Export):** Se puede usar la exportación estática de Next.js, pero la herramienta está cada vez más acoplada a Vercel y Server Actions, añadiendo peso y complejidad innecesaria para una PWA local.
*   **Preact / SolidJS:** Ofrecen mejor rendimiento en el DOM, pero el ecosistema 3D de React (si decidimos usar envoltorios de Three.js) es inigualable.

## Unresolved Questions
*   ¿Cómo estructuraremos el enrutamiento para asegurar que el componente del motor 3D no se desmonte innecesariamente al cambiar de vistas (e.g., ir a estadísticas y volver al timer)?
