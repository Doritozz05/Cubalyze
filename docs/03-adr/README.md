# Architecture Decision Records (ADR)

This directory contains the finalized, immutable architectural decisions for the CubeForge project. 

## Workflow
- ADRs are **NOT** generated speculatively.
- An ADR is only created when an architecture decision is **finalized** and **approved**.
- If a technology requires research or team discussion, create a Request for Comments (RFC) in `../04-rfc/` first. Only convert it to an ADR once the RFC is resolved.
- If a technology is explicitly mandated by the PRD (e.g., Web Bluetooth, min2phase), an ADR can be created directly without an RFC.

## Status
24 ADRs finalizados (ADR-001 → ADR-024). El registro central de ciclo de vida está en
[`../02-architecture/Architecture_Decision_Register.md`](../02-architecture/Architecture_Decision_Register.md).
La auditoría de drift (2026-08-12, `../02-architecture/validation/ADR_Drift_Audit_2026-08-12.md`)
verificó cada ADR contra el código real y actualizó los que discrepaban.

## Índice

| ADR | Decisión | Estado |
| --- | --- | --- |
| [ADR-001](ADR-001-Monorepo_Strategy.md) | Monorepo Turborepo | Implementado |
| [ADR-002](ADR-002-Package_Manager.md) | pnpm | Implementado |
| [ADR-003](ADR-003-Repository_Structure.md) | Estructura apps/packages | Implementado |
| [ADR-004](ADR-004-Code_Quality_Standards.md) | ESLint Flat + Prettier | Implementado (Husky/commitlint vía ADR-022) |
| [ADR-005](ADR-005-Testing_Stack.md) | Vitest + Playwright | Parcial (sin Playwright) |
| [ADR-006](ADR-006-CI_NPM_Publishing.md) | GitHub Actions + Changesets | Parcial (sin remote cache) |
| [ADR-007](ADR-007-Hosting_Strategy.md) | Vercel + Supabase | Parcial (sin Supabase) |
| [ADR-008](ADR-008-Frontend_Framework_Architecture.md) | React + Vite SPA/PWA | Implementado |
| [ADR-009](ADR-009-State_Management.md) | Zustand | Implementado |
| [ADR-010](ADR-010-Licensing_Compatibility.md) | MIT | Implementado |
| [ADR-011](ADR-011-PWA_Storage_Eviction_Policies.md) | SQLite WASM/OPFS + persist | Parcial (sin persist/sync) |
| [ADR-012](ADR-012-Web_Bluetooth_Mobile_Fallbacks.md) | HAL + Tauri (escritorio) | Implementado (Tauri; móvil diferido) |
| [ADR-013](ADR-013-Offline_Database.md) | SQLite WASM/OPFS | Implementado |
| [ADR-014](ADR-014-Rendering_Strategy.md) | Three.js puro | Implementado |
| [ADR-015](ADR-015-Solver_Engine.md) | Solver (min2phase.js) | Implementado (JS, no WASM) |
| [ADR-016](ADR-016-Performance_Strategies.md) | Comlink + Web Workers | Implementado |
| [ADR-017](ADR-017-Plugin_System.md) | Extensibilidad (widgets) | Implementado como widgets |
| [ADR-018](ADR-018-Security_Crypto.md) | Firmas criptográficas | No implementado |
| [ADR-019](ADR-019-Backend_Architecture.md) | Supabase event sourcing | No implementado |
| [ADR-020](ADR-020-Accessibility_Strategy.md) | WAI-ARIA Live Regions | Implementado |
| [ADR-021](ADR-021-Documentation_Stack.md) | Docs Markdown en repo | Implementado |
| [ADR-022](ADR-022-Open_Source_Readiness.md) | OSS (MIT, commits convencionales) | Implementado |
| [ADR-023](ADR-023-Continuous_Deployment.md) | CD Vercel + migraciones | Parcial (solo Vercel) |
| [ADR-024](ADR-024-Training_SRS_System.md) | Sistema de Training + SRS/FSRS | Implementado |

## Scalability Governance
Para prevenir bloat de carpetas, los ADR futuros pueden colocarse en subdirectorios por
dominio (ej. `../03-adr/frontend/0001-ui-framework.md`). Los ADR-001…024 existentes
viven en la raíz por convención histórica.
