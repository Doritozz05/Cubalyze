---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-08-12"
last_updated: "2026-08-12"
version: "1.0.0"
related_rfc: "Ninguno (decisión registrada retroactivamente el 2026-08-12)"
supersedes: "Ninguno"
superseded_by: "None"
tags: "desktop, tauri, ble, sqlite, overrides, mono-shell"
document_type: "ADR"
---

# ADR-027 — Estrategia de la App de Escritorio (Tauri + mono-shell)

> **Nota de registro:** decisión ya implementada (`apps/desktop/`), registrada
> retroactivamente el 2026-08-12 (Fase 5 de documentación). Complementa al
> ADR-012, que decidió Tauri para el escritorio; este ADR registra **cómo** se
> materializó (reutilización de la web + overrides de infraestructura).

## Context and Problem Statement

El proyecto es una PWA local-first (web) y necesita una app de escritorio con
BLE nativo (el Web Bluetooth del navegador es limitado y exige gesto de usuario
en cada conexión). Las preguntas de diseño que había que responder:

- **¿UI duplicada o compartida?** Mantener dos frontends (web + desktop)
  duplicaría ~30.000 líneas de UI, hooks, stores y vistas, y el coste de
  mantenimiento de un proyecto de una persona.
- **¿Cómo cambia la infraestructura sin tocar la app?** En escritorio, el
  protocolo custom de Tauri (`tauri://localhost`) no envía las cabeceras
  Cross-Origin-Isolation que OPFS exige, así que `sqlite-wasm` **cae a memoria**
  (pérdida de datos al recargar). El BLE tampoco puede usar Web Bluetooth.
- **¿Quién gestiona el BLE?** Opciones: solo JS (librería BLE en TS dentro del
  WebView), o Rust nativo con `btleplug` expuesto vía comandos/eventos Tauri.
- **¿Backend?** `apps/api` está vacío desde el inicio; había que documentar si
  eso es un accidente o una decisión.

## Decision Drivers

- **Coste de mantenimiento de 1 persona**: una sola fuente de UI (la web).
- **Persistencia real en escritorio**: sin OPFS viable, la BD debe ser nativa.
- **Cero duplicación de protocolo**: el stack GAN (drivers + crypto + parsing)
  ya existe en `@cubalyze/gan-protocol` — no se reimplementa en Rust.
- **Seguridad**: no filtrar nombres de dispositivos/MACs en logs de release.
- **Mínimo privilegio**: el Rust solo hace transporte BLE y SQLite; toda la
  lógica de negocio sigue en TS.

## Considered Options

- **Opción 1 (elegida): mono-shell con overrides.** La app desktop reutiliza
  `App` de `apps/web` tal cual; `vite.config.ts` resuelve `@cubalyze/database`
  y `@cubalyze/hardware-hal` a archivos override locales. Rust (`btleplug`)
  hace el transporte BLE; TS reutiliza el stack de `gan-protocol` para
  descifrar/parsear. SQLite nativa vía `tauri-plugin-sql` con las **mismas**
  migraciones de `packages/database`.
- **Opción 2: frontend separado para desktop** (Electron/Tauri con su propia
  UI). Máxima libertad, pero duplica la UI y cada feature de la web hay que
  portarla — insostenible para un proyecto de una persona.
- **Opción 3: BLE en TS puro dentro del WebView** (p.ej. `noble` en un proceso
  Node, o `@capacitor-community/bluetooth-le`). Evita Rust, pero: noble requiere
  un proceso Node extra y capacidades de sistema, y las librerías BLE en
  WebView tienen soporte irregular; además perdería el auto-scan en background
  y el cleanup fiable al cerrar ventana.
- **Opción 4: sqlite-wasm tal cual en desktop.** Inviable: sin cabeceras COI el
  fallback es memoria → datos volatilizados en cada recarga.

## Decision Outcome

Chosen option: **Opción 1 — Mono-shell con overrides de infraestructura.**

- **UI compartida**: `apps/desktop/src/main.tsx` importa `App` y `index.css`
  desde `apps/web`. Los aliases de Vite cambian solo dos dependencias
  (`@cubalyze/database` → `database-override.ts`, `@cubalyze/hardware-hal` →
  `hardware-hal-override.ts`); el resto (stores, hooks, vistas, widgets) es
  idéntico y compartido.
- **Puente BLE** (`GanCubeAdapterTauri`, `GanTimerAdapterTauri`):
  Rust (`btleplug`) hace GATT connect/discover/subscribe/write; emite eventos
  (`ble:data`, `ble:status`, `ble:devices_found`, `ble:timer_event`,
  `ble:timer_status`); TS descifra y parsea con `@cubalyze/gan-protocol` sin
  cambios y expone los mismos Subjects RxJS que el adaptador web. Paridad
  funcional: `ClockDriftReconciler`, `invalidMoves$`, validación FACELETS(54),
  reconexión 3 intentos con backoff exponencial.
- **Base de datos nativa**: `tauri-plugin-sql` escribe `cubeforge.db` en
  AppData; reutiliza `MIGRATIONS` y repositorios de `packages/database` con el
  mismo motor transaccional, más una red de seguridad v1→v2
  (`_backup_v1_*` + restore idempotente) para la migración `022_baseline_v2`.
- **Auto-conexión desktop-only**: el auto-scan de Rust al arrancar +
  `listen('ble:devices_found')` en `main.tsx` conectan sin gesto de usuario
  (imposible en Web Bluetooth).
- **Logs seguros**: `debug_log!` solo escribe en builds de debug; en release se
  expande a nada (los MACs/nombres nunca se filtran).
- **`apps/api` diferido**: el backend no se implementa aún — ver sección 5 del
  ADR-019 (decisión de aplazamiento). `apps/api` queda como scaffold vacío.

### Positive Consequences

- Una sola UI para web y desktop; cada feature se construye una vez.
- Cero duplicación de protocolo GAN (crypto/parsing siguen en TS).
- Persistencia real y rápida en escritorio (SQLite nativa en AppData).
- Auto-conexión sin fricción (unique selling point del escritorio).
- Los overrides están aislados en `apps/desktop/src/` — la web no sabe nada.

### Negative Consequences

- Los aliases de Vite son un mecanismo implícito: hay que conocerlos para
  entender qué ejecuta el desktop (mitigado por esta doc + TDD-0002).
- `database-override.ts` duplica la lista de repositorios (hay que mantenerla
  en sync con `packages/database`) — el código marca la deuda con un NOTE.
- Auto-actualización desactivada (sin canal firmado) — los parches de escritorio
  requieren rebuild manual hasta configurar el updater.
- El plugin `removeCrossoriginCss` es un hack de build para el protocolo
  `asset://` de Tauri (CSS bloqueado por CORS).

## Unresolved Questions

- ¿Cuándo se implementa el backend (`apps/api` + Supabase)? El aplazamiento está
  documentado; cuando el sync en la nube sea prioridad, el ciclo RFC → ADR →
  TDD se dispara de nuevo.
- ¿Se configurará el updater firmado de Tauri (canal de releases + clave
  pública) para auto-actualizaciones del escritorio?
- ¿El puente BLE debería salir a un paquete (`packages/tauri-bridge`) cuando
  haya más de una app consumidora?
