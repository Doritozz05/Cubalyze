---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-08-12"
version: "1.1.0"
depends_on: "DEC-07, DEC-09"
tags: "solver, wasm, kociemba, min2phase"
document_type: "ADR"
---

# ADR-015-Solver_Engine

## Summary
Este RFC propone la integraciÃ³n de **min2phase** (o un algoritmo de Kociemba de dos fases equivalente) compilado a **WebAssembly (WASM)** para la generaciÃ³n de *scrambles* (mezclas) aleatorias y la bÃºsqueda de soluciones Ã³ptimas directamente en el cliente, sin requerir una API backend.

## Motivation
La generaciÃ³n de scrambles oficiales de la WCA (World Cube Association) exige que las secuencias generadas conduzcan a estados aleatorios uniformes y proporcionen una secuencia de mezcla de tamaÃ±o Ã³ptimo (generalmente < 22 movimientos). Calcular esto en Javascript puro es computacionalmente muy lento (bloquea el thread principal) y requerir un backend frustra el objetivo "offline-first". WASM ofrece velocidades casi nativas.

## Proposed Solution
*   **Core Algorithm:** Algoritmo de 2 fases de Herbert Kociemba (implementaciÃ³n `min2phase` de cs0x7f u otra validada por la comunidad).
*   **CompilaciÃ³n:** Compilaremos el cÃ³digo fuente (C++ o Rust) a WebAssembly (`.wasm`).
*   **EjecuciÃ³n:** El WASM se instanciarÃ¡ dentro de un **Web Worker** dedicado (RFC-016) para asegurar que el cÃ¡lculo intenso del solver (que puede tomar 10-50ms) nunca congele el hilo de la UI.

## Detailed Design
*   La aplicaciÃ³n descargarÃ¡ el fichero `.wasm` precompilado (pesa unos 100-200kb) y lo cachearÃ¡ localmente vÃ­a Service Worker.
*   En el arranque, el Web Worker cargarÃ¡ las tablas de inicializaciÃ³n (pruning tables). Dado que generar las tablas completas en memoria puede tardar varios segundos, evaluaremos pre-generar las tablas y serializarlas para cargarlas instantÃ¡neamente.
*   API expuesta: `generateScramble() -> String`, `solve(state) -> String`.

## Drawbacks
*   **Tiempo de InicializaciÃ³n:** Los solvers de dos fases requieren inicializar grandes tablas de *pruning* en memoria. Esto puede introducir un retraso de 1-2 segundos en el *first load*.
*   **Soporte WASM:** Dispositivos extremadamente antiguos podrÃ­an no soportar WASM, pero es ampliamente soportado en >95% de navegadores modernos.

## Alternatives
*   **Solver en Backend (API):** Generar los scrambles en el servidor. Rechazado porque rompe el offline-first y aÃ±ade latencia de red.
*   **Solver en JS Puro:** Usar la versiÃ³n en Javascript. Funciona, pero es significativamente mÃ¡s lento e impacta el consumo de baterÃ­a en mÃ³viles.

## Implementation Status (2026-08-12)

Implementado con el paquete npm **`min2phase.js`** (puerto JavaScript de min2phase), **no** compilado a WASM: `packages/solver-engine/src/Min2PhaseSolver.ts` importa `min2phase` y expone `solve()`. El paquete incluye además `RandomStateGenerator`, `PhaseSolver`, `CrossScrambleGenerator` y `TwoByTwoScrambler`. La compilación a WASM queda como optimización futura.

## Unresolved Questions
*   Â¿Descargaremos el mÃ³dulo ya empaquetado en NPM (como `cubejs`) o crearemos un binding custom en Rust+WASM para mejor integraciÃ³n en nuestro monorepo?

