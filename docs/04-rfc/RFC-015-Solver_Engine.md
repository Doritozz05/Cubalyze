---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-07, DEC-09"
tags: "solver, wasm, kociemba, min2phase"
document_type: "RFC"
---

# RFC-015-Solver_Engine

## Summary
Este RFC propone la integración de **min2phase** (o un algoritmo de Kociemba de dos fases equivalente) compilado a **WebAssembly (WASM)** para la generación de *scrambles* (mezclas) aleatorias y la búsqueda de soluciones óptimas directamente en el cliente, sin requerir una API backend.

## Motivation
La generación de scrambles oficiales de la WCA (World Cube Association) exige que las secuencias generadas conduzcan a estados aleatorios uniformes y proporcionen una secuencia de mezcla de tamaño óptimo (generalmente < 22 movimientos). Calcular esto en Javascript puro es computacionalmente muy lento (bloquea el thread principal) y requerir un backend frustra el objetivo "offline-first". WASM ofrece velocidades casi nativas.

## Proposed Solution
*   **Core Algorithm:** Algoritmo de 2 fases de Herbert Kociemba (implementación `min2phase` de cs0x7f u otra validada por la comunidad).
*   **Compilación:** Compilaremos el código fuente (C++ o Rust) a WebAssembly (`.wasm`).
*   **Ejecución:** El WASM se instanciará dentro de un **Web Worker** dedicado (RFC-016) para asegurar que el cálculo intenso del solver (que puede tomar 10-50ms) nunca congele el hilo de la UI.

## Detailed Design
*   La aplicación descargará el fichero `.wasm` precompilado (pesa unos 100-200kb) y lo cacheará localmente vía Service Worker.
*   En el arranque, el Web Worker cargará las tablas de inicialización (pruning tables). Dado que generar las tablas completas en memoria puede tardar varios segundos, evaluaremos pre-generar las tablas y serializarlas para cargarlas instantáneamente.
*   API expuesta: `generateScramble() -> String`, `solve(state) -> String`.

## Drawbacks
*   **Tiempo de Inicialización:** Los solvers de dos fases requieren inicializar grandes tablas de *pruning* en memoria. Esto puede introducir un retraso de 1-2 segundos en el *first load*.
*   **Soporte WASM:** Dispositivos extremadamente antiguos podrían no soportar WASM, pero es ampliamente soportado en >95% de navegadores modernos.

## Alternatives
*   **Solver en Backend (API):** Generar los scrambles en el servidor. Rechazado porque rompe el offline-first y añade latencia de red.
*   **Solver en JS Puro:** Usar la versión en Javascript. Funciona, pero es significativamente más lento e impacta el consumo de batería en móviles.

## Unresolved Questions
*   ¿Descargaremos el módulo ya empaquetado en NPM (como `cubejs`) o crearemos un binding custom en Rust+WASM para mejor integración en nuestro monorepo?
