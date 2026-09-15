# Cubalyze — Professional Speedcubing Platform

### Master Product, Architecture, and Design Document

**Version 1.0 — July 2026**
*Document Type: Product Requirements Document (PRD) + Software Architecture Document (SAD) + Game/Product Design Document (GDD)*

---

> [!IMPORTANT]
> **Responsibility Notice**: This document serves as the initial product vision and structural baseline. It does **not** track ongoing architectural decisions. All immutable architecture state is maintained in the [`02-architecture/`](../02-architecture/Architecture_Index.md) and [`03-adr/`](../03-adr/README.md) ecosystems.
> **Next Step**: For the execution and delivery plan, see the [Master Roadmap](../01-roadmap/Master_Roadmap.md).

## INDEX

- **PART 0 — Research and Ecosystem**
  - 0.1 Research methodology
  - 0.2 Current ecosystem map
  - 0.3 Relevant tools, engines, and libraries
  - 0.4 Smart cube protocols
  - 0.5 Regulatory framework (WCA)
- **PART 1 — Competitive Study (Benchmark)**
- **PART 2 — Product Philosophy and Principles**
- **PART 3 — Product Vision and Pillars**
- **PART 4 — Software Architecture**
  - 4.1 Overview
  - 4.2 Frontend
  - 4.3 Backend / Services
  - 4.4 Event system and synchronization
  - 4.5 Plugin system
  - 4.6 Offline-first and synchronization
  - 4.7 Security, versioning, and deployment
- **PART 5 — Smart Cubes Integration**
- **PART 6 — Real-Time 3D Cube Engine**
- **PART 7 — Solver Engine**
- **PART 8 — Real-Time Analysis System**
- **PART 9 — Training System**
- **PART 10 — Algorithm Database**
- **PART 11 — Tracking and Statistics System**
- **PART 12 — Timers System**
- **PART 13 — Artificial Intelligence System**
- **PART 14 — UX / UI**
- **PART 15 — Data Model**
- **PART 16 — Phased Roadmap**
- **PART 17 — References, Repositories, and Bibliography**

---

# PART 0 — RESEARCH AND ECOSYSTEM

## 0.1 Research methodology

Before proposing a single screen or database table, a sweep of the existing speedcubing software and hardware ecosystem was conducted: web timers, mobile apps, desktop apps, mathematical solvers, manufacturer Bluetooth hardware protocols, 3D visualization libraries, and the World Cube Association (WCA) official infrastructure. The goal of this phase is explicit: **not to reinvent what already exists and works well**, to identify which parts of the ecosystem are reusable (libraries, documented protocols, solver engines), and to detect the real product gaps that a new platform could fill with genuine competitive advantage.

## 0.2 Current ecosystem map

The ecosystem is organized into five layers that are rarely unified in a single product — and that fragmentation is, in itself, the greatest finding of the research:

| Layer                           | Function                                            | Representatives                                             |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| **Pure Timers**           | Timing, averages, sessions                          | csTimer, Twisty Timer, qqTimer, Stackmat                    |
| **Smart Cube Analytics**  | BLE move capture, phase splits                      | Cubeast, CubeDesk, GAN Cube Station / GAN iStation, acubemy |
| **Algorithm trainers**    | Spaced repetition of OLL/PLL/F2L                    | CubeSkills, JPerm.net, csTimer (partial)                    |
| **Algorithm databases**   | Queryable case repositories                         | AlgDB, SpeedCubeDB                                          |
| **Engine infrastructure** | Optimal solving, scramble generation, visualization | Kociemba/min2phase, TNoodle, cubing.js/Twizzle              |

No current platform coherently unifies the five layers with a modern, extensible, and AI-oriented architecture. That is the product opportunity.

## 0.3 Relevant tools, engines, and libraries

### 0.3.1 Timers and reference platforms

**csTimer** (`cs0x7f/cstimer`, GitHub, GPLv3 license) is the de facto reference software of the community. It is a professional timing program for Rubik's cube speedsolvers that offers a large number of scramble algorithms for all official WCA events, a variety of twisty puzzles, and training scrambles for specific sub-steps like F2L, OLL, PLL, and ZBLL, plus extensive statistical functions with unlimited sessions and session splitting/merging. Technically, there is a variant oriented exclusively to client deployment, without server services, deployable on any static hosting like GitHub Pages, with support for the GAN smart timer via its Bluetooth protocol. csTimer works as an installable Progressive Web App, automatically detects hardware failures in Bluetooth cubes, and exposes a reusable npm module (`cstimer_module`) for scramble generation. Its code, although powerful, is monolithic (a single giant JS file), which hinders extensibility — a direct architecture lesson for our design.

**Twisty Timer** (Android) is the lightweight mobile equivalent: offline stopwatch, local history, basic stats, no smart cube support or phase analysis. It serves as a minimalist UX reference but not an architecture one.

**Cubeast** is the historical reference in hardware analytics. It takes advantage of modern cubes' Bluetooth connectivity to offer new analysis tools, recording, storing, and analyzing all user solves to indicate strengths and weaknesses; it supports all existing 3x3 Bluetooth cube models, adding support for new models as they appear.

**CubeDesk** is the cross-platform desktop alternative. It is a desktop app for Mac, Windows, and Linux that replicates the csTimer experience but in native format, with a timer for 3x3, 2x2, 4x4, Skewb, and other events, and an integrated algorithm trainer.

**acubemy** represents the latest generation of AI-oriented products: it positions itself as a tool that finds hidden flaws in user solves and creates personalized training plans, seeking to train smarter, not just harder.

A 2026 analysis article summarizes the state of the art in real-time analytics well: platforms like Cubeast or GAN iStation decompose the solve into four phases (Cross, F2L, OLL, PLL); a common pattern is that a user believes their F2L is slow when in reality the real bottleneck is the recognition time between pairs, and the software solves this with specific look-ahead drills. It also notes the emergence of physical resolving robots (GAN Robot) used as an automated physical scrambling tool to practice specific cases.

