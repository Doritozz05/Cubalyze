# CubeForge Master Implementation Roadmap

> **This is the single source of truth for development planning.**
> It is an execution plan describing the order in which the entire product will be built, completely aligned with the Product Requirements Document (PRD).
> It defines WHAT must be completed, WHEN it should be completed, WHY it belongs in that phase, WHAT dependencies exist, WHAT prerequisites exist, and WHAT deliverables are expected.
> This document does NOT design architecture nor select technologies unless specified in the PRD.

---

## 1. Planning Philosophy

The roadmap is designed to prevent huge, monolithic implementation phases that carry excessive risk. Instead, large features are rigorously decomposed into **atomic phases** with single responsibilities.

Each phase is structured to maximize:
- Low technical risk
- Progressive architecture
- Minimal dependencies
- Iterative delivery
- Reusable infrastructure

Our approach follows a clear planning hierarchy:
**Vision $\rightarrow$ Milestones $\rightarrow$ Epics $\rightarrow$ Atomic Phases $\rightarrow$ Future Technical Design Documents $\rightarrow$ Implementation Tasks**

Every Atomic Phase naturally unlocks the next, explicitly avoiding circular dependencies.

---

## 2. Project Governance

The roadmap is governed by a strict lifecycle. Changes to the scope of an atomic phase are strongly discouraged once the phase has entered the Technical Design Document (TDD) stage. 
- **PRD Alignment**: The Product Requirements Document dictates the *Why* and *What*. 
- **Roadmap Alignment**: The Master Roadmap dictates the *When* and the *Sequence*.
- **TDD Alignment**: The Technical Design Documents dictate the *How*.

---

## 3. Dependency Strategy

Dependencies are modeled as a Directed Acyclic Graph (DAG). No phase may commence until its listed dependencies have achieved their specific Exit Criteria. When cross-functional features exist (e.g., UI for a hardware connection), the underlying infrastructure phase MUST precede the surface integration phase.

---

## 4. Incremental Delivery Strategy

CubeForge embraces iterative value delivery. Each phase results in a tangible artifact—whether it is a testable library, an internal API, a CLI tool, or a user-facing interface. We do not build massive 'ghost' systems that go untested for months. Every deliverable must be verifiable in isolation before being integrated into the whole.

---

## 5. Risk Management

We prioritize phases based on risk reduction. High-risk, highly uncertain systems (such as the Hardware Abstraction Layer for Smart Cubes and the Math Core for solver logic) are tackled early in foundational epics to surface unknown variables before they impact the user experience.

- **Dependency Risks**: Addressed by enforcing strict exit criteria.
- **Product Risks**: Addressed by the UX/UI validations described in the PRD.
- **Technical Uncertainty**: Addressed by front-loading complex algorithm and Bluetooth integrations.

---

## 6. Milestone Strategy

Milestones are collections of Epics that represent a major leap in product capability. They serve as strategic synchronization points for the team. 
- **Milestone 1: The Core Engine** (Foundations, Hardware Abstraction, 3D Rendering)
- **Milestone 2: The Logic Layer** (Solver Engine, Analysis Pipeline)
- **Milestone 3: The User Experience** (Training System, Statistics, Gamification)
- **Milestone 4: The Intelligence** (AI Integration, Advanced Tracking)

---

## 7. Technical Debt Strategy

Technical debt is permissible only when explicitly logged and scoped within a phase. 'Quick and dirty' implementations are heavily discouraged unless they serve to unlock a critical downstream dependency in an early alpha state. Any acquired debt MUST be scheduled for resolution in a subsequent, explicit 'Refactor/Polish' phase before a Milestone is declared complete.

---

## 8. Documentation Strategy

The Master Roadmap, PRD, and TDDs constitute our living documentation.
- The Roadmap is updated if the sequencing changes.
- The PRD is updated if the business requirements change.
- The TDDs are snapshot documents tied to specific Atomic Phases. Once implemented, the code becomes the ultimate source of truth for technical behavior.

---

## 9. Definition of Done (DoD)

An Atomic Phase is considered 'Done' when:
1. All Exit Criteria are explicitly met.
2. The deliverable is fully unit-tested (where applicable).
3. The deliverable is merged into the main development branch.
4. Any relevant TDDs have been fulfilled.
5. Future Preparation notes have been reviewed by the lead architect.

---

## 10. Phase Lifecycle

