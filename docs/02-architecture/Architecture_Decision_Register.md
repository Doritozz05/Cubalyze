# Architecture Decision Register

**Propósito**: Este documento es el control central del proceso de decisiones arquitectónicas de CubeForge. No sustituye a los RFC (Request for Comments) ni a los ADR (Architecture Decision Records), sino que rastrea el ciclo de vida completo de cada decisión técnica, asegurando la trazabilidad desde la investigación hasta la actualización del *Architecture Overview*.

---

## Architecture Decision Tracker

| ID | Decision | Category | Current Status | Decision Gate | Confidence | Dependencies | Risk Level | Validation Required | RFC Status | ADR Status | Next Action | Owner |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **DEC-01** | Licensing Compatibility (GPLv3) | Legal | Blocked | Gate 0 | Low | Ninguna | Critical | Legal Review | No iniciado | No creado | Realizar auditoría legal de dependencias (cubing.js, min2phase) | Architecture Lead |
| **DEC-02** | PWA Storage & Eviction Policies | Platform | Prototype Required | Gate 1 | Low | Ninguna | Critical | Research, Prototype | No iniciado | No creado | Construir prototipo de persistencia en iOS y analizar límites | Architecture Lead |
| **DEC-03** | Web Bluetooth & Mobile Fallbacks | Platform | Prototype Required | Gate 1 | Medium | Ninguna | High | Prototype | No iniciado | No creado | Investigar y probar wrapper WebBLE/Capacitor para iOS | Architecture Lead |
| **DEC-04** | Monorepo Strategy (Turborepo) | Tooling | Ready For RFC | Gate 1 | Very High | Ninguna | Medium | None | No iniciado | No creado | Crear RFC para configuración del Monorepo | Architecture Lead |
| **DEC-05** | Package Manager (pnpm) | Tooling | Ready For RFC | Gate 1 | Very High | DEC-04 | Low | None | No iniciado | No creado | Crear RFC | Architecture Lead |
| **DEC-06** | Repository Structure | Tooling | Ready For RFC | Gate 1 | High | DEC-04, DEC-05 | Medium | None | No iniciado | No creado | Crear RFC para estructura base | Architecture Lead |
| **DEC-07** | Frontend Framework (React+Vite SPA) | Core App | Ready For RFC | Gate 1 | High | DEC-02, DEC-03 | High | None | No iniciado | No creado | Crear RFC de arquitectura frontend | Architecture Lead |
| **DEC-08** | State Management (Zustand) | Core App | Ready For RFC | Gate 1 | High | DEC-07 | High | None | No iniciado | No creado | Crear RFC de flujo de estado | Architecture Lead |
| **DEC-09** | Offline Database (SQLite WASM/OPFS) | Data | Prototype Required | Gate 1 | Medium | DEC-02 | High | Benchmark, Prototype | No iniciado | No creado | Benchmark de queries complejas vs IndexedDB | Architecture Lead |
| **DEC-10** | Rendering Strategy (OffscreenCanvas) | Graphics | Prototype Required | Gate 1 | Medium | DEC-01, DEC-08, DEC-11 | High | Benchmark, Prototype | No iniciado | No creado | Benchmark OffscreenCanvas vs React Three Fiber | Architecture Lead |
| **DEC-11** | WASM Loading Strategy | Core App | Prototype Required | Gate 1 | Medium | DEC-07, DEC-09 | Medium | Prototype | No iniciado | No creado | Medir impacto de payload SQLite + Solver WASM | Architecture Lead |
| **DEC-12** | Performance Strategies (Workers) | Core App | Prototype Required | Gate 1 | Medium | DEC-10, DEC-11 | Medium | Benchmark | No iniciado | No creado | Medir overhead de serialización main-thread a worker | Architecture Lead |
| **DEC-13** | Code Quality & Standards | Tooling | Ready For RFC | Gate 1 | Very High | DEC-06 | Low | None | No iniciado | No creado | Crear RFC para linters y pre-commits | Architecture Lead |
| **DEC-14** | Testing Stack (Vitest, Playwright) | Tooling | Ready For RFC | Gate 1 | High | DEC-05 | Medium | None | No iniciado | No creado | Crear RFC de Testing | Architecture Lead |
| **DEC-15** | CI/CD & Publishing (GitHub Actions) | Ops | Ready For RFC | Gate 1 | Very High | DEC-04, DEC-14 | Low | None | No iniciado | No creado | Crear RFC de workflows CI/CD | Architecture Lead |
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

