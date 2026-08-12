# Architecture Decision Register

**Propósito**: Este documento es el control central del proceso de decisiones arquitectónicas de CubeForge. No sustituye a los RFC (Request for Comments) ni a los ADR (Architecture Decision Records), sino que rastrea el ciclo de vida completo de cada decisión técnica, asegurando la trazabilidad desde la investigación hasta la actualización del *Architecture Overview*.

---

## Architecture Decision Tracker

| ID               | Decision                               | Category | Current Status | Decision Gate | Confidence | Dependencies           | Risk Level | Validation Required | RFC Status         | ADR Status       | Next Action                                    | Owner             |
| ---------------- | -------------------------------------- | -------- | -------------- | ------------- | ---------- | ---------------------- | ---------- | ------------------- | ------------------ | ---------------- | ---------------------------------------------- | ----------------- |
| **DEC-01** | Licensing Compatibility (MIT)          | Legal    | ADR Created    | Gate 1        | High       | Ninguna                | Critical   | None                | Aprobado (RFC-010) | Creado (ADR-010) | Mantener licencia actual                       | Architecture Lead |
| **DEC-02** | PWA Storage & Eviction Policies        | Platform | ADR Created    | Gate 1        | High       | Ninguna                | Critical   | None                | Aprobado (RFC-011) | Creado (ADR-011) | Implementar wrapper OPFS                       | Architecture Lead |
| **DEC-03** | Web Bluetooth & Mobile Fallbacks       | Platform | ADR Created    | Gate 1        | High       | Ninguna                | High       | None                | Aprobado (RFC-012) | Creado (ADR-012) | Inicializar abstracción BLE                   | Architecture Lead |
| **DEC-04** | Monorepo Strategy (Turborepo)          | Tooling  | ADR Created    | Gate 1        | Very High  | Ninguna                | Medium     | None                | Aprobado (RFC-001) | Creado (ADR-001) | Implementar Monorepo                           | Architecture Lead |
| **DEC-05** | Package Manager (pnpm)                 | Tooling  | ADR Created    | Gate 1        | Very High  | DEC-04                 | Low        | None                | Aprobado (RFC-002) | Creado (ADR-002) | Implementar pnpm                               | Architecture Lead |
| **DEC-06** | Repository Structure                   | Tooling  | ADR Created    | Gate 1        | High       | DEC-04, DEC-05         | Medium     | None                | Aprobado (RFC-003) | Creado (ADR-003) | Implementar estructura                         | Architecture Lead |
| **DEC-07** | Frontend Framework (React+Vite SPA)    | Core App | ADR Created    | Gate 1        | High       | DEC-02, DEC-03         | High       | None                | Aprobado (RFC-008) | Creado (ADR-008) | Configurar proyecto base Vite                  | Architecture Lead |
| **DEC-08** | State Management (Zustand)             | Core App | ADR Created    | Gate 1        | High       | DEC-07                 | High       | None                | Aprobado (RFC-009) | Creado (ADR-009) | Configurar stores de Zustand                   | Architecture Lead |
| **DEC-09** | Offline Database (SQLite WASM/OPFS) | Data | ADR Created | Gate 1 | High | DEC-02 | High | None | Aprobado (RFC-013) | Creado (ADR-013) | Implementar base de datos | Architecture Lead |
| **DEC-10** | Rendering Strategy (Pure Three.js) | Graphics | ADR Created | Gate 1 | High | DEC-01, DEC-08, DEC-11 | Medium | None | Aprobado (RFC-014) | Creado (ADR-014) | Implementar motor 3D | Architecture Lead |
| **DEC-11** | Solver Engine & WASM (min2phase) | Core App | ADR Created | Gate 1 | High | DEC-07, DEC-09 | Medium | None | Aprobado (RFC-015) | Creado (ADR-015) | Implementado (min2phase.js en solver-engine) | Architecture Lead |
| **DEC-12** | Perf. Strategies (Comlink/ArrayBuffer) | Core App | ADR Created | Gate 1 | High | DEC-10, DEC-11 | Medium | None | Aprobado (RFC-016) | Creado (ADR-016) | Implementado (Comlink + DB Worker) | Architecture Lead |
| **DEC-13** | Code Quality & Standards               | Tooling  | ADR Created    | Gate 1        | Very High  | DEC-06                 | Low        | None                | Aprobado (RFC-004) | Creado (ADR-004) | Implementar estándares                        | Architecture Lead |
| **DEC-14** | Testing Stack (Vitest, Playwright)     | Tooling  | ADR Created    | Gate 1        | High       | DEC-05                 | Medium     | None                | Aprobado (RFC-005) | Creado (ADR-005) | Configurar testing stack                       | Architecture Lead |
| **DEC-15** | CI/NPM Publishing (GitHub Actions)     | Ops      | ADR Created    | Gate 1        | Very High  | DEC-04, DEC-14         | Low        | None                | Aprobado (RFC-006) | Creado (ADR-006) | Crear workflows de CI                          | Architecture Lead |
| **DEC-16** | Plugin System (Native ESM Imports) | Core App | ADR Created | Gate 1 | High | DEC-06, DEC-07 | High | None | Aprobado (RFC-017) | Creado (ADR-017) | Implementado como sistema de widgets (apps/web/src/widgets) | Architecture Lead |
| **DEC-17** | Security (Crypto signatures) | Security | ADR Created | Gate 1 | High | DEC-09 | Medium | None | Aprobado (RFC-018) | Creado (ADR-018) | Pendiente de implementación | Architecture Lead |
| **DEC-18** | Backend (Supabase/Append-only) | Cloud | ADR Created | Gate 1 | High | DEC-09, DEC-17 | High | None | Aprobado (RFC-019) | Creado (ADR-019) | Pendiente de implementación (apps/api vacío) | Product Lead |
| **DEC-19** | Accessibility (WAI-ARIA Live Regions) | UI/UX | ADR Created | Gate 1 | High | DEC-07 | Low | None | Aprobado (RFC-020) | Creado (ADR-020) | Implementado (aria-live en Timer/Onboarding/announce) | Architecture Lead |
| **DEC-20** | Documentation Stack | Tooling | ADR Created | Gate 1 | Very High | DEC-04, DEC-07 | Low | None | Aprobado (RFC-021) | Creado (ADR-021) | Inicializar TDDs | Architecture Lead |
| **DEC-21** | Open Source Readiness | Ops | ADR Created | Gate 1 | Very High | DEC-20 | Low | None | Aprobado (RFC-022) | Creado (ADR-022) | Implementado (guía en docs/15-contributing) | Architecture Lead |
| **DEC-22** | Desktop & Mobile Wrappers (Tauri/RN) | Platform | ADR Created | Gate 1 | Medium | DEC-03, DEC-07 | Medium | Prototype | Aprobado (RFC-012) | Creado (ADR-012) | Escritorio Tauri implementado; wrapper móvil diferido a Milestone 2+ | Architecture Lead |
| **DEC-23** | Hosting Strategy (Vercel+Supabase) | Ops | ADR Created | Gate 1 | Very High | DEC-07 | Low | None | Aprobado (RFC-007) | Creado (ADR-007) | Configurar proyectos Vercel y Supabase | Architecture Lead |
| **DEC-24** | Continuous Deployment (Vercel+Supabase) | Ops | ADR Created | Gate 1 | Very High | DEC-15, DEC-23 | Medium | None | Aprobado (RFC-023) | Creado (ADR-023) | Parcial (Vercel OK; migraciones Supabase pendientes) | Ops Lead |

