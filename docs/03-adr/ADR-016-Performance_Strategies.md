---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-10, DEC-11"
tags: "performance, web workers, comlink, arraybuffer"
document_type: "ADR"
---

# ADR-016-Performance_Strategies

## Summary
Este RFC establece la estrategia central de rendimiento de Cubalyze: delegar todas las tareas pesadas (Motor de Base de Datos SQLite WASM y Generador de Scrambles/Solver WASM) a **Web Workers** orquestados a travÃ©s de **Comlink**, y usar `SharedArrayBuffer` / `ArrayBuffer` para la transferencia de estados cuando sea necesario.

## Motivation
Las aplicaciones Single Page Application (SPA) en React sufren jank (caÃ­da de fotogramas) si el "Main Thread" se bloquea con tareas sincrÃ³nicas mayores a 16ms. Operaciones como guardar 50 registros en SQLite, o calcular la inicializaciÃ³n de Kociemba pueden tardar de 50ms a varios segundos. Debemos garantizar 60fps inquebrantables para el renderizado 3D y el cronÃ³metro de resoluciÃ³n.

## Proposed Solution
*   **Workers ArquitectÃ³nicos:** 
    1.  `DB Worker`: Maneja exclusivamete las peticiones a SQLite (OPFS).
    2.  `Solver Worker`: Maneja Kociemba y cÃ¡lculos pesados.
*   **ComunicaciÃ³n con Comlink:** Usaremos la librerÃ­a `comlink` de Google Chrome Labs para abstraer la mensajerÃ­a `postMessage` en llamadas RPC transparentes basadas en Promesas (`await dbWorker.saveSolve(...)`).

## Detailed Design
*   Los Web Workers se inicializarÃ¡n durante la carga asÃ­ncrona de la aplicaciÃ³n.
*   El cronÃ³metro y el loop de render de Three.js permanecen en el hilo principal (Main Thread).
*   En los escenarios donde debamos transferir grandes volÃºmenes de datos binarios (ej. exportaciÃ³n/importaciÃ³n masiva de sesiones, o grandes texturas), se utilizarÃ¡ `Transferable Objects` (ej. `ArrayBuffer`) para evitar copias de memoria innecesarias entre contextos.

## Drawbacks
*   **Complejidad en depuraciÃ³n:** Depurar aplicaciones que corren sobre mÃºltiples hilos en el navegador requiere herramientas de DevTools avanzadas y manejo cuidadoso de Promesas fallidas en el interior de un Worker.
*   **CORS e Isolations:** El uso estricto de `SharedArrayBuffer` requiere configuraciones HTTP especÃ­ficas (COOP/COEP: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`), lo que puede complicar la carga de assets externos como avatares de usuarios desde CDNs no controladas.

## Alternatives
*   **PostMessage Nativo:** Usar el API bÃ¡sico. Funciona, pero el cÃ³digo de paso de mensajes es engorroso y requiere manejar mÃ¡quinas de estado manuales para asociar *Requests* con *Responses*. Comlink elimina este boilerplate.
*   **EjecuciÃ³n SincrÃ³nica (Sin Workers):** Rechazado por el impacto directo en la UX y los FPS.

## Unresolved Questions
*   Â¿Habilitaremos formalmente `SharedArrayBuffer` configurando los headers COOP/COEP en Vercel, asumiendo la restricciÃ³n de assets externos, o bastarÃ¡ con `Transferable Objects` ordinarios?