### 0.3.2 Mathematical solver engines

The algorithmic heart of the sector converges on **Herbert Kociemba's two-phase algorithm**. There are multiple reference implementations that should be reused instead of re-implemented:

- **`hkociemba/RubiksCube-TwophaseSolver`** (Python) — solves the Rubik's cube in less than 19 moves on average. It is the reference implementation by the algorithm's author himself.
- **`cs0x7f/min2phase`** (Java, with JS port) — optimized implementation of Kociemba's two-phase algorithm, with documented performance metrics: after complete initialization, each solve takes around 2.3 ms on average, with guaranteed solutions of no more than 21 moves. This is the recommended option for use in the browser/Backend Service server due to its speed/table size balance.
- **`rokicki/twophase.js`** — JavaScript port of Kociemba's two-phase solver, derived from cube20.org, useful as an alternative or for cross-validation.
- **`torjusti/cube-solver`** (JS) — not only solves the full cube, it also allows solving sub-steps like the cross, Roux's first block, or ZZ's EOLine, and generating scrambles filtered by case (for example, generating a specific ZBLL scramble), which is directly applicable to the sub-step training engine described in Part 9. The project itself acknowledges that its full solver is slower than compiled versions of min2phase, so its ideal role is as an auxiliary sub-step engine, not the main engine.
- **`efrantar/rob-twophase`** — ultra-optimized C++ variant intended for physical resolution robots; interesting as a reference for performance limits, not as a direct dependency.

**Recommended architecture decision**: use **min2phase (WASM/JS port)** as the main solver embedded in the client (allowing 100% offline and zero network latency analysis), with a server fallback (Backend Service) for low-end devices or massive batch calculations (e.g., historical re-analysis of thousands of solves).

### 0.3.3 Official scramble generation — TNoodle

**TNoodle** is the only valid scramble source for official events and must be treated as a reference and interoperability component, not as a production dependency of the platform (our platform does not organize official competitions, but it must be *compatible* with the format). TNoodle is the software suite containing the official WCA scramble program, with the core scrambling written mainly in Kotlin, plus an interface and server to generate a standalone JAR. The official scramble program has been part of TNoodle since January 1, 2013, and all official WCA competitions must always use the current version of the program. For unofficial development, there is **`SpeedcuberOSS/tnoodle-cli`**, an unofficial and non-WCA affiliated command-line interface that reuses the same core tnoodle-lib engine to generate competition-grade scrambles from any language via system calls — useful in our platform's training scramble generation pipeline, making it clear in the product that **they are not certified for official use**.

### 0.3.4 3D Visualization — cubing.js / Twizzle

**`cubing/cubing.js`** is by far the most solid base available for twisty puzzle rendering on the web and is the direct recommendation for the platform's 3D Cube module (Part 6). It is the library that powers Twizzle, the spiritual successor to alg.cubing.net, and exposes a ready-to-use web component loadable directly from CDN. Internally it depends on three.js and comlink (to move heavy calculations to web workers), and its reference application ecosystem includes a live reconstruction explorer, a Bluetooth connectivity module, a stickering editor, VR support, and even a pattern solver (Twizzle Pattern Searcher, proposed as a future TNoodle replacement). This last fact is relevant: the `cubing` ecosystem itself is evolving towards replacing TNoodle, a sign of where the sector's infrastructure is heading.

**License**: cubing.js uses GPLv3 in some branches — the exact license of the integrated version must be audited before closed commercial use; if incompatible, it is recommended to use pure three.js with a proprietary cube state engine (see Part 6).

### 0.3.5 Web Bluetooth and smart cube protocols

Hardware connectivity is by far the area of greatest technical complexity and the largest possible competitive moat for the platform. It is detailed in Part 0.4 and Part 5.

## 0.4 Smart Cubes Protocols

### 0.4.1 GAN — the best documented manufacturer

The GAN protocol is by far the best documented by the open source community thanks to "clean-room" reverse engineering performed by several independent developers.

- **`afedotov/gan-web-bluetooth`** — library to interact with GAN Smart Timers and GAN Smart Cubes using the Web Bluetooth API, with an event-based and RxJS API: given that the nature of the timer and GAN smart cubes is event-oriented, the library depends on RxJS and exposes Observables to subscribe to. A critical technical detail documented by this library and which **must be incorporated into our timing engine** is clock drift correction: the internal clock of most GAN smart cubes is not perfectly calibrated and usually introduces noticeable time drift compared to the host device's clock, so the best practice is to record timestamps of each move with both clocks (host and cube) during the solve and apply a linear regression algorithm to adjust the cube values and obtain a correctly measured elapsed time — a technique invented and first implemented by Chen Shuang (author of csTimer).
- The demo repository itself, **`afedotov/gan-cube-sample`**, demonstrates connectivity with GAN cubes using Gen2, Gen3, and Gen4 protocol versions, including correct handling of time measurement and gyroscope events.
- **`cubing/cubing.js`** implements its own GAN decoder independently, explicitly labeled in the code as "Clean-room reverse-engineered", with a state packet decryption routine that uses block AES on data received per BLE characteristic.
- There are native implementations for other platforms, like **`shanedirksen/gan-cube-windows-app`**, a Windows app (Tauri + Rust) that supports Bluetooth connectivity with multiple GAN models (356i, 356i3, 11M Pro, 12M, 13M, etc.) showing real-time cube state data, explicitly built on `gan-web-bluetooth` as the base protocol library.
- The community confirms that the main challenge is not the BLE connection itself but the payload decryption: in the SpeedSolving forum a developer documents that after connecting with a GAN 356i Carry they are able to receive notifications after each move (20-byte packets per cube state), but cannot decode them because the protocol uses a different encryption layer than other smart cubes — confirming that csTimer and the aforementioned libraries are, today, the most reliable sources of the real decryption algorithm.

**Architecture decision**: adopt `gan-web-bluetooth` (or an actively maintained fork) as the base of the GAN adapter, wrapped in the hardware abstraction layer described in Part 5, instead of re-implementing decryption from scratch.

