---
status: "Active"
owner: "Principal Architect"
last_updated: "2026-08-12"
document_type: "Architecture Overview"
---

# System Architecture Overview

> **Documento de verdad actual** (revisado el 2026-08-12, Fases 0–8 del plan de
> documentación). Describe el sistema **como existe hoy**, verificado contra el
> código. Cada afirmación traza a su ADR o a su documentación de detalle.

## 1. Frontend — una app, dos shells

- **Web (PWA)** — `apps/web`: React 19 + Vite 8, SPA instalable (`vite-plugin-pwa`),
  despliegue en Vercel. Es el código fuente de toda la UI.
- **Desktop (Tauri 2)** — `apps/desktop`: wrapper que **reutiliza la web entera**
  (`main.tsx` importa `App` de `apps/web`) y solo cambia dos capas vía aliases de
  Vite: base de datos (SQLite nativa) y hardware (BLE Rust). Ver
  [Desktop_App.md](../Desktop_App.md) y ADR-027.
- **Móvil**: no existe. El wrapper móvil (Capacitor) está **diferido** (ADR-012).

## 2. Backend — no hay (por decisión)

- **Local-first al 100%**: timer, análisis, training, widgets y perfil funcionan
  sin servidor. `apps/api` es un scaffold vacío; **el backend se difirió**
  (ADR-019 — Supabase + event sourcing append-only, sin implementar).
- Sync en la nube: planeado (`sync-engine` marcado como *planeado*), sin código.

## 3. Almacenamiento local

- **Web**: SQLite WASM sobre **OPFS** (persistente) vía worker Comlink
  (`@cubalyze/database`). Requiere cabeceras COOP/COEP (`credentialless`)
  tanto en dev como en Vercel.
- **Desktop**: SQLite nativa (`tauri-plugin-sql`) en AppData, mismas migraciones
  y repositorios (ADR-013/027).
- **Preferencias**: Zustand persist en localStorage (`cubeforge-prefs`).

## 4. Motor y dominios (paquetes)

- **Núcleo**: `math-core` (matemática del cubo, centros fijos), `solver-engine`
  (min2phase.js, 2×2, Cross — ADR-015), `cube-3d-engine` (Three.js puro,
  ADR-014/TDD-0006), `algorithm-db` (catálogo + seed + CaseVerifier),
  `models` (schemas zod), `types` (tipos compartidos).
- **Hardware**: `hardware-hal` (HAL: `ClockDriftReconciler`, adaptadores),
  `gan-protocol` (BLE cifrado, drivers gen2/3/4 + timer), `timer-engine`
  (fases + penalizaciones, TDD core/0004).
- **Datos/estado**: `database` (SQLite: 16+ migraciones, repositorios),
  `state` (Zustand, 6 stores — ADR-009), `statistics` (Ao5/BPA/WPA puras).
- **IA/análisis**: `analysis-engine` (pipeline **versionado**, TimelineBuilder,
  analyzeSolveText), `training` (SRS **FSRS-4** — ADR-024/TDD-0001),
  `ai-core` (planeado). *No hay RAG ni LLM en producción.*
- **UI/utilidades**: `ui` (kit Radix), `identicon` (CubeMark),
  `config-eslint`, `config-typescript`.

## 5. Flujo principal (solve)

1. Entrada: cubo/timer GAN (BLE) o stackmat (audio) → adaptadores del HAL.
2. `timer-engine` aplica fases/penalizaciones → `timerStore`.
3. `useSolveSession` registra la solución (movimientos wide) →
   `sessionStore` → SQLite.
4. Los widgets (11 implementaciones) y las vistas Insights/Training consumen
   `solves` readonly + análisis. Ver [`data-flow.mmd`](../diagrams/data-flow.mmd).

## 6. Extensibilidad y UI

- **Widgets**: sistema dock/SDK propio (`apps/web/src/widgets/`) con
  `WidgetHostAPI` aislada, registro lazy, banda z-25..49 (ADR-017/026, TDD
  frontend/0001). 11 built-ins.
- **i18n**: i18next + typed keys, ES/EN, sistema de tandas (ADR-025).
- **A11y**: WAI-ARIA live regions via `announce` (ADR-020).

## 7. Plombería

- Monorepo Turborepo + pnpm 11; CI en 2 workflows (ci.yml + quality-gates.yml,
  ADR-028); deploy web en Vercel (vercel.json, COI/CSP); releases vía changesets
  (primer release preparado en Fase 8, sin publicar). Detalle:
  [`11-devops`](../../11-devops/).

## 8. Diagramas y detalle

- Grafo de dependencias: [`monorepo-dependencies.mmd`](../diagrams/monorepo-dependencies.mmd).
- Vistas de usuario: [`16-user`](../../16-user/). Arquitectura de la web:
  [`../web/`](../web/). Widgets: [`../Widgets_System.md`](../Widgets_System.md).
- Verificación ADR↔código: [`../validation/ADR_Drift_Audit_2026-08-12.md`](../validation/ADR_Drift_Audit_2026-08-12.md).
