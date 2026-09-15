---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "None"
tags: "platform, pwa, offline-first, storage, opfs"
document_type: "RFC"
---

# RFC-011-PWA_Storage_Eviction_Policies

## Summary
Este RFC define la estrategia de almacenamiento local persistente para la PWA de Cubalyze (DEC-02) y cómo evitar que el navegador elimine los datos en situaciones de poco espacio en disco (Eviction Policies).

## Motivation
Cubalyze está diseñado como una aplicación Offline-First. Todo el estado (sesiones, miles de tiempos, preferencias) vivirá primordialmente en el navegador. Navegadores como Safari/Chrome pueden borrar IndexedDB de forma silenciosa si el dispositivo se queda sin espacio, lo cual es inaceptable para una herramienta donde el usuario confía sus datos. Necesitamos una solución arquitectónica que garantice la permanencia de los datos locales y un plan de mitigación en caso de borrado.

## Proposed Solution
(Pendiente de redacción detallada). La hipótesis de diseño principal incluye solicitar el permiso de `Persistent Storage` explícitamente y usar un sistema de SQLite compilado a WASM ejecutándose sobre OPFS (Origin Private File System) o IndexedDB, junto a un mecanismo de sincronización en la nube (Supabase Backup) como plan B de recuperación.

## Detailed Design
(TBD)

## Alternatives
*   **LocalStorage:** Inviable por límites de capacidad (5MB) y bloqueo síncrono del hilo principal.
*   **IndexedDB Puro:** Bueno para asincronía, pero complejo para consultas relacionales y sujeto a Eviction si no se gestiona bien el API de Storage.
*   **SQLite WASM sobre OPFS:** Alta performance, consultas SQL nativas en el navegador, pero soporte más reciente en navegadores y problemas de compatibilidad en Safari antiguo.

## Unresolved Questions
*   ¿Cuál es el porcentaje de adopción actual de OPFS (Origin Private File System) en navegadores móviles (iOS/Android)?
*   ¿Cómo se comportará el Sync Engine si el almacenamiento local se corrompe parcialmente?
