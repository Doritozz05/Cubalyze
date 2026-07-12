# CubeForge: Initial Architecture Research Report

## Executive Summary
This report presents a comprehensive architectural study for the **CubeForge** project. Based on the product requirements—AI-first, offline-first, local-first, performance-critical, highly modular (plugin-first), open source, and built for long-term maintainability—this study analyzes the current industry ecosystem to determine the optimal technology stack.

Each decision optimizes for:
1. **Performance**: Handling high-frequency Bluetooth LE (BLE) streams, WebGL rendering, and WASM solvers.
2. **Maintainability & AI-friendliness**: Strict typing, modular boundaries, and deterministic codebases.
3. **Developer Experience (DX) & Open Source**: Low barrier to entry, fast CI/CD, and standardized governance.
4. **Future Scalability**: Seamless expansion to mobile, desktop, and a robust SDK ecosystem.

---

## 1. Monorepo Strategy
**Candidates**: Turborepo, Nx, Moonrepo, Rush

* **Turborepo**:
  * *Pros*: Extremely fast, zero-configuration caching, highly adopted in the React/Vite ecosystem, very low learning curve for open-source contributors.
  * *Cons*: Lacks native generators for complex polyglot setups compared to Nx.
* **Nx**:
  * *Pros*: Powerful graph analysis, excellent generators for React/React Native/Electron, strict boundary enforcement (great for AI).
  * *Cons*: Steeper learning curve, heavier configuration, can be intimidating for casual OSS contributors.
* **Moonrepo / Rush**:
  * *Pros*: Great for polyglot (Moon) or massive enterprise scale (Rush).
  * *Cons*: Overkill for this project; smaller community adoption.

**Final Recommendation: Turborepo**
* **Classification**: Strong recommendation
* **PRD Match**: Fully matches (Supports "Large monorepo", "Community contributions", "Modern CI/CD").
* **Justification**: For an open-source project, the barrier to entry must be low. Turborepo provides the speed of remote caching and concurrent execution without the heavyweight configuration of Nx.

## 2. Package Manager
**Candidates**: pnpm, npm, yarn, bun

* **pnpm**:
  * *Pros*: Strict dependency resolution (no ghost dependencies), incredibly fast, excellent monorepo workspace support, industry standard for modern OSS.
* **Bun**:
  * *Pros*: Blazing fast installation and execution.
  * *Cons*: Still maturing; occasional edge-case bugs with native modules (which might affect WASM or BLE build pipelines).
* **npm / yarn**:
  * *Pros*: Ubiquitous.
  * *Cons*: Slower, heavier `node_modules` footprint.

**Final Recommendation: pnpm**
* **Classification**: Strong recommendation
* **PRD Match**: Fully matches (Supports "Large monorepo", "Community contributions").
* **Justification**: `pnpm` enforces strict dependency boundaries, which prevents "works on my machine" bugs. It is the de-facto standard for Turborepo monorepos.

## 3. Frontend Framework & Architecture
**Candidates**: React, Vue, Solid, Svelte, Next.js, Vite, Astro
**Architectures**: SPA, PWA, SSR, SSG

* **Architecture Analysis**: CubeForge must be **Offline-first** and **Local-first**, interacting with Web Bluetooth. This completely eliminates SSR (Server-Side Rendering) frameworks like Next.js or Astro. The application must be a **Progressive Web App (PWA)** built as a **Single Page Application (SPA)**.
* **React**:
  * *Pros*: Unmatched ecosystem (React Three Fiber, standard UI libraries), massive OSS contributor pool.
* **Solid / Svelte**:
  * *Pros*: Better raw performance.
  * *Cons*: Smaller 3D and BLE ecosystem.
* **Vite**:
  * *Pros*: Instant HMR, native WASM and Web Worker support, optimized Rollup builds.

**Final Recommendation: React + Vite (SPA/PWA)**
* **Classification**: Product requirement (PWA/SPA is mandated by offline-first / Web Bluetooth needs), Strong recommendation for React+Vite.
* **PRD Match**: Fully matches (Supports "Offline-first", "Local-first", "Community contributions").
* **Justification**: React provides the massive ecosystem needed for 3D (`three.js`) and community adoption. Vite provides the tooling speed. A pure PWA ensures offline capabilities and direct access to browser hardware APIs (Web Bluetooth) without server round-trips.

## 4. Rendering Strategy (3D Cube)
**Candidates**: Pure Three.js, React Three Fiber (R3F), cubing.js

* **cubing.js**:
  * *Pros*: Ready out-of-the-box, understands cubing notation.
  * *Cons*: GPLv3 license implications, hard to heavily customize for proprietary AI analysis overlays.
* **React Three Fiber (R3F)**:
  * *Pros*: Declarative 3D, seamless React state integration.
  * *Cons*: Overhead when dealing with high-frequency updates (60fps Bluetooth streams).