1. **Roadmap Phase Definition**: The phase is defined here.
2. **Phase Kickoff**: Stakeholders review the phase goals and dependencies.
3. **TDD Creation**: Engineering drafts the Technical Design Document detailing the 'How'.
4. **Implementation**: The engineering team executes the TDD.
5. **Quality Gate**: Code review, testing, and validation against Exit Criteria.
6. **Post-Phase Review**: Brief retrospective and formal sign-off.

---

## 11. Decision Making Process

Technical decisions are deferred to the TDD phase. The Roadmap does not enforce technology stacks unless explicitly mandated by the PRD. If a decision during TDD conflicts with the Roadmap's scope or timeline, an RFC (Request for Comments) must be issued to realign the Roadmap.

---

## 12. Change Management

Scope creep within an atomic phase is strictly prohibited. If an unforeseen requirement emerges, it must either be deferred to a new atomic phase or it must replace an existing scope item after a formal roadmap review.

---

## 13. Versioning Strategy

- **Internal APIs/Libraries**: Semantic Versioning (SemVer) strictly applied.
- **Data Models**: Additive changes whenever possible; explicit migration phases otherwise.
- **Product Releases**: Follow the Milestone strategy, with Alpha/Beta tagging for early access rings.

---

## 14. Validation Strategy

Validation is continuous. Core engines (Solver, Analysis) will be validated via headless test suites prior to UI integration. Smart Cube integrations will be validated with physical hardware test matrices before user-facing timers are built.

---

## 15. Quality Gates

Each phase transitions through quality gates:
- **Code Quality**: Linting, type-checking, and static analysis.
- **Performance**: Strict latency budgets (e.g., rendering the 3D cube at 60+ FPS, real-time analysis < 16ms).
- **Security**: Ensuring local-first data integrity and secure cloud sync.

---

## 16. Architecture Evolution

The architecture is progressive. We build the Monorepo structure first, followed by headless modules, followed by UI integration. We do not attempt to build full-stack vertical slices for complex systems (like the 3D engine) until their foundational modules are isolated and stable.

---

## 17. Feature Readiness

A feature is ready for the end-user only when its UI, underlying core logic, telemetry, and error handling are all complete. The Roadmap orchestrates this by separating logic phases from integration phases.

---

## 18. Release Strategy

CubeForge will employ ring-based deployments:
- **Ring 0 (Dev)**: Headless testing and local environments.
- **Ring 1 (Alpha)**: Internal testing of isolated phases.
- **Ring 2 (Beta)**: Opt-in power users testing integrated Milestones.
- **Ring 3 (Public)**: General availability of the Milestone.

---

## 19. Post-Phase Reviews

Upon the completion of a Milestone (or highly critical Epic), a review will be conducted to assess the accuracy of the TDDs, the accumulation of technical debt, and the validation of the original PRD assumptions.

---

## 20. Relationship with Technical Design Documents (TDD)

Every atomic phase in this document will eventually generate its own TDD. The pipeline is:


oadmap.md $\rightarrow$ Atomic Phase $\rightarrow$ Technical Design Document (TDD) $\rightarrow$ Architecture decisions $\rightarrow$ Implementation $\rightarrow$ Testing $\rightarrow$ Validation

The roadmap NEVER replaces a TDD. It prepares the ground for it.


## EPIC 1: FOUNDATIONS
This epic establishes the foundational architecture, CI/CD pipelines, state management, and base domain logic required for all subsequent epics.

### Phase 1.1: Core Monorepo Setup & CI/CD
**Goal**: Establish the repository structure, tooling, and continuous integration pipeline.
**Motivation**: Prevents configuration drift and ensures all future phases are built on a standardized, automatically tested foundation.
**Dependencies**: None.
**References**: [PRD Part 4.1](../00-product/PRD.md) (Architecture Overview).
**Scope**: 
- Create monorepo workspace.
- Setup linting, formatting, and test runners.
- Establish CI/CD pipelines for automated quality gates.
- *Excludes*: Actual application code or database provisioning.
**Deliverables**: A functional repository with passing CI pipelines and zero warnings.
**Exit Criteria**: Any PR submitted triggers the CI pipeline successfully.
**Risks**: Over-engineering the pipeline early on.
**Future Preparation**: Unlocks all subsequent development phases.

### Phase 1.2: Base Architecture & Global State Design
**Goal**: Define and implement the core state management and offline-first synchronization skeleton.
**Motivation**: The app must work offline and sync seamlessly. The state management pattern must be robust before UI components are built.
**Dependencies**: Phase 1.1.
**References**: [PRD Part 4.4](../00-product/PRD.md), 4.6.
**Scope**:
- Setup the core state store.
- Implement the base interfaces for local persistence (e.g., IndexedDB adapters).
- *Excludes*: Cloud sync implementation.
**Deliverables**: A headless state management library capable of reading/writing to local storage.
**Exit Criteria**: Unit tests demonstrate that state changes persist across simulated sessions.
**Risks**: Selecting a state paradigm that struggles with the high-frequency updates required by the 3D engine.
**Future Preparation**: Unlocks UI data binding and the Data Model implementation.

