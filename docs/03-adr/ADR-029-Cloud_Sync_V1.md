---
status: "Accepted"
owner: "Product Lead"
reviewers: "Architecture Lead"
created: "2026-08-21"
last_updated: "2026-08-21"
version: "1.0.0"
depends_on: "ADR-019, ADR-013, RFC-024"
tags: "supabase, sync, LWW, tombstones, aggregates, identity"
document_type: "ADR"
---

# ADR-029-Cloud_Sync_V1

## Context and Problem Statement

El ADR-019 eligió Supabase con event sourcing append-only para la
sincronización, pero quedó diferido. Al implementar la primera entrega
(cuentas + sync) hay que decidir: (a) el modelo de sincronización concreto,
(b) cómo se resuelven los conflictos de los agregados de entrenamiento, y
(c) qué pasa con la identidad anónima local al vincular una cuenta.

## Decision Drivers

- Offline-first: la app no puede degradarse sin red.
- El esquema local (27 migraciones + repositorios) ya es la fuente de verdad.
- Dos dispositivos entrenando el mismo caso a la vez no deben perder
  contadores (FSRS, streaks, exactitud).
- El CubeMark (identicon) se genera del `user_id`: vincular la cuenta no
  debe cambiar el avatar del usuario.

## Decision Outcome

1. **Row-sync LWW con watermarks y tombstones** (no event sourcing en v1).
   Las tablas sincronizables se espejan en Postgres con RLS por `user_id`;
   el cliente empuja/pull por watermarks; el servidor aplica
   `excluded.updated_at >= table.updated_at` en `sync_apply`. Los borrados
   viajan como tombstones capturados por triggers locales (migración 028).
2. **Los agregados se recalculan, nunca se sincronizan.** Solo el log
   inmutable (`training_attempts`, solves, sesiones, tareas, skills) se
   sincroniza; `algorithm_progress`/`exercise_progress` se reconstruyen en
   cada dispositivo mediante replay determinista del log (el mismo
   `ProgressTracker` en vivo sobre un repo en memoria —
   `@cubeforge/training/src/progress/replay.ts`). Idempotente y sin drift.
3. **La identidad anónima se preserva como semilla.** Al reclamar el
   dispositivo, `profiles.user_id` pasa a `auth.uid()`, `app_meta.USER_ID_KEY`
   se actualiza, y el id anónimo original queda aparcado en
   `app_meta.identicon_seed`; el avatar usa `identicon_seed ?? userId`.
4. **Reclamación explícita por dispositivo.** El primer login de un
   dispositivo con datos locales muestra un diálogo ("Subir y combinar" /
   "Empezar de cero"); sin datos locales se vincula en silencio. Nunca se
   fusiona ni se borra sin consentimiento.
5. **Alcance v1: web PWA.** El desktop Tauri reutiliza el mismo motor
   (repositorios compartidos) sin cambios; el login de Google en el webview
   Tauri requiere configuración de redirect adicional y queda fuera de v1.

### Positive Consequences

- El esquema local existente se reutiliza casi intacto (1 migración nueva).
- Cero conflictos en los contadores de entrenamiento por construcción.
- El CubeMark no cambia al vincular la cuenta (D2 se mantiene).
- Las deletes se propagan a todos los dispositivos (tombstones).
- El event sourcing del ADR-019 sigue siendo viable como evolución (el
  diseño v1 es un subconjunto migrable).

### Negative Consequences

- LWW por fila: dos ediciones concurrentes del mismo solve/sesión resuelven
  por `updated_at` mayor (documentado, aceptable en v1).
- `sync_apply` (security definer) exige validar `user_id` por fila; riesgo de
  RLS mal configurada mitigado por tests de integración con dos usuarios.
- Los tombstones se acumulan en la nube (podas futuras).

## Considered Options

- **Event sourcing completo (ADR-019 literal):** trazabilidad total y
  conflictos por campo, pero dos estados en el cliente + proyecciones y
  snapshotting. Aplazado; v1 es su subconjunto.
- **Sincronizar agregados crudos con LWW:** más simple pero pierde
  incrementos cuando dos dispositivos entrenan el mismo caso (rechazado).
- **Nube siempre gana / fusión silenciosa:** rechazados — la reclamación
  explícita es la política de fusión profesional del plan de producto.
