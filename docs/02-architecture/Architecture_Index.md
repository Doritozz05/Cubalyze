# Architecture Index

Mapa de todos los documentos de arquitectura. **Actualizado el 2026-08-12**
(Fases 0–8 del plan de documentación).

## Core Governance
- [Architecture Lifecycle](./Architecture_Lifecycle.md): el ciclo de decisión
  (PRD → RFC → ADR → TDD → código).

## Current State of Truth (Overview)
*Reflejan la arquitectura aceptada, verificada contra el código:*

- [System Architecture Overview](./overview/System_Architecture_Overview.md) —
  el mapa del sistema (apps, paquetes, flujos). ✅ Actualizado 2026-08-12.
- [Desktop_App.md](./Desktop_App.md) — la app Tauri (puente BLE, overrides).
- [Widgets_System.md](./Widgets_System.md) — sistema de widgets (SDK, dock, store).
- [web/](./web/README.md) — arquitectura de la web: estado/stores, componentes,
  hooks/servicios.
- [overview/README.md](./overview/README.md) — índice del detalle por dominio.

## Decisiones (ADRs)
- [Registro de decisiones](./Architecture_Decision_Register.md) — DEC-01 → DEC-29.
- [Índice de ADRs](../03-adr/README.md) — ADR-001 → ADR-028 (inmutables; los
  retroactivos marcan su naturaleza).

## Research & Exploration
*Exploración previa a decisiones (no son decisiones finales):*
- [Architecture Research Roadmap](./research/Architecture_Research_Roadmap.md)
- [Initial Architecture Research Report](./research/Initial_Architecture_Research_Report.md)
- [research/platform/](./research/platform/) — informes (Bluetooth, PWA storage, auditoría legal).

## Validation Data
*Datos duros y verificación de que la arquitectura coincide con el código:*
- [ADR Drift Audit (2026-08-12)](./validation/ADR_Drift_Audit_2026-08-12.md) —
  los 23 ADRs verificados uno a uno contra el código real.

## Diagrams
*Modelos visuales de la arquitectura (Mermaid):*
- [monorepo-dependencies.mmd](./diagrams/monorepo-dependencies.mmd) — grafo de dependencias reales.
- [data-flow.mmd](./diagrams/data-flow.mmd) — flujo de datos de un solve.