### Phase 1.3: Core Data Model Implementation
**Goal**: Implement the entities, schemas, and relationships defined in the PRD.
**Motivation**: A unified language for data is required before building the timer, algorithm DB, or stats engine.
**Dependencies**: Phase 1.2.
**References**: [PRD Part 15.](../00-product/PRD.md)
**Scope**:
- Define types/interfaces for Users, Solves, Sessions, Algorithms.
- Implement data validation layers.
- *Excludes*: AI entities or advanced telemetry models.
**Deliverables**: A typed data model library with validation schemas.
**Exit Criteria**: 100% test coverage on entity creation and validation.
**Risks**: Tight coupling of the data model to a specific UI framework.
**Future Preparation**: Unlocks the Base Timer Engine and Algorithm DB.

### Phase 1.4: Base Timer Engine
**Goal**: Build a headless, high-precision manual timer.
**Motivation**: The absolute core of a speedcubing app is the timer. It must be perfectly accurate and distinct from the UI.
**Dependencies**: Phase 1.3.
**References**: [PRD Part 12.](../00-product/PRD.md)
**Scope**:
- Start/stop logic, WCA inspection phases (15s, +2, DNF).
- High-precision timestamping.
- *Excludes*: Hardware cube integration or 3D visuals.
**Deliverables**: A headless Timer class/module emitting precise timing events.
**Exit Criteria**: Timer engine accurately handles WCA inspection rules and emits state transitions without UI lag.
**Risks**: JavaScript main-thread blocking causing timing inaccuracies.
**Future Preparation**: Unlocks UI Timer integration and acts as a baseline for the Smart Cube HAL.

---

## EPIC 2: HARDWARE ABSTRACTION LAYER (SMART CUBES & TIMERS)
This epic handles the physical connection to external devices: Bluetooth Smart Cubes and physical Timers (Stackmat, GAN Timer).

### Phase 2.1: Hardware Infrastructure (Web Bluetooth & Web Audio)
**Goal**: Establish a robust wrapper around the Web Bluetooth API (for cubes/timers) and Web Audio API (for Stackmat).
**Motivation**: Browser APIs for hardware are complex and fail frequently. A stable wrapper is necessary before implementing specific protocols.
**Dependencies**: Phase 1.1.
**References**: [PRD Part 5.1.](../00-product/PRD.md)
**Scope**:
- Request device, connect to GATT server, handle BLE disconnections.
- Request microphone permissions and setup `AudioContext` / `AudioWorklet` for Stackmat.
- *Excludes*: Parsing specific cube or timer data.
**Deliverables**: A generic hardware connection manager.
**Exit Criteria**: Ability to connect to a generic BLE device and successfully capture a raw audio stream.
**Risks**: Browser compatibility issues (Safari lacks Web Bluetooth; microphone permissions can be strict).
**Future Preparation**: Unlocks the HAL Interface Definition.

### Phase 2.2: HAL Interface Definition (Cubes & Timers)
**Goal**: Define the standard Interfaces that all Smart Cubes and Timers must implement.
**Motivation**: Prevents vendor lock-in. The app should interact with a 'Generic Smart Cube' or a 'Generic Timer', not specifically GAN or Stackmat.
**Dependencies**: Phase 2.1.
**References**: [PRD Part 5.1](../00-product/PRD.md), 5.4.
**Scope**:
- Define `SmartCubeAdapter` (face turns, gyroscope data, battery level).
- Define `HardwareTimerAdapter` (emits `handleDown()` and `handleUp()`).
- *Excludes*: Implementing the interface for a specific device.
**Deliverables**: Interface definitions and abstract base classes.
**Exit Criteria**: Code review approval of the interface design by the architectural lead.
**Risks**: Missing critical data fields required by future algorithms.
**Future Preparation**: Unlocks manufacturer-specific integrations.