---

## 1. Critical Path

El "Critical Path" identifica las decisiones que bloquean el desarrollo arquitectónico primario y que, de invalidarse, obligarían a rehacer gran parte de la plataforma:

(Ninguna)

*Actualmente, el Critical Path de investigación inicial está completamente desbloqueado. Se puede proceder con la creación de RFCs y desarrollo base.*

---

## 2. Decisions Ready For RFC

Las siguientes decisiones han sido formalizadas en RFCs aprobados o listos para ser convertidos en ADRs (Architecture Decision Records).

* **DEC-10:** Rendering Strategy (Pure Three.js)
* **DEC-11:** Solver Engine & WASM (min2phase)
* **DEC-12:** Perf. Strategies (Comlink/ArrayBuffer)
* **DEC-16:** Plugin System (Native ESM Imports)
* **DEC-17:** Security (Crypto signatures)
* **DEC-18:** Backend (Supabase/Append-only)
* **DEC-19:** Accessibility (WAI-ARIA Live Regions)
* **DEC-21:** Open Source Readiness
* **DEC-24:** Continuous Deployment (Vercel+Supabase)

### Decisions in RFC Review

*(Ninguna)*

---

## 3. Decisions Requiring Validation

*Actualmente, todas las decisiones que requerían validación empírica o de producto han sido evaluadas, definidas arquitectónicamente y enviadas a su RFC correspondiente (DEC-09, DEC-12, DEC-16, DEC-17, DEC-18, DEC-19). Han pasado a estado `Ready For ADR` y sus dudas han quedado despejadas.*

