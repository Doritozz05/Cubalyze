---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "None"
tags: "tooling, monorepo, turborepo"
document_type: "RFC"
---

# RFC-001-Monorepo_Strategy

## Summary
Este RFC propone la adopción de **Turborepo** como la herramienta de orquestación y construcción del monorepo de Cubalyze, permitiendo escalabilidad masiva y una barrera de entrada baja para contribuidores Open Source.

## Motivation
Cubalyze crecerá desde una simple aplicación web hasta incluir un SDK público, servidores en la nube, wrappers de aplicaciones nativas (Capacitor/Tauri) y múltiples paquetes de lógica interna (ej. un solver de cubo, un renderizador 3D, lógica de estado). Gestionar esto en múltiples repositorios dificultaría el desarrollo local y el testing cruzado. Un monorepo resuelve esto, pero requiere orquestación. 

## Proposed Solution
Utilizar **Turborepo**.
* Proporciona caché de construcción remota y local (Zero-configuration caching).
* Es agnóstico al gestor de paquetes.
* Orquesta tareas complejas (`lint`, `test`, `build`) respetando el grafo de dependencias interno de forma asíncrona.

## Detailed Design
*   El archivo de configuración principal será `turbo.json` en la raíz.
*   Se definirán los pipelines principales:
    *   `build`: Depende del `build` de sus dependencias (`^build`).
    *   `lint`: Tarea aislada y paralelizable.
    *   `test`: Tarea aislada y paralelizable.
    *   `dev`: Tarea persistente, sin caché.
*   **Seguridad y Caché Remota:** Para mitigar ataques de *Cache Poisoning*, la caché remota en sistemas de CI/CD solo permitirá acceso de **escritura** a ramas de confianza (`main`) y *Core Team*. Los *forks* tendrán acceso estricto de **solo lectura** (*Read-Only*).

## Drawbacks
*   Agrega una capa de complejidad al entendimiento de los comandos de build (hay que usar `turbo run dev` en lugar de `npm run dev`).
*   Los scripts deben ser deterministas para que la caché no genere falsos positivos.
*   Futuros módulos en otros lenguajes (Rust/WASM) requerirán configurar tareas manuales en Turborepo.

## Alternatives
*   **Nx**: Excelente, pero la curva de aprendizaje es más pronunciada y su configuración es pesada, lo cual asusta a los contribuidores *casuales* de Open Source.
*   **Lerna/Rush**: Lerna es más antiguo y menos enfocado en caché rápida. Rush es para entornos enterprise masivos.

## Unresolved Questions
*   ~~¿Deberíamos habilitar la caché remota en Vercel si el proyecto es Open Source?~~ **Resuelta:** Sí, pero aplicando reglas estrictas de Read-Only para forks y Read/Write para `main`.
