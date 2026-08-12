---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-011-PWA_Storage_Eviction_Policies"
tags: "platform, pwa, offline-first, storage, opfs, sqlite"
document_type: "ADR"
---

# ADR-011-PWA_Storage_Eviction_Policies

## Context and Problem Statement
CubeForge es Offline-First. Las sesiones, resoluciones y estadísticas se almacenan localmente. Sin embargo, los navegadores borran silenciosamente los datos de almacenamiento (IndexedDB/Cache API) si detectan poco espacio en disco (Eviction). Se requiere una arquitectura robusta para persistir y proteger la base de datos de tiempos del usuario.

## Decision Drivers
*   **Rendimiento:** Soporte de cálculos y agregaciones SQL rápidas para estadísticas de cubos.
*   **Persistencia:** Evitar la pérdida de datos silenciosa (Eviction) por el SO.
*   **Resiliencia:** Capacidad de restaurar los datos si el usuario cambia de dispositivo o borra datos del navegador.

## Considered Options
*   **Opción 1:** IndexedDB estándar.
*   **Opción 2:** SQLite WASM + Origin Private File System (OPFS) + Persistencia de Navegador + Sync Supabase.

## Decision Outcome
Chosen option: **Opción 2: SQLite WASM sobre OPFS, uso de `navigator.storage.persist()`, y Sincronización a Supabase**.
1. **Rendimiento:** SQLite WASM respaldado por OPFS brinda el rendimiento máximo posible en web para operaciones de I/O, vital para gestionar grandes volúmenes de resoluciones.
2. **Mitigación de Eviction:** Se invocará a la API `navigator.storage.persist()` para pedir formalmente al navegador que marque los datos como críticos y evite su borrado automático.
3. **Resiliencia (Cloud Sync):** Pese a lo anterior, el borrado de cookies/historial manual destruirá los datos OPFS. Por tanto, el estado "Offline" se respaldará periódicamente a Supabase (aprovechando ADR-007).

### Implementation Status (2026-08-12)

SQLite WASM sobre OPFS implementado en `packages/database` (worker + client). **`navigator.storage.persist()` no invocado** (solo `estimate()` en Settings/AdvancedSection). La sincronización a Supabase (punto 3 de la decisión) sigue pendiente (ver ADR-019).

### Positive Consequences
*   Consultas SQL completas y veloces en el navegador.
*   Datos persistentes y respaldados.

### Negative Consequences
*   La integración inicial de SQLite WASM en OPFS requiere configuración de Web Workers pesada.
