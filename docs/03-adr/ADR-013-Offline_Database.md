---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-013-Offline_Database"
tags: "database, offline-first, sqlite, wasm, opfs"
document_type: "ADR"
---

# ADR-013-Offline_Database

## Context and Problem Statement

Cubalyze se diseña con un enfoque *offline-first*. Manejar miles de *solves* (tiempos de resolución), estadísticas en tiempo real y configuraciones requiere un motor de base de datos transaccional, rápido y robusto. IndexedDB nativo es asíncrono, difícil de manejar y propenso a inconsistencias bajo concurrencia. Se requiere una base de datos local robusta que pueda operar eficazmente y escalar con la complejidad relacional de la aplicación.

## Decision Drivers

* **Offline-first:** La aplicación debe funcionar sin conexión a internet.
* **Rendimiento:** Alta velocidad para registrar solves sin bloquear la UI.
* **Robustez Relacional:** Manejo de datos estructurados complejos (sesiones, tiempos, algoritmos, configuraciones) que requieren propiedades ACID y queries complejos.
* **Concurrencia:** Evitar inconsistencias bajo escritura rápida (múltiples solves en poco tiempo).

## Considered Options

* **Opción 1:** SQLite compilado a WebAssembly (WASM) sobre Origin Private File System (OPFS).
* **Opción 2:** IndexedDB puro (o wrapper ligero como Dexie.js).
* **Opción 3:** RxDB (sobre IndexedDB o adaptadores SQLite).

## Decision Outcome

Chosen option: "Opción 1: SQLite compilado a WebAssembly (WASM) sobre OPFS", porque brinda rendimiento casi nativo, consultas SQL estructuradas y robustez ACID probada, superando significativamente a IndexedDB en escenarios relacionales complejos.

### Positive Consequences

* Base de datos transaccional SQL robusta en el cliente.
* Rendimiento síncrono ultra-rápido garantizado por OPFS.
* Consultas complejas fácilmente mantenibles usando un lenguaje universal (SQL).

### Negative Consequences

* La instancia de SQLite vivirá exclusivamente en un Web Worker dedicado, obligando a manejar toda la comunicación de datos a través de mensajes asíncronos (ej. Comlink), aumentando la complejidad arquitectónica.
* Tamaño inicial de descarga ligeramente superior por el WASM de SQLite, que requerirá ser cacheado por el Service Worker.
* Complejidad en proveer fallback para navegadores que no soporten OPFS.

## Pros and Cons of the Options

### Opción 1: SQLite (WASM) sobre OPFS

* Good, because provee SQL estándar con integridad referencial.
* Good, because OPFS asegura un alto throughput síncrono.
* Bad, because añade complejidad con Web Workers y tamaño del bundle inicial.

### Opción 2: IndexedDB (o Dexie.js)

* Good, because es nativo, fácil de integrar sin Workers y no añade bundle pesado.
* Bad, because rinde mal en consultas relacionales complejas y escrituras concurrentes.

### Opción 3: RxDB

* Good, because ofrece reactividad out-of-the-box.
* Bad, because el storage subyacente por defecto sufre de los mismos problemas de IndexedDB, y usar su driver SQLite requiere una configuración similar a la Opción 1 pero con mayor sobrecarga.
