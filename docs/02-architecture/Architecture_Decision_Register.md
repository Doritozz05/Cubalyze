# Architecture Decision Register

**Propósito**: Este documento es el control central del proceso de decisiones arquitectónicas de CubeForge. No sustituye a los RFC (Request for Comments) ni a los ADR (Architecture Decision Records), sino que rastrea el ciclo de vida completo de cada decisión técnica, asegurando la trazabilidad desde la investigación hasta la actualización del *Architecture Overview*.

---

## Architecture Decision Tracker

| ID | Decision | Category | Current Status | Decision Gate | Confidence | Dependencies | Risk Level | Validation Required | RFC Status | ADR Status | Next Action | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **DEC-01** | Licensing Compatibility (GPLv3) | Legal | Ready For RFC | Gate 1 | High | Ninguna | Critical | None | No iniciado | No creado | Añadir licencia GPLv3 al repositorio y crear RFC | Architecture Lead |
| **DEC-02** | PWA Storage & Eviction Policies | Platform | Ready For RFC | Gate 1 | High | Ninguna | Critical | None | No iniciado | No creado | Crear RFC definiendo OPFS + Cloud Sync Fallback | Architecture Lead |
| **DEC-03** | Web Bluetooth & Mobile Fallbacks | Platform | Ready For RFC | Gate 1 | High | Ninguna | High | None | No iniciado | No creado | Crear RFC de arquitectura BLE + Capacitor | Architecture Lead |
| **DEC-04** | Monorepo Strategy (Turborepo) | Tooling | RFC Review | Gate 1 | Very High | Ninguna | Medium | None | Creado (RFC-001) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-05** | Package Manager (pnpm) | Tooling | RFC Review | Gate 1 | Very High | DEC-04 | Low | None | Creado (RFC-002) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-06** | Repository Structure | Tooling | RFC Review | Gate 1 | High | DEC-04, DEC-05 | Medium | None | Creado (RFC-003) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-07** | Frontend Framework (React+Vite SPA) | Core App | Ready For RFC | Gate 1 | High | DEC-02, DEC-03 | High | None | No iniciado | No creado | Crear RFC de arquitectura frontend | Architecture Lead |
| **DEC-08** | State Management (Zustand) | Core App | Ready For RFC | Gate 1 | High | DEC-07 | High | None | No iniciado | No creado | Crear RFC de flujo de estado | Architecture Lead |
| **DEC-09** | Offline Database (SQLite WASM/OPFS) | Data | Prototype Required | Gate 1 | Medium | DEC-02 | High | Benchmark, Prototype | No iniciado | No creado | Benchmark de queries complejas vs IndexedDB | Architecture Lead |
| **DEC-10** | Rendering Strategy (Pure Three.js) | Graphics | Ready For RFC | Gate 1 | High | DEC-01, DEC-08, DEC-11 | Medium | None | No iniciado | No creado | Crear RFC para motor 3D propio | Architecture Lead |
| **DEC-11** | Solver Engine & WASM (min2phase) | Core App | Ready For RFC | Gate 1 | High | DEC-07, DEC-09 | Medium | None | No iniciado | No creado | Crear RFC para integración de min2phase WASM | Architecture Lead |
| **DEC-12** | Performance Strategies (Workers) | Core App | Prototype Required | Gate 1 | Medium | DEC-10, DEC-11 | Medium | Benchmark | No iniciado | No creado | Medir overhead de serialización main-thread a worker | Architecture Lead |
| **DEC-13** | Code Quality & Standards | Tooling | RFC Review | Gate 1 | Very High | DEC-06 | Low | None | Creado (RFC-004) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-14** | Testing Stack (Vitest, Playwright) | Tooling | RFC Review | Gate 1 | High | DEC-05 | Medium | None | Creado (RFC-005) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-15** | CI/CD & Publishing (GitHub Actions) | Ops | RFC Review | Gate 1 | Very High | DEC-04, DEC-14 | Low | None | Creado (RFC-006) | No creado | Aprobar RFC y crear ADR | Architecture Lead |
| **DEC-16** | Plugin System Architecture | Core App | Research | Gate 0 | Low | DEC-06, DEC-07 | High | Research | No iniciado | No creado | Investigar inyección de código dinámico en SPA | Architecture Lead |
| **DEC-17** | Security (Local-first Integrity) | Security | Research | Gate 0 | Low | DEC-09 | Medium | Research | No iniciado | No creado | Investigar mitigación de manipulación de leaderboard local | Architecture Lead |
| **DEC-18** | Backend & Cloud Sync (Supabase) | Cloud | Awaiting Decision | Gate 1 | High | DEC-09, DEC-17 | High | Human Product Decision | No iniciado | No creado | Definir estrategia de hosting (managed vs self-hosted) | Product Lead |
| **DEC-19** | Accessibility & Internationalization | UI/UX | Research | Gate 0 | High | DEC-07 | Low | Research | No iniciado | No creado | Definir DOM estructural para a11y de temporizadores | Architecture Lead |
| **DEC-20** | Documentation Stack | Tooling | Ready For RFC | Gate 1 | Very High | DEC-04, DEC-07 | Low | None | No iniciado | No creado | Crear RFC para stack de documentación | Architecture Lead |
| **DEC-21** | Open Source Readiness | Ops | Ready For RFC | Gate 1 | Very High | DEC-20 | Low | None | No iniciado | No creado | Crear RFC de gobernanza OSS | Architecture Lead |
| **DEC-22** | Desktop & Mobile Wrappers (Tauri/RN) | Platform | Blocked | Gate 0 | Medium | DEC-03, DEC-07 | Medium | Prototype | No iniciado | No creado | Diferir decisión formal a Milestone 2+ | Architecture Lead |