### 0.4.2 Other manufacturers (MoYu, QiYi, Giiker)

Research confirms that there is no unified protocol among manufacturers — each uses its own BLE packet format, in some cases encrypted and in others not. csTimer is today the software that de facto maintains the largest number of decoders per manufacturer integrated into a single codebase, making it the mandatory reverse engineering reference to expand the platform's support beyond GAN. The recommended strategy (see Part 5) is a **Hardware Abstraction Layer (HAL)** with plugin adapters per manufacturer, so adding a new cube (MoYu, QiYi, Giiker, or future models) is an isolated task and not a cross-cutting change to the product core.

## 0.5 Regulatory and interoperability framework — WCA

The current official scrambles program is TNoodle-WCA, which generates high-quality scramble sequences for all events of a competition at once; every official competition must always use a current version of the official scramble program, and delegates must save and encrypt all generated sequences with a password unrelated to the competition or personal data. This has a direct product implication: **our platform must never present itself as a source of "official" competition scrambles**, and must make this explicit in the UI and API documentation (just as `tnoodle-cli` honestly does in its own disclaimer). It can, however, offer "competition-grade" scramble generation for training, using the same underlying mathematical engine (min2phase / TNoodle-lib) without claiming official certification.

---

# PART 1 — COMPETITIVE STUDY (BENCHMARK)

| Product                               | Strengths                                                                         | Weaknesses                                                                      | Smart Cube                     | Analysis                 | Training                 | Technical Scalability     |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ | ------------------------ | ------------------------ | ------------------------- |
| **csTimer**                     | Most complete scrambles engine; huge community; free; offline PWA                 | Outdated UI; monolithic code difficult to extend; no AI; limited phase analysis | Yes (partial, multiple makers) | Basic                    | Basic case trainer       | Low (legacy architecture) |
| **Twisty Timer**                | Extreme simplicity; lightweight; full offline                                     | No smart cube; no analysis; no structured training                              | No                             | No                       | No                       | Low (closed app, no API)  |
| **Cubeast**                     | Pioneer in hardware analytics; good phase splits UX                               | Closed ecosystem; limited maker coverage; no modern AI engine                   | Yes                            | Medium-high              | Medium                   | Medium                    |
| **CubeDesk**                    | Native cross-platform; polished UX; integrated algorithm trainer                  | Smaller community; limited advanced analysis features                           | Partial                        | Medium                   | Medium                   | Medium                    |
| **GAN Cube Station / iStation** | Seamless integration with proprietary hardware; real-time phase splits            | Total vendor lock-in (GAN cubes only); closed ecosystem                         | Yes (GAN only)                 | High (its hardware only) | Medium                   | Low (single-maker)        |
| **acubemy**                     | Explicit focus on AI and personalized training plans; detection of "hidden flaws" | Young product, small community, limited event coverage                          | Yes                            | High                     | High (AI-oriented)       | Unknown (new product)     |
| **AlgDB / SpeedCubeDB**         | Comprehensive queryable algorithm databases                                       | No timer, no tracking, no integration with real solves                          | No                             | No                       | Passive query            | Medium                    |
| **CubeSkills / JPerm**          | Extremely high-quality educational content (video, theory)                        | Not a software platform; no automatic tracking                                  | No                             | No                       | Content, not interactive | N/A                       |

### What Cubalyze would do better than all of them

1. **Real unification of the five layers** (timer, smart cube, analysis, training, algorithm database) in a single coherent data architecture, instead of isolated tools that the user has to combine manually.
2. **Manufacturer independence** through a plugin-based hardware HAL (no current competitor offers this openly and extensibly).
3. **Explainable real-time analysis**, not just statistical: it is not enough to say "your F2L is slow", you have to say *why* (recognition, execution, rotations, pauses) — directly inspired by the diagnostic pattern already validated by Cubeast/GAN iStation but taken to the individual move level.
4. **Modular and explainable AI**, not a black box: every recommendation must be traceable to the user's own concrete data.
5. **Genuine offline-first** with subsequent synchronization, instead of depending on a constant connection.
6. **Plugin-based architecture from day one**, avoiding the structural problem that limits csTimer today (powerful but monolithic and hard-to-extend engine).

---

# PART 2 — PRODUCT PHILOSOPHY AND PRINCIPLES

1. **Radical modularity.** Every capability (solver, hardware HAL, analysis engine, AI engine, training engine) is a module with an explicit interface contract, independently replaceable.
2. **Plugin-first.** New cube manufacturers, new solving methods (CFOP, Roux, ZZ, Petrus, LBL, and future ones), new training types, and new data sources are added as plugins, not as patches to the core.
3. **Offline-first.** The stopwatch, basic analysis, and training must work without a connection; the cloud synchronizes, it never blocks.
4. **No dependence on a single hardware manufacturer.** GAN is the first and best supported (Part 5), but the architecture must treat it as "the first adapter", not as a structural requirement.
5. **Scalability to millions of solves per user and per platform.** Data model decisions (Part 15) assume very high write volumes from the design phase (a solve generates dozens of move events).
6. **Zero technical debt by default.** Versioned API contracts, explicit schema migrations, regression tests in the solving core (the solver must be mathematically verifiable).
7. **Explainability over "magic".** Everything the AI or real-time analyzer suggests must be traceable to concrete solve data, not a black box.

---

# PART 3 — PRODUCT VISION AND PILLARS

Cubalyze is intended as the reference software layer for serious speedcubing: the place where a speedcuber connects their smart cube, trains, analyzes each solve move by move, manages their own algorithm database, tracks their long-term progress, and receives AI-generated training recommendations based on their own data — all without being tied to a single hardware manufacturer or a single solving method.

**Product Pillars:**

