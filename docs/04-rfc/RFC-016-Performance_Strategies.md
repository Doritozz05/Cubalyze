---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-10, DEC-11"
tags: "performance, web workers, comlink, arraybuffer"
document_type: "RFC"
---

# RFC-016-Performance_Strategies

## Summary
Este RFC establece la estrategia central de rendimiento de Cubalyze: delegar todas las tareas pesadas (Motor de Base de Datos SQLite WASM y Generador de Scrambles/Solver WASM) a **Web Workers** orquestados a través de **Comlink**, y usar `SharedArrayBuffer` / `ArrayBuffer` para la transferencia de estados cuando sea necesario.

## Motivation
Las aplicaciones Single Page Application (SPA) en React sufren jank (caída de fotogramas) si el "Main Thread" se bloquea con tareas sincrónicas mayores a 16ms. Operaciones como guardar 50 registros en SQLite, o calcular la inicialización de Kociemba pueden tardar de 50ms a varios segundos. Debemos garantizar 60fps inquebrantables para el renderizado 3D y el cronómetro de resolución.

## Proposed Solution
*   **Workers Arquitectónicos:** 
    1.  `DB Worker`: Maneja exclusivamete las peticiones a SQLite (OPFS).
    2.  `Solver Worker`: Maneja Kociemba y cálculos pesados.
*   **Comunicación con Comlink:** Usaremos la librería `comlink` de Google Chrome Labs para abstraer la mensajería `postMessage` en llamadas RPC transparentes basadas en Promesas (`await dbWorker.saveSolve(...)`).

## Detailed Design
*   Los Web Workers se inicializarán durante la carga asíncrona de la aplicación.
*   El cronómetro y el loop de render de Three.js permanecen en el hilo principal (Main Thread).
*   En los escenarios donde debamos transferir grandes volúmenes de datos binarios (ej. exportación/importación masiva de sesiones, o grandes texturas), se utilizará `Transferable Objects` (ej. `ArrayBuffer`) para evitar copias de memoria innecesarias entre contextos.

## Drawbacks
*   **Complejidad en depuración:** Depurar aplicaciones que corren sobre múltiples hilos en el navegador requiere herramientas de DevTools avanzadas y manejo cuidadoso de Promesas fallidas en el interior de un Worker.
*   **CORS e Isolations:** El uso estricto de `SharedArrayBuffer` requiere configuraciones HTTP específicas (COOP/COEP: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`), lo que puede complicar la carga de assets externos como avatares de usuarios desde CDNs no controladas.

## Alternatives
*   **PostMessage Nativo:** Usar el API básico. Funciona, pero el código de paso de mensajes es engorroso y requiere manejar máquinas de estado manuales para asociar *Requests* con *Responses*. Comlink elimina este boilerplate.
*   **Ejecución Sincrónica (Sin Workers):** Rechazado por el impacto directo en la UX y los FPS.

## Unresolved Questions
*   ¿Habilitaremos formalmente `SharedArrayBuffer` configurando los headers COOP/COEP en Vercel, asumiendo la restricción de assets externos, o bastará con `Transferable Objects` ordinarios?
