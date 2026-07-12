---
status: "Accepted"
owner: "Product Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-09, DEC-17"
tags: "backend, supabase, event-sourcing, postgres"
document_type: "ADR"
---

# ADR-019-Backend_Architecture

## Summary
Este RFC establece el diseÃ±o de sincronizaciÃ³n con la nube para CubeForge utilizando **Supabase (PostgreSQL)** como Backend as a Service (BaaS) mediante un modelo basado en **Append-only Event Sourcing** para resolver conflictos generados por el uso offline prolongado.

## Motivation
CubeForge funcionarÃ¡ offline. Un usuario puede hacer 500 *solves* en un aviÃ³n y luego sincronizarlos. Si usamos modelos REST tradicionales de sobreescritura (UPDATEs en filas completas), es fÃ¡cil causar pÃ©rdida de datos o condiciones de carrera si usÃ³ mÃºltiples dispositivos. Necesitamos consistencia eventual robusta.

## Proposed Solution
*   **Plataforma:** Supabase (proporciona Auth, API GraphQL/REST instantÃ¡nea y DB Postgres).
*   **Modelo de Datos (Event Sourcing):** En lugar de hacer `UPDATE` a una entidad `Session`, el cliente emitirÃ¡ una serie de inmutables `Events` (ej. `SOLVE_ADDED`, `SOLVE_DELETED`, `SESSION_ARCHIVED`).
*   **SincronizaciÃ³n:** El cliente empuja un batch (arreglo) de eventos firmados (RFC-018) a Supabase.
*   **ProyecciÃ³n:** Supabase utilizarÃ¡ Edge Functions o Triggers en Postgres para procesar secuencialmente esos eventos y construir la vista materializada (el estado actual del usuario).

## Detailed Design
*   La tabla principal serÃ¡ `cube_events (id, user_id, type, payload, client_timestamp, server_timestamp, signature)`.
*   CRDTs (Conflict-free Replicated Data Types): Para configuraciones simples (como cambiar el tema oscuro/claro), se puede usar un modelo LWW (Last Writer Wins) basado en `client_timestamp`.
*   Auth: IntegraciÃ³n directa de Supabase Auth (Magic Links, OAuth de GitHub/Google).

## Drawbacks
*   **Complejidad en el Cliente:** Obliga al cliente local (SQLite) a tener dos estados: "estado derivado de los eventos locales" y "lista de eventos pendientes de enviar".
*   **Consumo de Espacio DB:** Guardar todos los eventos inmutables consume mÃ¡s espacio en Postgres que simples sobreescrituras. Eventualmente se requiere implementar un proceso de "Snapshotting" o poda.

## Alternatives
*   **Firebase / Firestore:** Resuelve la sincronizaciÃ³n offline nativamente con muy poco esfuerzo, pero el modelo NoSQL dificulta consultas analÃ­ticas complejas (ej. "dame la media mÃ³vil de 5 en las Ãºltimas 3 semanas excluyendo el 5% peor"), que en PostgreSQL (Supabase) son triviales de escribir.
*   **ElectricSQL / PowerSync:** Soluciones emergentes que replican Postgres a SQLite directamente. Se consideraron, pero su nivel de madurez e incursiÃ³n de infraestructura es mÃ¡s alto del deseado por ahora.

## Unresolved Questions
*   Â¿DeberÃ­amos usar Supabase Edge Functions para procesar la lÃ³gica de negocio pesada, o centralizar toda la construcciÃ³n del estado en Triggers/Funciones SQL (PL/pgSQL) dentro de Postgres para maximizar rendimiento?