- 🎯 **Training** — deliberate practice systems by sub-step, with spaced repetition.
- 📊 **Analysis** — decomposition of each solve into phases, moves, pauses, and efficiency.
- 📈 **Tracking** — histories, moving averages, progress calendar, streaks.
- 🤖 **AI** — error explanation, exercise generation, personalized recommendations.
- 🔌 **Smart cubes** — multi-manufacturer integration via plugin-based HAL.
- 🧊 **3D Visualization** — exact and navigable playback of any solve.
- 📚 **Learning** — comprehensive algorithm library, filterable, with proprietary progress.
- 🚀 **Progression** — goals, milestones, comparisons with past versions of oneself.
- 👥 **Community** — comparisons, challenges, sharing reconstructions.
- 🏗️ **Scalable architecture** — designed from the first commit for millions of solves.

---

# PART 4 — SOFTWARE ARCHITECTURE

## 4.1 Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENTS (Frontend)                           │
│   Web App (PWA)  |  Mobile App (Native Multiplatform) |  Desktop   │
│                                                                        │
│   ┌────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐  │
│   │ Timer Core │ │ Cube3D Engine │ │ Analysis UI   │ │ Trainer UI │  │
│   └────────────┘ └───────────────┘ └───────────────┘ └────────────┘  │
│               │              │               │              │        │
│   ┌───────────┴──────────────┴───────────────┴──────────────┴────┐   │
│   │        Local State Layer (offline-first: Local Data Store)   │   │
│   └───────────────┬─────────────────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────────────────┘
                     │  Sync Engine (event-based, conflict resolution)
┌────────────────────┴──────────────────────────────────────────────────┐
│                         BACKEND (API Gateway)                         │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐  │
│   │  Auth &   │ │  Solve    │ │ Algorithm │ │ Training  │ │   AI   │  │
│   │  Profile  │ │  Ingest   │ │ Database  │ │  Engine   │ │ Service│  │
│   │  Service  │ │  Service  │ │ Service   │ │  Service  │ │        │  │
│   └───────────┘ └───────────┘ └───────────┘ └───────────┘ └────────┘  │
│         │              │              │             │           │     │
│   ┌─────┴──────────────┴──────────────┴─────────────┴───────────┴─┐   │
│   │                     Event Bus (async, pub/sub)                │   │
│   └─────┬─────────────────────────────────────────────────────────┘   │
│         │                                                             │
│   ┌─────┴──────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────┐   │
│   │ Relational DB │  │ Time-series  │  │ Object Storage│  │  Cache   │   │
│   │(relational)│  │ DB (events)  │  │(reconstruct.) │  │ (Redis)  │   │
│   └────────────┘  └──────────────┘  └───────────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Frontend

The frontend is designed **local-first**: all timing logic, cube event decoding, and basic analysis runs on the client (browser or native app), without relying on network round-trips. This is indispensable because remote server latency is incompatible with the millisecond precision required for speedcubing timing.

- **Web**: Component-based SPA, with Web Bluetooth as the hardware access layer (Chrome/Edge/Opera; Safari and iOS require native app fallback due to lack of Web Bluetooth support).
- **Mobile**: Native app (Native Multiplatform Framework) using native Bluetooth LE, essential for iOS.
- **Desktop**: Packaged type Tauri/Electron reusing the same web core, with more stable native BLE access than in browser (pattern already validated by projects like `gan-cube-windows-app`, built in Tauri + Rust on the same GAN protocol library).
- **Cube3D Engine**: 3D rendering engine (Part 6), isolated as an independent reusable module in web, desktop, and potentially video overlays.

## 4.3 Backend / Services

Lightweight microservices architecture (or "modular monolith" in early stages, with service boundaries already defined to facilitate future extraction):

| Service                      | Responsibility                                                           |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Auth & Profile**     | Identity, profiles, preferences, declared solving methods                |
| **Solve Ingest**       | Reception, validation, and storage of solves (timing + move stream)      |
| **Algorithm Database** | CRUD and querying of the algorithm library (Part 10)                     |
| **Training Engine**    | Spaced repetition logic, generation of training sessions                 |
| **Analysis Engine**    | Efficiency metrics calculation, phase detection, comparison with optimal |
| **AI Service**         | Orchestration of AI models (Part 13), explanations, recommendations      |
| **Solver Service**     | Optimal/sub-optimal solving on demand (server fallback to client solver) |
| **Stats Service**      | Aggregations, moving averages, time series, export                       |
| **Community Service**  | Comparisons, challenges, optional public sharing                         |

## 4.4 Event system and synchronization

Each solve is modeled as a sequence of **immutable events** (cube move, timestamp, angle/face, optionally gyroscope data) instead of a single monolithic record. This allows:

- Exact playback in the 3D Cube (Part 6).
- Retroactive re-analysis when the analysis engine improves (raw events do not change; only derived metrics are recalculated).
- Synchronization based on *append-only log* with trivial conflict resolution (events are never edited, only appended), avoiding classic mutable state sync problems.

## 4.5 Plugin system

Three first-class extension surfaces, defined from day one:

1. **Hardware Adapters** (Part 5) — one plugin per smart cube manufacturer/protocol.
2. **Solver Methods** — one plugin per solving method (CFOP, Roux, ZZ, Petrus, LBL, and future methods), each declaring its own phases, its own cases, and its own recognition logic.
3. **Training Modules** — one plugin per trainer type (Cross, F2L, OLL, PLL, COLL, WV, VLS, ZBLL, LSLL, EO, etc.), each consuming the same Algorithm Database but with its own practice UI.

Each plugin registers against a stable versioned interface contract (semver), so core updates do not break existing plugins except for explicit major version changes.

## 4.6 Offline-first and synchronization

- **Client**: Local Data Store as local source of truth.
- **Sync Queue**: offline-generated events are queued and sent as soon as there is connectivity, with idempotent ID deduplication.
- **Conflict resolution**: given the append-only model (4.4), real conflicts are minimal; for mutable entities (profile, training config), *last-write-wins* is applied with vector versioning and user notification in cases of genuine conflict (simultaneous editing on two devices).

## 4.7 Security, versioning, and deployment