* **Pure Three.js (wrapped in React)**:
  * *Pros*: Maximum performance, can be run in an `OffscreenCanvas` via Web Workers.

**Final Recommendation: Pure Three.js within a Web Worker (OffscreenCanvas)**
* **Classification**: Requires benchmarking
* **PRD Match**: Partially matches. (PRD mentions Three.js and cubing.js, but explicitly requires heavy custom analysis overlays which cubing.js might resist. Potential conflict with out-of-the-box cubing.js usage).
* **Justification**: Given the PRD requirement for performance and smooth mirroring of hardware cubes, rendering should be offloaded from the main thread. We can build a custom wrapper that consumes standard notation.

## 5. State Management
**Candidates**: Redux Toolkit, Zustand, Jotai, Valtio, Context

* **Redux Toolkit**: Too boilerplate-heavy; overkill.
* **React Context**: Causes unnecessary re-renders; fatal for high-frequency BLE updates.
* **Zustand**:
  * *Pros*: Extremely lightweight, unopinionated. Allows for **transient updates** (subscribing to state without triggering React re-renders).
* **Jotai / Signals**:
  * *Pros*: Atomic state, great for fine-grained reactivity.

**Final Recommendation: Zustand**
* **Classification**: Strong recommendation
* **PRD Match**: New architectural decision (Matches "High-frequency state updates").
* **Justification**: Zustand's ability to bind state directly to the 3D canvas or timer without triggering React component re-renders is critical for the 1ms precision timer and 60Hz BLE move streams.

## 6. Offline Database
**Candidates**: IndexedDB (raw), Dexie, RxDB, SQLite WASM

* **Dexie**:
  * *Pros*: Great wrapper around IndexedDB.
  * *Cons*: IndexedDB can be slow for complex relational queries (e.g., querying millions of solves by specific F2L cases).
* **SQLite WASM (with OPFS - Origin Private File System)**:
  * *Pros*: True relational database in the browser, insanely fast via OPFS, allows complex SQL querying for advanced statistics.
* **RxDB**:
  * *Pros*: Offline-first sync built-in.
  * *Cons*: Heavy, complex.

**Final Recommendation: SQLite WASM (via OPFS)**
* **Classification**: Requires real-world validation
* **PRD Match**: New architectural decision (Matches "Offline-first" and "Large monorepo/scalability").
* **Justification**: The PRD anticipates "millions of solves per user" and complex differential analysis. IndexedDB struggles with complex aggregations. SQLite WASM backed by OPFS provides native-like database performance in the browser.

## 7. Backend & Cloud Sync
**Candidates**: Supabase, Firebase, Custom PostgreSQL, PocketBase

* **Supabase**:
  * *Pros*: Open-source PostgreSQL, built-in Auth, Edge Functions, real-time subscriptions. Allows robust CRDT or timestamp-based conflict resolution.
* **Firebase**:
  * *Pros*: Easy offline sync.
  * *Cons*: Proprietary, NoSQL makes complex cubing statistics difficult.
* **PocketBase**:
  * *Pros*: Lightweight, easy to self-host.
  * *Cons*: Smaller ecosystem.

**Final Recommendation: Supabase**
* **Classification**: Human decision required (Self-hosted vs Managed Cloud?)
* **PRD Match**: New architectural decision.
* **Justification**: PostgreSQL is required for complex relational queries (users, solves, algorithm statistics). Supabase is open-source friendly, providing a fast path to cloud sync while remaining transparent.

## 8. Desktop & Mobile Wrappers
**Candidates**: Tauri, Electron, React Native, Capacitor

* **Electron**: Huge memory footprint; bloated.
* **Tauri**:
  * *Pros*: Rust-based, tiny footprint, fast execution. Superb OS-level Bluetooth LE support via Rust plugins (bypassing browser Web Bluetooth limits).
* **React Native**:
  * *Pros*: Native UI for iOS/Android.

**Final Recommendation: Tauri (Desktop) / React Native (Future Mobile)**
* **Classification**: Weak recommendation (Deferred to Milestone 2+).
* **PRD Match**: Partially matches (Supports "Future desktop support", "Future mobile support").
* **Justification**: Tauri allows us to reuse the exact React/Vite SPA while providing a Rust backend to interface directly with native Bluetooth hardware, ensuring a stable connection to Smart Cubes on Windows/Mac.

## 9. Testing Stack
**Candidates**: Vitest, Jest, Playwright, Cypress

**Final Recommendation: Vitest + Playwright + MSW**
* **Classification**: Strong recommendation
* **PRD Match**: Fully matches (Supports "Modern CI/CD", "Long-term maintainability").
* **Justification**: Vitest shares the Vite configuration, making it insanely fast for unit testing the Math Core and Solver Engine. Playwright is the modern standard for E2E testing.

