---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-02"
tags: "database, offline-first, sqlite, wasm, opfs"
document_type: "RFC"
---

# RFC-013-Offline_Database

## Summary
Este RFC propone el uso de **SQLite compilado a WebAssembly (WASM)** apoyado sobre **OPFS (Origin Private File System)** como motor principal de base de datos offline en la PWA de CubeForge, descartando soluciones puras basadas en IndexedDB debido a sus limitaciones de rendimiento sincrónico y concurrencia.

## Motivation
CubeForge se diseña con un enfoque *offline-first*. Manejar miles de *solves* (tiempos de resolución), estadísticas en tiempo real y configuraciones requiere un motor de base de datos transaccional, rápido y robusto. IndexedDB nativo es asíncrono, difícil de manejar y propenso a inconsistencias bajo concurrencia. SQLite sobre OPFS brinda rendimiento casi nativo, consultas SQL estructuradas y robustez ACID probada.

## Proposed Solution
*   **Motor:** Official SQLite3 WASM port.
*   **Storage:** Origin Private File System (OPFS) para acceso sincrónico a archivos de alto rendimiento (solo disponible en Web Workers).
*   **Arquitectura:** La instancia de SQLite vivirá exclusivamente en un **Web Worker** dedicado para no bloquear el hilo principal. La UI se comunicará con la base de datos a través de mensajes asíncronos o usando wrappers como `Comlink`.
*   **Sincronización:** Los datos se escribirán localmente primero. Un proceso de background worker intentará enviar los eventos al backend (Supabase) cuando haya red (ver RFC-019).

## Detailed Design
*   Se usará la librería `@sqlite.org/sqlite-wasm`.
*   La inicialización verificará el soporte de OPFS en el navegador (`navigator.storage.getDirectory`). Si OPFS no está disponible (ej. navegadores muy antiguos), se aplicará un fallback temporal a almacenamiento en memoria o IndexedDB, aunque se advertirá al usuario sobre degradación de rendimiento.
*   Esquemas: Tablas relacionales para `Sessions`, `Solves` (tiempos, scrambles, penalizaciones) y `Settings`.

## Drawbacks
*   **Complejidad Arquitectónica:** Obliga a manejar toda la comunicación de datos a través de Web Workers.
*   **Soporte de Navegadores:** OPFS es relativamente nuevo, aunque ya está soportado en las versiones recientes de los motores principales (Chromium, WebKit, Gecko). El fallback puede ser complejo.
*   **Tamaño del Bundle:** Descargar el WASM de SQLite añade algunos cientos de kilobytes al primer load, que debe ser cacheado por el Service Worker.

## Alternatives
*   **IndexedDB puro (o Dexie.js):** Más fácil de integrar sin Web Workers forzosos, pero escala mal con bases de datos relacionales complejas y tiene peor rendimiento en escrituras masivas.
*   **RxDB:** Ofrece reactividad out-of-the-box, pero su capa de almacenamiento subyacente sigue sufriendo de las limitaciones de IndexedDB a menos que use su plugin de SQLite (que a su vez requiere configuración similar).

## Unresolved Questions
*   ¿Cómo manejaremos exactamente las migraciones de esquema locales (cambios de versión de la DB) de forma segura en los navegadores de los usuarios sin riesgo de corrupción?