---

## 4. Recommended RFC Creation Order

Para minimizar el riesgo, los RFCs deben ser creados, revisados y transformados en ADRs en este orden exacto:

1. **Foundational Tooling (Riesgo Bajo, Alta Dependencia)**:
   * **DEC-04**, **DEC-05**, **DEC-06**, **DEC-13**, **DEC-14**, **DEC-15**
   * *Justificación*: Antes de validar código en prototipos, el monorepo y las reglas de linting/testing deben estar implementadas para garantizar la calidad del código de validación. Reducen incertidumbre logística.
2. **Core Frontend Structure (Impacto Alto)**:
   * **DEC-07**, **DEC-08**
   * *Justificación*: Una vez validado superficialmente el stack (o en paralelo si no hay bloqueos de Bluetooth fatales), establecer la arquitectura SPA y el manejo del estado (Zustand) es fundamental para empezar a escribir código de producto.
3. **Platform Constraints & Legal (Riesgo Crítico)**:
   * **DEC-01**, **DEC-02**, **DEC-03**
   * *Justificación*: Ya investigadas. Se deben formalizar los RFCs de cómo manejaremos la PWA en iOS y la licencia del repositorio.
4. **Data & Rendering Performance (Dependen de Validación)**:
   * **DEC-09**, **DEC-10**, **DEC-11**, **DEC-12**
   * *Justificación*: Se crearán los RFCs únicamente cuando los Benchmarks resultantes prueben las recomendaciones del Research Report.
5. **Ecosystem & Polish (Baja Dependencia)**:
   * **DEC-20**, **DEC-21**, seguido más tarde por **DEC-16**, **DEC-17**, **DEC-18**, **DEC-19**.
   * *Justificación*: Capas periféricas o de integración. Tienen el menor coste de migración arquitectónica.

---

## 5. Architecture Maturity Assessment

Evaluación del estado actual de madurez del proceso técnico del proyecto:

* **Product Maturity: 80%**
  * *Justificación*: El PRD y el Roadmap maestro son sólidos, describiendo detalladamente la funcionalidad, el contexto de negocio y las expectativas de usuario final (Offline-first, modular).
* **Research Maturity: 100% (Critical Path)**
  * *Justificación*: Se han analizado en profundidad las opciones de stack y los bloqueos críticos (GPLv3, soporte iOS PWA/Bluetooth, OPFS) ya tienen un camino trazado y validado.
* **Decision Maturity (RFCs/ADRs): 85%**
  * *Justificación*: Se han aprobado y redactado los ADRs fundacionales requeridos para la Fase 1 (Epic 1). Los RFCs restantes aguardan sus fases correspondientes.
* **Architecture Maturity (General): 95%**
  * *Justificación*: La plataforma posee una visión técnica clara y las decisiones del Critical Path inicial (Epic 1) están bloqueadas en ADRs formales. La arquitectura está lista para la implementación del TDD de la Fase 1.1.
