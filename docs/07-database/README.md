# 07 — Base de datos

> Estado real (2026-08-12): la BD existe y está **bien documentada en otros
> sitios**; esta carpeta es el punto de entrada.

CubeForge es **local-first**: no hay base de datos de servidor (ADR-019 diferido).
El almacenamiento es:

- **Web (PWA)**: SQLite WASM sobre **OPFS** vía worker Comlink
  (`@cubalyze/database`), con 16+ migraciones versionadas y repositorios.
- **Desktop (Tauri)**: SQLite nativa (`tauri-plugin-sql`) en AppData, **las
  mismas migraciones y repositorios** (override `database-override.ts`), con red
  de seguridad v1→v2 (`_backup_v1_*`).
- **Preferencias**: localStorage (`cubeforge-prefs`) vía Zustand persist.

## Dónde está documentado

| Tema | Lugar |
|---|---|
| Arquitectura del paquete `database` (esquema, migraciones, repos) | [`../06-api/data.md`](../06-api/data.md) |
| Decisiones (SQLite/OPFS, eviction, offline) | ADR-011, ADR-013 |
| Override de escritorio (tauri-plugin-sql, backup/restore) | [`../02-architecture/Desktop_App.md`](../02-architecture/Desktop_App.md) |
| Cabeceras COI necesarias para OPFS | [`../11-devops/Deploy_and_Hosting.md`](../11-devops/Deploy_and_Hosting.md) |
| Esquema real (SQL) | `packages/database/src/migrations/` (código) |

## Pendiente

- Un diagrama ER de las tablas v2 (cuando se documente en detalle el esquema
  actual — hoy las migraciones son la fuente de verdad).
- Backend/sync en la nube: **planeado** (`sync-engine`), sin implementar.

## Governance

Ver [Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md).