## 10. CI/CD & Publishing
**Candidates**: GitHub Actions, Changesets, Release Please

**Final Recommendation: GitHub Actions + Changesets**
* **Classification**: Strong recommendation
* **PRD Match**: Fully matches (Supports "Modern CI/CD", "SDK publishing").
* **Justification**: GitHub Actions is the OSS standard. Changesets is perfect for monorepos, automating version bumps and SDK package publishing.

## 11. Code Quality & Standards
**Candidates**: Biome, ESLint, Prettier, Husky

**Final Recommendation: ESLint + Prettier + TypeScript Strict + Husky + Commitlint**
* **Classification**: Strong recommendation
* **PRD Match**: Fully matches (Supports "Long-term maintainability").
* **Justification**: While Biome is faster, ESLint's plugin ecosystem allows for custom rules (e.g., enforcing architectural boundaries) which are crucial for AI-assisted development. Strict TypeScript is non-negotiable.

## 12. Documentation Stack
**Candidates**: Storybook, TypeDoc, Docusaurus

**Final Recommendation: Storybook (UI) + Docusaurus (Public Docs) + TypeDoc (SDK)**
* **Classification**: Weak recommendation
* **PRD Match**: New architectural decision.
* **Justification**: Storybook allows isolated testing of UI components. Docusaurus handles public-facing documentation.

## 13. Repository Structure (Optimized for AI & Scale)
* `apps/` (web, desktop, docs)
* `packages/` (core-math, core-hal, core-analysis, engine-3d, database, ui)

**Classification**: Strong recommendation
**PRD Match**: Fully matches.

## 14. Performance Strategies
* **Web Workers**: Solver and Analysis Pipeline.
* **OffscreenCanvas**: 3D rendering.
* **WASM**: Compiled WASM for min2phase solver.

**Classification**: Requires benchmarking
**PRD Match**: Fully matches (Supports "WASM solver", "Performance critical").

## 15. Open Source Readiness
**Recommendations**: `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `SECURITY.md`, `SUPPORT.md`.
**Classification**: Strong recommendation
**PRD Match**: Fully matches.

---

## Decision Matrix

| Topic | Status | Next Step |
|-------|--------|-----------|
| Monorepo Tooling | Research completed | Create RFC |
| Package Manager | Research completed | Create RFC |
| Frontend Framework | Research completed | Create RFC |
| State Management | Research completed | Create RFC |
| 3D Rendering Engine | Needs benchmarking | Build minimal prototype (OffscreenCanvas vs Main Thread) |
| Offline Database | Requires real-world validation | Build minimal prototype (SQLite OPFS speed vs IndexedDB limits) |
| Backend & Sync | Human decision required | Define hosting strategy (Self-hosted vs Managed) |
| Desktop App Wrapper | Deferred | Revisit during Milestone 2 |
| Mobile App Wrapper | Deferred | Revisit during Milestone 3 |
| CI/CD & Publishing | Research completed | Create RFC |
| Open Source Governance | Research completed | Create RFC |

---

## Missing Research (Gaps Identified)

The architecture report is **NOT** entirely complete. The following critical areas lack sufficient research and must be investigated before related RFCs can be approved:

1. **Browser Compatibility & Web Bluetooth Limitations**: 
   - Web Bluetooth is NOT supported on iOS (Safari/Chrome). How will mobile web users connect to smart cubes before the native React Native app is built?
   - Windows Web Bluetooth can be unstable.
2. **OPFS (Origin Private File System) Support**:
   - OPFS support is relatively new. We need a fallback matrix if SQLite WASM OPFS is unavailable in certain environments.
3. **PWA Installability & Storage Limits**:
   - iOS Safari aggressively evicts IndexedDB/OPFS data if a PWA is not used frequently. We need to research exact storage limits and eviction policies for our offline database.
4. **Licensing Compatibility (GPLv3)**:
   - `cubing.js` and `min2phase` implementations often carry GPLv3 licenses. We need a strict legal audit to ensure this doesn't conflict with CubeForge's open-source license or future monetization/SDK plans.
5. **WASM Loading Strategy**:
   - How big is the SQLite WASM + min2phase WASM payload? Will it severely impact the initial load time of the SPA?
6. **Plugin System Architecture**:
   - How exactly are user-defined plugins (new methods, trainers) injected into a compiled React/Vite SPA safely? Is it via NPM packages or dynamic runtime injection?
7. **Accessibility (a11y) & Internationalization (i18n)**:
   - Not covered in the initial report. High-speed timers need specific a11y considerations.
8. **Security**:
   - Local-first architecture implies logic resides in the client. What are the security implications for leaderboard integrity?