- Explicitly versioned API (`/v1`, `/v2`) with documented deprecation policy.
- Managed and reversible database migrations (never destructive changes without data migration).
- Encryption in transit (TLS) and at rest for profile data; cube move events, not being sensitive personal data, can be stored with more flexible retention policies but always with total export/deletion option (GDPR-like compliance).
- CI/CD with mandatory test suite on the Solver Service (mathematical verification: any generated scramble must be solvable in ≤ 20 HTM moves, known God's limit for the 3x3 cube).

---

# PART 5 — SMART CUBES INTEGRATION

## 5.1 Hardware Abstraction Layer (HAL)

The HAL exposes a single, manufacturer-independent interface to the rest of the platform:

```typescript
interface SmartCubeAdapter {
  readonly vendor: string;              // "GAN" | "MoYu" | "QiYi" | "Giiker" | ...
  readonly supportedModels: string[];
  connect(): Promise<SmartCubeConnection>;
  disconnect(): Promise<void>;
}

interface SmartCubeConnection {
  readonly deviceId: string;
  moves$: Observable<CubeMoveEvent>;     // decoded moves stream
  state$: Observable<CubeFaceletState>;  // reconstructed facelet state
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
  getRecordedTimes?(): Promise<RecordedTime[]>;
}

interface CubeMoveEvent {
  face: Move;              // U, U', U2, R, R', ... in standard notation
  cubeTimestamp: number;   // cube's internal clock
  hostTimestamp: number;   // host device's clock
}
```

Each manufacturer implements `SmartCubeAdapter` as an isolated plugin. The **GAN adapter** (first-class citizen of the system, given it's the best documented in the ecosystem — see Part 0.4.1) is built by reusing the decryption and protocol logic already validated by `gan-web-bluetooth`, including the linear regression clock adjustment technique described in 0.4.1, which is incorporated as a shared HAL utility (`cubeTimestampLinearFit()`), available for all adapters, not just GAN.

## 5.2 Clock drift correction (shared between adapters)

Every hardware adapter must pass its raw timestamps through the clock adjustment module before delivering them to the rest of the system, replicating the pioneering approach of csTimer: record host and cube timestamps for each event, and apply linear regression to obtain a correctly measured elapsed time, preventing small deviations in the cube's internal clock from accumulating in long sessions.

## 5.3 Adapters Roadmap

| Priority | Manufacturer             | Public documentation state                                           | Strategy                                     |
| -------- | ------------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| P0       | GAN (Gen2/3/4, incl. i3) | Excellent (multiple open source implementations)                     | Adapt`gan-web-bluetooth`                   |
| P1       | MoYu                     | Partial (mostly documented inside csTimer code)                      | Reverse engineering assisted by csTimer code |
| P1       | QiYi                     | Partial                                                              | Reverse engineering assisted by csTimer code |
| P2       | Giiker                   | Old protocol, unencrypted, already documented by community years ago | Direct adapter, low complexity               |
| P3       | Future manufacturers     | N/A                                                                  | Via public plugin SDK for the community      |

## 5.4 Public adapters SDK

In the medium term, it is recommended to publish the `SmartCubeAdapter` contract as a public SDK, allowing the community itself (as already happens informally around csTimer) to contribute adapters for new manufacturers without relying on the core team — replicating at the product level the open ecosystem dynamic that made csTimer the de facto standard.

---

# PART 6 — REAL-TIME 3D CUBE ENGINE

## 6.1 Technological base

**three.js** is recommended as the underlying 3D rendering engine, being the base already validated by both `cubing.js`/Twizzle and the general WebGL visualization ecosystem itself. There are two paths:

- **Option A (fast integration)**: directly use the `<twisty-player>` component from cubing.js via CDN for standard use cases (alg playback, scramble visualization), verifying the exact license before any closed commercial use.
- **Option B (total control)**: build a custom cube state engine on pure three.js, with a proprietary internal facelets/cubies model, to have total control over styles, custom stickering, analysis animations (piece highlighting, "optimal cross" overlays, etc.) that exceed what a generic component allows.

**Recommendation**: Option B for the product core (total control needed for the visual analysis functions described in Part 8), reusing state representation concepts already validated by cubing.js (standard "facelet cube" format like Kociemba) for maximum data interoperability.

## 6.2 Required features

- **Real-time mirroring** of the physical state of the connected smart cube (rotations, orientation, scramble, solve) — fed directly by the HAL's `moves$` stream (Part 5).
- **Playback of any recorded solve**, with:
  - Free camera control (rotation, zoom).
  - Speed control (0.25x–4x).
  - Timeline scrubbing.
  - Step-by-step mode (frame per move).
  - Side-by-side comparison of two solutions (user's vs. optimal, or two different attempts).
- **Analysis overlays** (Part 8): target cross piece highlight, suggested next F2L pair highlight, recognized OLL/PLL case indicator.
- **Visual scramble mode**: rendering the scramble before starting, synchronized with the actual physical state of the cube after applying it.

## 6.3 Performance

The engine must run in an independent Web Worker from the main UI thread to prevent blocking during long training sessions, following the pattern already adopted by cubing.js (use of `comlink` to move heavy computation off the main thread).

---

# PART 7 — SOLVER ENGINE

## 7.1 Mathematical core

- **Main Solver**: **Fast Two-Phase Solver Engine**, embedded in the client, with progressive table initialization (same as the documented behavior of min2phase itself: first solves are slower while tables are generated, then solves in a few milliseconds).
- **Server fallback**: same engine executed in Backend Service for low-end devices, massive batch re-analysis, and large-scale training scramble generation.
- **Scramble generation**: custom adapter inspired by `tnoodle-cli`, making it explicit in the UI that **they are not certified official scrambles**, only "competition-grade" for training.

## 7.2 Multi-method support

The Solver Engine does not impose a single solving method; it exposes a **"method plugin"** interface:

```typescript
interface SolveMethod {
  readonly id: "CFOP" | "Roux" | "ZZ" | "Petrus" | "LBL" | string;
  readonly phases: MethodPhase[];         // e.g., CFOP: Cross, F2L, OLL, PLL
  detectPhaseBoundary(state, moveHistory): PhaseTransition | null;
  suggestOptimalStep(state, phase): Suggestion;
}
```

- **CFOP**: Cross → F2L (x4) → OLL → PLL phases.
- **Roux**: First Block → Second Block → CMLL → LSE phases.
- **ZZ**: EOLine → F2L → LL (ZBLL/OCLL+PLL/COLL+EPLL depending on variant) phases.
- **Petrus**: 2x2x2 block → 2x2x3 block → expansion → corner orientation → final permutation.
- **LBL** (beginner): layer by layer, for the initial learning module.
- **Extensibility**: any future method (or advanced users' custom variants) is added by implementing the same contract, without touching the core.

## 7.3 Reference optimal solution calculation

For each captured solve, the system calculates in the background (non-blocking) the theoretical optimal solution for the corresponding scramble via min2phase, used as a comparison baseline in the analysis engine (Part 8) — never shown as a prescriptive "what you should have done", but as contextual reference, since the shortest solution in moves is not always the fastest in real time (fingertricks, flow, regrips).

---

# PART 8 — REAL-TIME ANALYSIS SYSTEM

This is, along with hardware integration, the strongest differential pillar of the platform against the competition.

## 8.1 Analysis pipeline

```
Moves Stream (HAL) 
        │
        ▼
Facelet state reconstruction (incremental)
        │
        ▼
Phase detection (active Solve Method plugin)
        │
        ├──► Cross Module:     detection, optimal cross, X-Cross, inspection efficiency
        ├──► F2L Module:       pair recognition, alternatives, unnecessary rotations
        ├──► LL Module:        OLL/PLL recognition, used vs. recommended algorithm
        └──► Fluency Module:   TPS, pauses, regrips, lookahead, total rotations
        │
        ▼
Derived metrics + comparison with optimal (Solver Engine)
        │
        ▼
Storage of analysis results (linked to the solve, analysis engine version)
```

## 8.2 Capabilities per phase

**Inspection / Cross**

- Automatic detection of the cross chosen by the user.
- Calculation of the optimal cross (and X-Cross when applicable) for that specific scramble.
- Inspection efficiency calculation (time used vs. quality of the resulting plan).

**F2L**

- Automatic detection of the case for each pair.
- Suggestion for the best next pair based on cube state (not just the most "obvious" one).
- Presentation of rotation-less alternative solutions when the used solution required one.
- Detection of unnecessary rotations and their actual cost in moves/time.

**OLL / PLL**

- Automatic case recognition from facelet state.
- Comparison between the algorithm actually executed (reconstructed from the move stream) and the recommended algorithm for that case according to the Algorithm Database (Part 10).
- Calculation of extra moves compared to the shortest known canonical algorithm.

**Fluency and execution**

- Global and per-phase TPS (turns per second).
- Detection of pauses (inactivity gaps between moves) and their location (during recognition? during lookahead?).
- Regrip counting (requires orientation/gyroscope data when hardware supports it).
- Cube rotation counting (and, when the method allows, suggestion of rotation-less equivalent solutions).
- Lookahead quality estimation: correlation between pauses and phase transitions.

## 8.3 Training mode vs. Free solve mode

Everything above must work identically in:

- **Solve Mode** (standard timing session, with random scramble).
- **Training Mode** (Part 9), where analysis focuses on the specific sub-step being practiced (e.g., solely on the F2L phase when training F2L Trainer).

## 8.4 Analysis engine versioning

Given that the analysis engine will improve over time, each analysis result stores the version of the engine that generated it, allowing on-demand retroactive re-analysis without losing history or requiring automatic reprocessing of everything (controlled computational cost, Part 4.4).

---

# PART 9 — TRAINING SYSTEM

## 9.1 Trainer architecture (Training Modules)

Each trainer is a plugin (Part 4.5) that consumes the Algorithm Database (Part 10) and the Solver Engine (Part 7) to generate directed practice sessions:

| Module                          | Scope                                                                  |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Cross Trainer**         | Cross recognition and execution practice                               |
| **XCross Trainer**        | Extended cross (cross + first pair)                                    |
| **F2L Trainer**           | The 41 standard F2L cases, filterable by pair/angle                    |
| **OLL Trainer**           | 57 OLL cases                                                           |
| **PLL Trainer**           | 21 PLL cases                                                           |
| **COLL**                  | Combined corner orientation + permutation (for advanced CFOP methods)  |
| **WV (Winter Variation)** | Combined last F2L pair + OLL cases                                     |
| **VLS (Valk Last Slot)**  | Extension of WV to more cases                                          |
| **ZBLL**                  | Last two layers oriented, full permutation                             |
| **LSLL**                  | Entire last layer after EO (used in ZZ)                                |
| **EO Trainer**            | Edge Orientation (ZZ)                                                  |
| **Roux Trainer**          | CMLL, LSE, blocks                                                      |
| **ZZ Trainer**            | ZZ's EOLine, F2L, LL                                                   |
| **Petrus Trainer**        | 2x2x2/2x2x3 blocks, expansion                                          |
| **Custom Cases**          | The user can create their own practice sets (own algorithms, variants) |

## 9.2 Algorithm progress model

Each algorithm maintains its own state per user:

- **Favorite / Pending / Mastered** (manual classification or automatic by performance threshold).
- **Spaced repetition**: SM-2/Leitner type algorithm adapted to speedcubing — cases with worse recent performance (slower, more recognition errors) appear more frequently; "mastered" ones are progressively spaced out.
- **Algorithm statistics**: average execution time, average recognition time, error rate, historical evolution.
- **Videos and animations**: each case links to its representation in the 3D Cube (Part 6) and optionally to an external reference video.
- **Comparisons**: user's performance on a case vs. their own historical average, and (optionally, anonymized) vs. the community.

## 9.3 Training session generation

The **Training Engine** (backend service, Part 4.3) combines the spaced repetition state with the Solver Engine to generate sessions of scrambles that force the specific case to be practiced to appear (reusing the pattern already validated by `torjusti/cube-solver`, which explicitly supports scrambles filtered by case, for example for ZBLL).

---

# PART 10 — ALGORITHM DATABASE

## 10.1 Conceptual schema per algorithm

Each entry in the Algorithm Database stores:

- Unique identifier and case name (standard nomenclature by system: OLL-27, T-perm PLL, F2L-13, etc.).
- Image/visual representation (renderable directly via Cube3D Engine, not just static image).
- Notation of the algorithm(s): primary and alternatives.
- Move metrics: HTM, STM, QTM.
- Known variants (alternative fingertricks, grip orientations).
- Estimated difficulty (execution and recognition, separately).
- Popularity (aggregated use, anonymized, among platform users).
- Reference speed (typical TPS observed for that algorithm among advanced users).
- Source/author and attribution notes.
- Tags (method, subgroup, family of related cases).
- Links to external reference video.
- Current user's learning state and date of last practice (user↔algorithm relationship, not part of the algorithm itself).

## 10.2 Sources and compatibility

The database is designed to be importable/exportable in formats compatible with industry reference databases (AlgDB, SpeedCubeDB), allowing users to migrate their existing data without friction and avoiding building the entire catalog from scratch — again, the principle of "not reinventing what already exists" applied to content, not just code.

## 10.3 Content governance

- Base catalog curated by the team (canonical, verified algorithms).
- Extension by the community (alternative algorithms, variants) with a verification/voting system before entering the platform's "official" catalog.
- Fully private user algorithms (custom sets) are never mixed with the public catalog unless explicitly published.

---

# PART 11 — TRACKING AND STATISTICS SYSTEM

## 11.1 Standard metrics

- Averages: Ao5, Ao12, Ao50, Ao100, Ao1000 (and configurable to generic Average of N).
- Standard deviation, consistency (coefficient of variation).
- Full histories, filterable by session, event, method, date range.
- Time evolution charts (trend, not just points).

## 11.2 Advanced metrics (differentials against competition)

- Global and per-phase TPS.
- Phase split: Cross / F2L / OLL / PLL (or the equivalent breakdown of the active method).
- Partial times within each phase (e.g., per F2L pair).
- Ranking of the user's own "slowest algorithms" and "slowest cases," generated automatically from the analysis history (Part 8), not manually entered.
- Frequent errors (wrong algorithm applied, pop, failed recognition) with semi-automatic classification.
- Progress per algorithm (linked directly to the state in Part 10.2).

## 11.3 Habit tracking and goals

- Activity calendar (heatmap like a "contribution graph").
- Daily/weekly practice streaks.
- User-defined goals (e.g., "sub-15s Ao12 before the end of the month"), with automatic tracking of progress toward the goal.

## 11.4 Export

Full export in open formats (CSV, JSON compatible with csTimer where reasonable) for total user data portability — consistent with the principle of "no dependence on a single manufacturer or provider" applied also to the user's own data.

---

# PART 12 — TIMERS SYSTEM

| Type                        | Description                                                         | Precision                                    | Offline |
| --------------------------- | ------------------------------------------------------------------- | -------------------------------------------- | ------- |
| **Manual**            | Spacebar / double Ctrl / touch, like csTimer                        | High (limited by human input)                | Yes     |
| **Smart Cube**        | Start/stop derived from the HAL's move stream (Part 5)              | Very high (with clock drift correction, 5.2) | Yes     |
| **Generic Bluetooth** | Dedicated BLE timers (e.g., GAN Smart Timer)                        | Very high                                    | Yes     |
| **Stackmat**          | Standard competition physical timer, via audio interface/adapter    | Very high (competition standard)             | Yes     |
| **Future expansions** | Any timing source that implements the HAL's`TimerSource` contract | —                                           | —      |

All timer types are normalized to a common `TimerSource` interface so that the rest of the system (analysis, tracking, training) is agnostic to the timing source used.

---

# PART 13 — ARTIFICIAL INTELLIGENCE SYSTEM

## 13.1 AI design principles

- **Modular**: the AI is a consumer service of the data already structured by the Analysis Engine (Part 8) and the Stats Service (Part 11.2-11.3), not a black box that reprocesses raw data on its own.
- **Explainable**: every recommendation must cite the specific metric/pattern that motivates it.
- **Opt-in and transparent**: the user can check at any time which data feeds each recommendation.

## 13.2 Capabilities

- **Solve analysis**: natural language summary of a solve or a session, directly supported by the metrics already calculated by the Analysis Engine.
- **Error explanation**: why a specific solve was slower than expected (long pause in OLL recognition, avoidable rotation, etc.), citing the exact moment in the move stream.
- **Exercise creation**: generation of training sessions directed at the detected weakness (delegating technical generation to the Training Engine, Part 9.3).
- **Algorithm recommendation**: suggestion of alternative algorithms for cases where the user consistently shows execution times above the reference average (Part 10.1).
- **Bad habit detection**: recurrent patterns (systematic regrips, repeated unnecessary rotations, suboptimal algorithms used consistently).
- **Training proposals**: adaptive weekly/monthly plan based on actual history (not generic).
- **Progress comparison**: evolution of the user themselves in comparable time windows.
- **Weak point identification**: cross-referencing phase + algorithm + consistency metrics to point out the real bottleneck, replicating and generalizing the pattern already validated by the competition (differentiating "slow F2L" from "slow recognition between pairs", as documented by the sector analysis itself).
- **Theory explanation**: conversational access to the theory behind each method/case, linked with the Algorithm Database.

---

# PART 14 — UX / UI

## 14.1 Main surfaces

- **Dashboard**: summary of recent progress, next recommended training session, streaks, active goals.
- **Training**: module selector (Part 9), active session, immediate results.
- **Analysis**: detailed view of a specific solve, with interactive 3D Cube, phase timeline, and metrics.
- **Library / Algorithms**: navigation of the Algorithm Database (Part 10), own learning state.
- **3D**: free viewer for solve playback and comparison.
- **Profile**: identity, declared methods, connected hardware.
- **Settings**: hardware, timer preferences, data privacy.
- **Comparisons**: user vs. their own history, and optionally vs. community (anonymized, opt-in).
- **Charts**: configurable time series (event, session, range, metric).
- **Widgets**: reusable components between Dashboard and Analysis (mini-charts, streak indicators, etc.).

## 14.2 Design principles

- Timing always accessible in one tap/key, friction-free — the clearest UX lesson from csTimer and Twisty Timer.
- Advanced analysis available but not intrusive by default (progressive: the new user sees the simple, the advanced user can dig deeper).
- Visual consistency between the 2D stats view and the 3D playback view (same face colors, same notation).

---

# PART 15 — DATA MODEL

## 15.1 Main entities (conceptual level)

```
User (1) ───< Profile
User (1) ───< HardwareDevice (N)          [linked cubes, by HAL adapter]
User (1) ───< Session (N)
Session (1) ───< Solve (N)
Solve (1) ───< MoveEvent (N)              [append-only, immutable]
Solve (1) ───< AnalysisResult (N)         [versioned by analysis engine]
User (1) ───< AlgorithmProgress (N) >─── Algorithm
Algorithm (N) >─── AlgorithmSet (N)       [OLL, PLL, F2L, ZBLL, etc.]
User (1) ───< TrainingSession (N)
TrainingSession (1) ───< TrainingAttempt (N)
User (1) ───< Goal (N)
```

## 15.2 Scalability considerations

- **MoveEvent** is by far the highest write volume table (each solve generates dozens of events). Storage in a time-series database or partitioning by user/date in the relational store is recommended, physically separated from low cardinality tables (Algorithm, AlgorithmSet).
- **Solve** and **AnalysisResult** are kept in the main relational store (Relational DB), with indexes by user, date, and event for dashboard/stats queries.
- **Full reconstructions** (entire move stream + metadata for 3D playback) can be stored in Object Storage in compressed format, referenced from `Solve`, avoiding bloating the relational DB with blobs.
- **Cache** (Redis) for expensive frequently used aggregations (dashboard moving averages).

## 15.3 Versioning and migrations

- Explicit and reversible migrations on every schema change.
- `AnalysisResult` versions the analysis engine that generated it (Part 8.4), allowing coexistence of results from different versions without breaking histories.
- `Algorithm` versions changes in notation/recommended algorithm, preserving the history of what was recommended at any given time (relevant for auditing AI decisions retroactively).

---

# PART 16 — IMPLEMENTATION ROADMAP

The implementation roadmap has been extracted from this document to maintain single responsibility and now resides in its own master document.

Please, refer to [Master_Roadmap.md](../01-roadmap/Master_Roadmap.md) to access:

- Incremental delivery strategy
- Dependency management
- Breakdown into Atomic Phases
- Exit criteria and deliverables
- Risk and technical debt management

The `Master_Roadmap.md` document is the single source of truth for planning and execution order of the Cubalyze project.

# PART 17 — REFERENCES, REPOSITORIES, AND BIBLIOGRAPHY

**Timers and platforms**

- csTimer — https://github.com/cs0x7f/cstimer
- Twisty Timer (Android)
- Cubeast — https://www.cubeast.com/
- CubeDesk — https://cubedesk.io
- acubemy — https://acubemy.com/
- GAN Cube Station / GAN iStation (proprietary GAN ecosystem)

**Solver engines**

- hkociemba/RubiksCube-TwophaseSolver — https://github.com/hkociemba/RubiksCube-TwophaseSolver
- cs0x7f/min2phase — https://github.com/cs0x7f/min2phase
- rokicki/twophase.js — https://github.com/rokicki/twophase.js
- torjusti/cube-solver — https://github.com/torjusti/cube-solver
- efrantar/rob-twophase — https://github.com/efrantar/rob-twophase
- Kociemba, H. — "The Two-Phase Algorithm" — https://kociemba.org/math/twophase.htm

**Official scrambles (WCA)**

- WCA Regulations — Scrambles — https://www.worldcubeassociation.org/regulations/scrambles/
- thewca/tnoodle — https://github.com/thewca/tnoodle
- thewca/tnoodle-lib — https://github.com/thewca/tnoodle-lib
- SpeedcuberOSS/tnoodle-cli — https://github.com/SpeedcuberOSS/tnoodle-cli

**3D Visualization**

- cubing/cubing.js (Twizzle) — https://github.com/cubing/cubing.js/
- Experiments and reference apps — https://experiments.cubing.net/cubing.js/
- [github.com/SebLague/Rubiks-Cube](https://github.com/SebLague/Rubiks-Cube)

**Smart cubes protocols**

- afedotov/gan-web-bluetooth — https://github.com/afedotov/gan-web-bluetooth
- afedotov/gan-cube-sample — https://github.com/afedotov/gan-cube-sample
- cubing/cubing.js — GAN decoder (`gan.ts`) — https://github.com/cubing/cubing.js/blob/main/src/cubing/bluetooth/smart-puzzle/gan.ts
- shanedirksen/gan-cube-windows-app — https://github.com/shanedirksen/gan-cube-windows-app
- GAN 356i reverse engineering community thread — SpeedSolving Puzzles Community

**Algorithm databases and educational content**

- AlgDB, SpeedCubeDB (queryable algorithm databases)
- CubeSkills, JPerm.net (reference educational content)

**License note**: several of the cited repositories (csTimer, some branches of cubing.js, tnoodle-lib) are licensed under GPLv3, which imposes open-source obligations on any derivative that incorporates them directly. Any direct code integration (not just protocol/format) must be legally audited before a closed-source commercial release; the safest alternative is to reimplement the protocol logic (already publicly documented) under a proprietary license, just as third parties like `gan-cube-windows-app` have already done.

---

*End of document. This document is intended as a living master documentation: each Roadmap Phase (Part 16) must generate its own detailed technical design documents (Technical Design Documents) that reference this document as the architectural source of truth.*