### Phase 2.3: Hardware Timers Integration (Stackmat & GAN Timer)
**Goal**: Implement the HAL for official physical timers.
**Motivation**: Advanced speedcubers train with physical timers. The platform must support them seamlessly.
**Dependencies**: Phase 2.2, Phase 1.4.
**References**: PRD Part 0.4.1 (GAN Timers)
**Scope**:
- **Stackmat**: Decodificador de señal FSK desde el micrófono usando `AudioWorklet`.
- **GAN Timer**: Decodificador de paquetes BLE para el cronómetro de GAN.
- Ambos adaptadores se acoplarán al `TimerEngine` refactorizado en la Fase 1.4.
**Deliverables**: Adaptadores funcionales para Stackmat y GAN Timer.
**Exit Criteria**: Un toque en un Stackmat físico o GAN Timer dispara los eventos `handleDown` y `handleUp` en el motor headless.
**Risks**: Ruido en la señal de audio del micrófono o variaciones en los protocolos (Stackmat G4 vs G5).
**Future Preparation**: Unlocks hardware-driven timing sessions.

### Phase 2.4: Smart Cubes Protocol Integration (GAN Cube)
**Goal**: Implement the HAL for GAN Smart Cubes via a fork of `gan-web-bluetooth`.
**Motivation**: GAN is the most documented and widely used smart cube. It serves as the ideal proof-of-concept for the HAL.
**Dependencies**: Phase 2.2.
**References**: [PRD Part 5.3](../00-product/PRD.md), 0.4.1.
**Scope**:
- Port/Fork de la librería `gan-web-bluetooth` a nuestro monorepo.
- Decrypt/Parse GAN BLE payloads.
- Map GAN moves to the standard HAL events.
- *Excludes*: MoYu, QiYi, or other brands.
**Deliverables**: A working GAN adapter for the HAL.
**Exit Criteria**: A physical GAN cube emits accurate standard events to the console when turned.
**Risks**: Undocumented firmware changes from GAN breaking the parser.
**Future Preparation**: Unlocks hardware-to-3D syncing and analysis.

### Phase 2.5: Sync & Clock Drift Correction
**Goal**: Ensure physical cube/timer timestamps perfectly align with local system time.
**Motivation**: Bluetooth latency and hardware clock drift will ruin solve analysis if not aggressively corrected.
**Dependencies**: Phase 2.4.
**References**: [PRD Part 5.2.](../00-product/PRD.md)
**Scope**:
- Implement timestamp reconciliation algorithms (Linear regression).
- Establish baseline latency metrics.
- *Excludes*: Post-solve analysis.
**Deliverables**: A middleware that corrects incoming event timestamps in real-time.
**Exit Criteria**: Move timestamps are proven accurate within a <15ms margin of error.
**Risks**: Severe inconsistencies in hardware BLE reporting rates.
**Future Preparation**: Unlocks accurate TPS (Turns Per Second) computation in the Analysis Engine.

---

## EPIC 3: CORE 3D ENGINE
This epic builds the visual representation of the cube.

### Phase 3.1: 3D Canvas Infrastructure
**Goal**: Setup the WebGL/Three.js context and base camera/lighting.
**Motivation**: The 3D engine must be performant and separate from standard DOM rendering.
**Dependencies**: Phase 1.1.
**References**: [PRD Part 6.1.](../00-product/PRD.md)
**Scope**:
- Setup rendering loop.
- Load base cube meshes/materials.
- *Excludes*: Animation or user interaction.
**Deliverables**: A static, perfectly rendered 3D Rubik's cube on a canvas.
**Exit Criteria**: Renders at 60 FPS on mid-range mobile devices without memory leaks.
**Risks**: Heavy asset loading times.
**Future Preparation**: Unlocks 3D animations.