1. **DEC-01 (Licensing Compatibility):** Bloquea a `DEC-10` (Rendering Strategy) y toda la validación del solver (WASM). Si no podemos usar `cubing.js` o `min2phase` por restricciones legales de GPLv3, necesitamos construir alternativas desde cero.
2. **DEC-02 (PWA Storage & Eviction):** Bloquea a `DEC-09` (Offline Database) y a la viabilidad misma de la aplicación Offline-First. Si iOS elimina los datos impredeciblemente, la arquitectura local-first no funciona sin un wrapper nativo temprano.
3. **DEC-03 (Web Bluetooth & Fallbacks):** Bloquea a `DEC-07` (Frontend Framework) y `DEC-22` (Mobile Wrappers). Si los usuarios de iOS no pueden conectar Smart Cubes mediante PWA, la estrategia de distribución se altera por completo.

---

## 2. Decisions Ready For RFC

Las siguientes decisiones tienen el `Research completado` (Gate 1), un `Confidence Level` alto o muy alto, y no requieren validación técnica adicional, por lo que están listas para ser convertidas en RFC de manera inmediata:

* **DEC-04:** Monorepo Strategy
* **DEC-05:** Package Manager
* **DEC-06:** Repository Structure
* **DEC-07:** Frontend Framework & Architecture
* **DEC-08:** State Management
* **DEC-13:** Code Quality & Standards
* **DEC-14:** Testing Stack
* **DEC-15:** CI/CD & Publishing
* **DEC-20:** Documentation Stack
* **DEC-21:** Open Source Readiness

---

## 3. Decisions Requiring Validation

Estas decisiones son fundamentales pero carecen de evidencia empírica suficiente para convertirse en RFC. Requieren validación explícita para evitar deuda técnica:

* **Requieren Benchmark y/o Prototype:**
  * **DEC-09 (Offline Database):** Benchmark OPFS SQLite WASM contra Dexie.js para 10,000 solves y cálculos complejos.
  * **DEC-10 (Rendering Strategy):** Benchmark de OffscreenCanvas puro vs React Three Fiber bajo carga de streams Bluetooth a 60Hz.
  * **DEC-11 (WASM Loading Strategy):** Medir el tamaño del payload inicial de WASM para evaluar el impacto en el arranque de la SPA.
  * **DEC-12 (Performance Strategies):** Medición de latencia de serialización en Web Workers.
  * **DEC-02 & DEC-03 (Platform):** Prototipos de viabilidad de persistencia PWA y conexión Bluetooth en iOS.

* **Requieren Investigación o Decisión de Producto/Legal:**
  * **DEC-01 (Licensing):** Revisión legal de licenciamiento.
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
   * *Acción*: No se pueden crear RFCs hasta que los bloqueos de **DEC-01**, **DEC-02**, **DEC-03** sean resueltos.
   * *Justificación*: Son bloqueadores en el camino crítico.
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
* **Research Maturity: 60%**
  * *Justificación*: Se han analizado en profundidad muchas opciones de stack, pero existen brechas críticas de investigación (GPLv3, soporte iOS PWA/Bluetooth, benchmarks OPFS) que aún no están resueltas.
* **Decision Maturity (RFCs/ADRs): 0%**
  * *Justificación*: No existe ningún RFC ni ADR formalmente redactado ni aprobado. Todo el conocimiento arquitectónico se encuentra aún en estado de recomendación o hipótesis.
* **Architecture Maturity (General): 35%**
  * *Justificación*: La plataforma posee una visión técnica clara y un camino definido, pero debido a la falta de validación de los riesgos del Critical Path y la inexistencia de decisiones técnicas formalizadas en ADRs, la arquitectura aún no es apta para la implementación en fase de producción.
