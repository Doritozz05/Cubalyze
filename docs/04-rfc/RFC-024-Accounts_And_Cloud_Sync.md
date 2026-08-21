---
status: "Accepted"
owner: "Product Lead"
reviewers: "TBD"
created: "2026-08-21"
last_updated: "2026-08-21"
version: "1.0.0"
depends_on: "RFC-019, ADR-019, ADR-013, ADR-027"
tags: "supabase, auth, google, sync, offline-first, LWW, tombstones"
document_type: "RFC"
---

# RFC-024-Accounts_And_Cloud_Sync

## Summary

Cuentas de usuario (login único con Google) y sincronización en la nube
(Supabase) sobre la arquitectura local-first existente: la app sigue siendo
100% offline-first, y quien lo desee conecta su cuenta para que su perfil,
solves, sesiones, entrenamiento, calendario y skill tree queden respaldados y
sincronizados entre dispositivos.

## Motivation

- El producto es local-first por decisión (ADR-013/ADR-019): hoy no existe
  cuenta, identidad, ni backend (`apps/api` vacío, `sync-engine` placeholder).
- Casos de uso: un usuario con todo su historial en el PC quiere pasarlo al
  móvil y la tablet; backup en la nube; progreso coherente en varios
  dispositivos.
- El ADR-019 ya eligió **Supabase (PostgreSQL)** como BaaS; este RFC concreta
  el diseño de la PRIMERA entrega (v1), que difiere del event sourcing puro
  del ADR-019 (ver §Drawbacks y ADR-029).

## Proposed Solution

1. **Auth:** Supabase Auth, proveedor único Google (OAuth + PKCE, flujo
   full-redirect). La cuenta se crea automáticamente en el primer login.
2. **Identidad local → cuenta (claim):** al primer login de cada dispositivo,
   si hay datos locales, se muestra un diálogo con dos caminos explícitos:
   **"Subir y combinar"** (por defecto) o **"Empezar de cero"** (la nube
   reemplaza el dispositivo). Nunca se fusiona ni se borra en silencio.
   La identidad anónima se preserva como semilla del CubeMark
   (`app_meta.identicon_seed`), de modo que el avatar no cambia al vincular
   la cuenta.
3. **Sync v1 (row-sync LWW):** las tablas sincronizables se espejan en
   Postgres con una columna `user_id` y RLS (`user_id = auth.uid()`). El
   cliente mantiene watermarks por (tabla, dirección, cuenta) en `app_meta`;
   los borrados viajan como **tombstones** (`sync_tombstones`, triggers
   `AFTER DELETE` locales, migración 028). Un RPC `sync_apply` (security
   definer, verifica `user_id`) aplica LWW server-side
   (`excluded.updated_at >= table.updated_at`).
4. **Agregados derivados NO se sincronizan:** `algorithm_progress` y
   `exercise_progress` se recalculan en cada dispositivo con un **replay
   determinista** del log de intentos sincronizado (el mismo
   `ProgressTracker` en vivo sobre un repo en memoria). Cero conflictos de
   contadores.
5. **UI:** página `/auth` standalone (estilo Vercel, tokens del design
   system, en/es), tarjeta de cuenta en Profile y Settings → Cuenta,
   diálogo de reclamación con conteos locales.

## Detailed Design

- **Migración local `028_sync_infrastructure`:** tablas `sync_tombstones`,
  columna `updated_at` en `training_attempts/tasks/sessions` (+ backfill),
  triggers de tombstone y de "dirty" (`sync_dirty` en `app_meta`).
- **Esquema nube** (`supabase/migrations/20260821000000_accounts.sql`):
  espejos de `solves`, `sessions`, `profiles`, `training_attempts`,
  `training_sessions`, `training_tasks`, `skill_progress` + `user_id` y RLS;
  `sync_tombstones`; trigger `on_auth_user_created`; función `sync_apply`.
- **Motor** (`packages/sync-engine`): `SyncEngine` (claim, syncNow,
  scheduleSync, hasPendingChanges, wasLinked), push/pull por watermarks,
  tombstones, rebuild de agregados. El dirty trigger es la red de seguridad
  (ningún write se pierde); los hooks llaman `requestSync()` en las rutas
  calientes (timer/training) para latencia baja; un poller de 45 s + eventos
  online/visibility cubren el resto.
- **Eliminar cuenta:** Edge Function `delete-account` (service role) borra el
  auth user; el `ON DELETE CASCADE` de RLS limpia sus filas. Los datos
  locales se conservan (local-first).

## Drawbacks

- **Desviación del ADR-019:** v1 usa row-sync LWW, no event sourcing
  append-only. La pérdida es la trazabilidad total y la resolución de
  conflictos por campo; se gana simplicidad y el esquema ya existente se
  reutiliza. El event sourcing sigue siendo la evolución natural (los
  tombstones + watermarks son un primer paso hacia un log de cambios).
- **LWW por fila:** dos dispositivos editando el MISMO solve/sesión en
  paralelo: gana el `updated_at` mayor (documentado; aceptable).
- **RLS + security definer:** `sync_apply` debe validar `user_id` por fila;
  los tests de integración con dos usuarios son obligatorios.

## Alternatives

- **Firebase/Firestore:** rechazado en ADR-019 (consultas analíticas).
- **ElectricSQL/PowerSync:** replicación Postgres→SQLite nativa; madurez e
  infraestructura mayores de las deseables en v1 (ADR-019).
- **Event sourcing completo (ADR-019 literal):** aplazado; el diseño v1
  (tablas espejo + tombstones) es un subconjunto migrable.

## Unresolved Questions

- Migración de preferencias (idioma/tema/layout de widgets) entre
  dispositivos: v1 las mantiene device-local.
- Poda de tombstones en la nube (acumulación lenta; inofensiva en v1).
- Catálogo de algoritmos si en el futuro permite contenido de usuario.