---

## 1. Critical Path

El "Critical Path" identifica las decisiones que bloquean el desarrollo arquitectónico primario y que, de invalidarse, obligarían a rehacer gran parte de la plataforma:

1. ~~**DEC-01 (Licensing Compatibility):**~~ (Resuelto: Proyecto Open Source GPLv3).
2. ~~**DEC-02 (PWA Storage & Eviction):**~~ (Resuelto: PWA Install + Cloud Sync Backup).
3. ~~**DEC-03 (Web Bluetooth & Fallbacks):**~~ (Resuelto: Capacitor Wrapper para iOS).

*Actualmente, el Critical Path de investigación inicial está completamente desbloqueado. Se puede proceder con la creación de RFCs y desarrollo base.*

---

## 2. Decisions Ready For RFC

Las siguientes decisiones tienen el `Research completado` (Gate 1), un `Confidence Level` alto o muy alto, y no requieren validación técnica adicional, por lo que están listas para ser convertidas en RFC de manera inmediata:

* **DEC-01:** Licensing Compatibility (GPLv3)
* **DEC-02:** PWA Storage & Eviction Policies
* **DEC-03:** Web Bluetooth & Mobile Fallbacks
* **DEC-07:** Frontend Framework & Architecture
* **DEC-08:** State Management
* **DEC-10:** Rendering Strategy (Pure Three.js)
* **DEC-11:** Solver Engine & WASM (min2phase)
* **DEC-20:** Documentation Stack
* **DEC-21:** Open Source Readiness

### Decisions in RFC Review

* **DEC-04:** Monorepo Strategy (RFC-001)
* **DEC-05:** Package Manager (RFC-002)
* **DEC-06:** Repository Structure (RFC-003)
* **DEC-13:** Code Quality & Standards (RFC-004)
* **DEC-14:** Testing Stack (RFC-005)
* **DEC-15:** CI/CD & Publishing (RFC-006)

---

## 3. Decisions Requiring Validation

Estas decisiones son fundamentales pero carecen de evidencia empírica suficiente para convertirse en RFC. Requieren validación explícita para evitar deuda técnica:

* **Requieren Benchmark y/o Prototype:**
  * **DEC-09 (Offline Database):** Benchmark OPFS SQLite WASM contra Dexie.js para 10,000 solves y cálculos complejos.
  * **DEC-12 (Performance Strategies):** Medición de latencia de serialización en Web Workers.

* **Requieren Investigación o Decisión de Producto/Legal:**
  * **DEC-16 (Plugin System), DEC-17 (Security), DEC-19 (Accessibility):** Investigación arquitectónica.
  * **DEC-18 (Cloud Sync):** Decisión humana de producto/hosting.

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
* **Decision Maturity (RFCs/ADRs): 0%**
  * *Justificación*: No existe ningún RFC ni ADR formalmente redactado ni aprobado. Todo el conocimiento arquitectónico se encuentra aún en estado de recomendación o hipótesis.
* **Architecture Maturity (General): 35%**
  * *Justificación*: La plataforma posee una visión técnica clara y un camino definido, pero debido a la falta de validación de los riesgos del Critical Path y la inexistencia de decisiones técnicas formalizadas en ADRs, la arquitectura aún no es apta para la implementación en fase de producción.