### Phase 3.2: Real-time Rotation & Translation Maps
**Goal**: Implement the mathematical logic to rotate layers and faces visually.
**Motivation**: The visual cube must respond to algebraic notation (e.g., R, U', F2).
**Dependencies**: Phase 3.1.
**References**: [PRD Part 6.2.](../00-product/PRD.md)
**Scope**:
- Map standard notation to quaternion/Euler rotations.
- Implement tweening for smooth animations.
- *Excludes*: Hardware syncing.
**Deliverables**: An API to send string notations (e.g., `playMove('R')`) and see the cube animate.
**Exit Criteria**: Smooth animations with zero visual clipping or orientation bugs after 1,000 random moves.
**Risks**: Quaternion gimbal lock or matrix drift over long sessions.
**Future Preparation**: Unlocks UI playback controls and hardware syncing.

### Phase 3.3: Hardware-to-3D Syncing
**Goal**: Connect the HAL to the 3D Engine.
**Motivation**: The user must see their physical moves mirrored perfectly in the 3D space in real-time.
**Dependencies**: Phase 2.4, Phase 3.2.
**References**: [PRD Part 6.3.](../00-product/PRD.md)
**Scope**:
- Create a data bridge between HAL events and the 3D rotation API.
- Implement interpolation to hide Bluetooth jitter.
- *Excludes*: Advanced analysis overlays.
**Deliverables**: A virtual cube that mirrors a physical smart cube.
**Exit Criteria**: Perceived visual latency is under 30ms.
**Risks**: Bluetooth event lag causing the virtual cube to 'snap' unnaturally.
**Future Preparation**: Unlocks Real-time Analysis visual feedback.

---

## EPIC 4: SOLVER ENGINE & MATHEMATICS
This epic implements the mathematical core required to understand cube states and calculate solutions.

### Phase 4.1: Mathematical Core Implementation
**Goal**: Represent the cube algebraically and implement state transitions headless.
**Motivation**: The system needs a way to understand what state the cube is in without relying on the 3D visualizer.
**Dependencies**: Phase 1.1.
**References**: [PRD Part 7.1.](../00-product/PRD.md)
**Scope**:
- Array/Bitboard representation of the 54 stickers or 20 pieces.
- Transition matrices for all 18 standard moves.
- *Excludes*: Finding the shortest path (Solver).
**Deliverables**: A high-performance mathematical cube class.
**Exit Criteria**: Can apply 10,000 random moves to a state and verify the final state accurately in under 10ms.
**Risks**: Inefficient data structures slowing down future search algorithms.
**Future Preparation**: Unlocks Scramble Generation and the Solver.

### Phase 4.2: Scramble Generation Engine
**Goal**: Generate officially valid WCA random state scrambles.
**Motivation**: Users need random, fair scrambles to practice.
**Dependencies**: Phase 4.1.
**References**: [PRD Part 0.3.3.](../00-product/PRD.md)
**Scope**:
- Port or integrate TNoodle-like random state logic.
- Ensure no scramble is shorter than 2 moves from solved.
- *Excludes*: UI for displaying scrambles.
**Deliverables**: A scramble generator module returning arrays of notation.
**Exit Criteria**: Generates 1,000 valid, uniformly distributed random state scrambles instantly.
**Risks**: Bias in the random distribution.
**Future Preparation**: Unlocks full Timer sessions.

### Phase 4.3: Optimal Solution Calculation
**Goal**: Implement Kociemba's algorithm (or similar) to find the shortest path to solved.
**Motivation**: Needed for the "Analysis Engine" to know if a user made a mistake or took an inefficient path.
**Dependencies**: Phase 4.1.
**References**: [PRD Part 7.3.](../00-product/PRD.md)
**Scope**:
- Implement two-phase search algorithm.
- Generate pruning tables.
- *Excludes*: Multi-method (CFOP/Roux) parsing.
**Deliverables**: A function that takes a cube state and returns a <=20 move solution.
**Exit Criteria**: Solves any valid scrambled state in under 100ms on a modern CPU.
**Risks**: Pruning table memory overhead and long initialization times on the client side.
**Future Preparation**: Unlocks AI suggestions and optimal path comparisons.

### Phase 4.4: Multi-Method Support Architecture
**Goal**: Build the framework to recognize specific CFOP or Roux steps.
**Motivation**: Users don't solve optimally; they use human methods. The engine must understand human methods to provide relevant advice.
**Dependencies**: Phase 4.3.
**References**: [PRD Part 7.2.](../00-product/PRD.md)
**Scope**:
- Define state masks for CFOP (Cross, F2L pairs, OLL, PLL).
- *Excludes*: Real-time tracking of these steps.
**Deliverables**: A module that can take a state and return boolean checks (e.g., `isCrossSolved(state)`).
**Exit Criteria**: Accurately identifies step completions against a test suite of 500 known cube states.
**Risks**: Edge cases in non-standard solve techniques (e.g., X-Cross, pseudo-slotting).
**Future Preparation**: Unlocks the Real-time Analysis Pipeline.


---

## EPIC 5: REAL-TIME ANALYSIS PIPELINE
This epic uses the Math Core to provide live analysis of a user's solve as it happens.

### Phase 5.1: State Tracking & Move Detection
**Goal**: Feed HAL events into the Math Core to track the exact cube state over time.
**Motivation**: The app must know exactly what the cube looks like at any given millisecond.
**Dependencies**: Phase 2.3 (HAL), Phase 4.1 (Math Core).
**References**: [PRD Part 8.1.](../00-product/PRD.md)
**Scope**:
- Create an event loop that applies HAL moves to a Math Core instance.
- Maintain an immutable history of states (Move -> State -> Timestamp).
- *Excludes*: Determining if a phase like F2L is finished.
**Deliverables**: A headless session tracker that records a perfect replay timeline of a solve.
**Exit Criteria**: Replaying the recorded timeline results in the exact same mathematical state as the physical cube.
**Risks**: Desync caused by unrecorded physical moves or Bluetooth drops.
**Future Preparation**: Unlocks Phase Recognition.

### Phase 5.2: Phase Recognition (Cross, F2L, OLL, PLL)
**Goal**: Apply the Multi-Method Support architecture to the live timeline.
**Motivation**: The app needs to split the solve into standard human phases automatically.
**Dependencies**: Phase 4.4, Phase 5.1.
**References**: [PRD Part 8.2.](../00-product/PRD.md)
**Scope**:
- Run phase detection masks against every state in the timeline.
- Split the timeline into discrete segments (e.g., "Cross took 2.1s").
- *Excludes*: Real-time UI rendering of these splits.
**Deliverables**: A timeline parser that emits phase-transition events.
**Exit Criteria**: Accurately splits 100 recorded solves into CFOP phases with 100% precision.
**Risks**: Users doing non-standard solve paths confusing the phase detector.
**Future Preparation**: Unlocks advanced metric computation.

### Phase 5.3: Metric Computation (TPS, Fluidity, Pauses)
**Goal**: Calculate deep analytics for each detected phase.
**Motivation**: Phase splits alone are not enough; users need to know *why* a phase was slow.
**Dependencies**: Phase 5.2.
**References**: [PRD Part 11.2.](../00-product/PRD.md)
**Scope**:
- Calculate Turns Per Second (TPS) per phase.
- Detect pauses > 0.5s.
- Calculate fluidity (variance in move times).
- *Excludes*: Storing these metrics in the database.
**Deliverables**: A metrics generator function that takes a parsed timeline and returns a rich analytics object.
**Exit Criteria**: Accurately highlights the longest pause and the exact TPS of F2L vs OLL.
**Risks**: Metric definitions becoming too subjective or mathematically noisy.
**Future Preparation**: Unlocks live feedback and statistics tracking.

### Phase 5.4: Live Feedback & Telemetry
**Goal**: Emit metrics in real-time while the user is solving.
**Motivation**: The app should act as a coach, potentially giving audio feedback or live UI indicators.
**Dependencies**: Phase 5.3.
**References**: [PRD Part 8.3.](../00-product/PRD.md)
**Scope**:
- Stream metrics to an event bus.
- Implement 'Training Mode' vs 'Free Solve' logic (where telemetry is hidden during Free Solve).
- *Excludes*: AI natural language coaching.
**Deliverables**: A pub/sub telemetry service.
**Exit Criteria**: Telemetry events fire within 50ms of a physical phase transition.
**Risks**: Performance overhead of calculating metrics on every single move in real-time.
**Future Preparation**: Unlocks AI integration.

---

## EPIC 6: TRAINING SYSTEM & ALGORITHM DB
This epic provides the core value proposition for users wanting to learn new methods.

### Phase 6.1: Algorithm Database Schema & Seed
**Goal**: Establish the definitive source of truth for all OLL, PLL, and F2L algorithms.
**Motivation**: A unified database is required before any training module can be built.
**Dependencies**: Phase 1.3.
**References**: [PRD Part 10.1](../00-product/PRD.md), 10.2.
**Scope**:
- Define the DB schema for Algorithms, Sets, and Subsets.
- Populate the database with standard CFOP algs.
- *Excludes*: User-submitted algorithms (Phase 6.x / Epic 9).
**Deliverables**: A queryable, local-first database of standard algorithms.
**Exit Criteria**: Ability to query "All OLLs with all edges oriented" and get correct results.
**Risks**: Disagreement on standard naming conventions or "best" algorithms.
**Future Preparation**: Unlocks the Training Module Engine.

### Phase 6.2: Training Module Engine
**Goal**: Build the core loop for algorithm drill training.
**Motivation**: Users need to practice specific cases repeatedly.
**Dependencies**: Phase 4.2 (Scrambler), Phase 6.1 (Alg DB).
**References**: [PRD Part 9.1.](../00-product/PRD.md)
**Scope**:
- Generate scrambles that result in a specific algorithm case.
- Verify if the user successfully solved the specific case.
- *Excludes*: Progression tracking.
**Deliverables**: A headless training engine for isolated case practice.
**Exit Criteria**: Generates 50 valid scrambles for OLL 21 and accurately detects when OLL 21 is solved.
**Risks**: Scramble generation for specific F2L cases is mathematically complex.
**Future Preparation**: Unlocks Progress Tracking.

### Phase 6.3: Progress Tracking per Algorithm
**Goal**: Track the user's mastery of every single algorithm in the database.
**Motivation**: The app must know what the user knows, and how fast they execute it.
**Dependencies**: Phase 1.3, Phase 6.2.
**References**: [PRD Part 9.2.](../00-product/PRD.md)
**Scope**:
- Store execution times, TPS, and failure rates per algorithm per user.
- *Excludes*: Spaced repetition logic.
**Deliverables**: A mastery database linked to the user profile.
**Exit Criteria**: Completing a training module successfully updates the user's mastery score for that specific algorithm.
**Risks**: Data bloat from storing thousands of micro-solves.
**Future Preparation**: Unlocks Spaced Repetition.

### Phase 6.4: Spaced Repetition System (SRS)
**Goal**: Automatically schedule training modules based on decay curves.
**Motivation**: Optimal learning requires reviewing algorithms just before they are forgotten.
**Dependencies**: Phase 6.3.
**References**: [PRD Part 9.3.](../00-product/PRD.md)
**Scope**:
- Implement an SRS algorithm (e.g., SM-2 or similar).
- Generate daily "Recommended Training" playlists.
- *Excludes*: AI natural language recommendations.
**Deliverables**: An SRS engine that outputs a queue of algorithms to practice today.
**Exit Criteria**: The engine prioritizes algorithms with high failure rates or old mastery dates.
**Risks**: User fatigue if the SRS queue grows too large.
**Future Preparation**: Unlocks the AI Coach.

---

## EPIC 7: ADVANCED STATISTICS
This epic handles the aggregation and visualization of data.

### Phase 7.1: Time-series Data Aggregation
**Goal**: Aggregate raw solves into daily, weekly, and monthly trends.
**Motivation**: Users need to see their macro-progression (e.g., Global Ao100 over the last year).
**Dependencies**: Phase 1.3, Phase 1.4.
**References**: [PRD Part 11.1.](../00-product/PRD.md)
**Scope**:
- Implement rolling averages (Ao5, Ao12, Ao100).
- Generate time-series datasets for charting.
- *Excludes*: UI Charting libraries.
**Deliverables**: A statistical aggregation service.
**Exit Criteria**: Accurate computation of an Ao100 from a dataset of 10,000 solves in under 50ms.
**Risks**: Slow database queries on large profiles.
**Future Preparation**: Unlocks UI graphs and Differential Analysis.

### Phase 7.2: Custom Metrics & Differential Analysis
**Goal**: Compare the user's metrics against optimal baselines or peer groups.
**Motivation**: Users need to know *where* they are losing time compared to better cubers.
**Dependencies**: Phase 5.3, Phase 7.1.
**References**: [PRD Part 11.2.](../00-product/PRD.md)
**Scope**:
- Calculate "Cross-to-F2L transition time" averages.
- Compare user phase splits against target ratios (e.g., Cross should be 12% of total time).
- *Excludes*: Cloud leaderboards.
**Deliverables**: A differential analytics engine.
**Exit Criteria**: Successfully identifies that a user's OLL is disproportionately slow compared to their F2L.
**Risks**: Overwhelming the user with too much data.
**Future Preparation**: Unlocks AI automated weakness detection.

### Phase 7.3: Data Export & API
**Goal**: Allow users to own their data.
**Motivation**: Speedcubers use multiple tools (csTimer); data portability is a core philosophical pillar.
**Dependencies**: Phase 7.1.
**References**: [PRD Part 11.4.](../00-product/PRD.md)
**Scope**:
- Export sessions to standard formats (CSV, JSON, csTimer format).
- *Excludes*: Public REST APIs for third-party apps.
**Deliverables**: Data export utility functions.
**Exit Criteria**: An exported CSV can be successfully imported into csTimer.
**Risks**: Formatting inconsistencies with legacy timer apps.
**Future Preparation**: Finalizes the local data lifecycle.

---

## EPIC 8: AI INTEGRATION
This epic introduces the intelligent layer of CubeForge.

### Phase 8.1: AI Infrastructure & Pipeline
**Goal**: Establish the connection to the LLM backend (e.g., OpenAI/Anthropic/Local).
**Motivation**: The app needs a secure, rate-limited way to ask an LLM questions about a user's data.
**Dependencies**: Phase 1.1.
**References**: [PRD Part 13.1.](../00-product/PRD.md)
**Scope**:
- Setup API clients, prompt management, and response parsing.
- *Excludes*: Generating actual cubing advice.
**Deliverables**: A generic LLM inference pipeline.
**Exit Criteria**: App can send a generic prompt and receive a parsed JSON response securely.
**Risks**: High API costs or latency.
**Future Preparation**: Unlocks all specific AI features.

### Phase 8.2: Automated Weakness Detection
**Goal**: Use the LLM to interpret the Differential Analysis data and provide human-readable advice.
**Motivation**: Raw data is intimidating; users need actionable insights.
**Dependencies**: Phase 7.2, Phase 8.1.
**References**: [PRD Part 13.2.](../00-product/PRD.md)
**Scope**:
- Inject statistical data into a specialized prompt.
- Generate weekly "Coach Reports".
- *Excludes*: Real-time voice coaching.
**Deliverables**: A scheduled job/service that produces text-based improvement plans.
**Exit Criteria**: The AI correctly identifies a user's slow OLL recognition and recommends the specific Training Module for OLLs.
**Risks**: The LLM hallucinating bad cubing advice.
**Future Preparation**: Unlocks the Conversational Assistant.

### Phase 8.3: Conversational Assistant Base
**Goal**: Allow users to ask natural language questions about their solves or algorithms.
**Motivation**: A chat interface provides the ultimate personalized coaching experience.
**Dependencies**: Phase 8.2.
**References**: [PRD Part 13.2.](../00-product/PRD.md)
**Scope**:
- RAG (Retrieval-Augmented Generation) pipeline linking the LLM to the Algorithm DB and the user's recent solves.
- *Excludes*: Voice recognition.
**Deliverables**: A chat backend capable of answering "Why was my last solve so slow?"
**Exit Criteria**: The AI can query the user's last solve and correctly state that they paused for 2 seconds during the first F2L pair.
**Risks**: Context window limits when analyzing large sets of solves.
**Future Preparation**: Unlocks future voice-based real-time coaching.

---

## EPIC 9: SCALING & UX
This epic handles the final polish, cloud infrastructure, and public release preparations.

### Phase 9.1: UX Polish & Gamification Systems
**Goal**: Implement the visual design language, animations, and achievement systems.
**Motivation**: The app must feel premium, responsive, and rewarding to use.
**Dependencies**: All previous Epics.
**References**: [PRD Part 14.](../00-product/PRD.md)
**Scope**:
- Implement the design system (Dark mode, glassmorphism).
- Build the achievement unlocking logic.
- *Excludes*: Core functional logic.
**Deliverables**: The final, polished user interface.
**Exit Criteria**: App achieves a >90 score on Lighthouse (Performance/Accessibility) and matches Figma designs.
**Risks**: Heavy UI animations impacting the performance of the 3D Engine or Timer.
**Future Preparation**: Prepares for Beta release.

### Phase 9.2: Scalability & Cloud Sync
**Goal**: Move the offline-first data to the cloud securely.
**Motivation**: Users need their data backed up and synced across devices.
**Dependencies**: Phase 1.2.
**References**: [PRD Part 4.6.](../00-product/PRD.md)
**Scope**:
- Setup the backend database (e.g., Relational DB).
- Implement Conflict-Free Replicated Data Types (Conflict-Free Datatypes) or timestamp-based conflict resolution.
- *Excludes*: Social networking features.
**Deliverables**: A seamless cloud synchronization service.
**Exit Criteria**: A solve recorded on a mobile device appears on a desktop browser within 2 seconds.
**Risks**: Data collision or loss during complex offline/online transitions.
**Future Preparation**: Unlocks multi-device ecosystems.

### Phase 9.3: Public SDK & External Integrations
**Goal**: Expose the Hardware Abstraction Layer and Math Core as public npm packages.
**Motivation**: Establish CubeForge as an ecosystem platform, not just an app.
**Dependencies**: Phase 2.2, Phase 4.1.
**References**: [PRD Part 5.4.](../00-product/PRD.md)
**Scope**:
- Document the APIs.
- Setup CI/CD for public npm publishing.
- *Excludes*: Third-party app development.
**Deliverables**: Published, open-source SDKs for Smart Cube interaction.
**Exit Criteria**: A developer can `npm install @cubeforge/smart-cube` and connect to a GAN cube in under 10 lines of code.
**Risks**: Breaking API changes alienating early adopters.
**Future Preparation**: Completes the initial Product Vision.

---
*End of Master Roadmap.*

