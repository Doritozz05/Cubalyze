# Architecture Research Roadmap

## 1. Purpose & Vision

The Architecture Research phase is the critical bridge between product requirements and technical implementation. It exists to systematically eliminate technical uncertainty, validate assumptions, and ensure that every architectural decision is backed by evidence before writing production code.

This document is the authoritative governance guide for all future research. Research is not a simple checklist; it is an executable process.

## 2. Standardized Research Metadata

Every research investigation MUST adhere to the following metadata structure to be considered valid and actionable.

### Example Research Item Template

- **ID**: `[e.g., A.1]`
- **Title**: `[Research Topic]`
- **Purpose**: What are we trying to figure out?
- **Inputs**: PRD links, Domain Knowledge links, constraints.
- **Dependencies**: What must be resolved before this can start?
- **Research Questions**: 2-3 specific questions this research must answer.
- **Alternatives**: The distinct paths we are comparing (e.g., SQLite vs. Dexie).
- **Prototype Required**: [Yes/No]
- **Benchmark Required**: [Yes/No]
- **Expected Deliverables**: Code, diagrams, or documents.
- **Outputs**: The final research artifact location.
- **Exit Criteria**: The exact condition that marks this research as complete.
- **Risks**: What happens if we get this wrong?
- **Confidence Level**: [Low/Medium/High] (Updated as research progresses).
- **Status**: [Not Started / In Progress / Blocked / Complete]
- **Next Step**: e.g., "Draft RFC 001", "Create Prototype".

---

## 3. Active Research Roadmap

### Phase A — Platform & Distribution

#### A.1 PWA Storage & Eviction Policies
- **Purpose**: Determine if OPFS/IndexedDB is safe from arbitrary OS eviction on iOS/Android.
- **Inputs**: Product Offline-First Requirement.
- **Dependencies**: None.
- **Research Questions**: Will iOS Safari delete local user data if the app is unused for 7 days? Can we request persistent storage reliably?
- **Alternatives**: PWA Native Storage vs. Tauri/Capacitor Wrapper.
- **Prototype Required**: Yes (Storage persistence test).
- **Benchmark Required**: No.
- **Expected Deliverables**: Research Report on Web Storage APIs.
- **Outputs**: `02-architecture/research/platform/PWA_Storage_Report.md`
- **Exit Criteria**: Absolute certainty on data safety on iOS.
- **Risks**: Complete data loss for offline users.
- **Confidence Level**: High.
- **Status**: Complete.
- **Next Step**: Draft RFC for Database & Storage Strategy.

#### A.2 Web Bluetooth & Mobile Fallbacks
- **Purpose**: Determine how mobile users connect smart cubes.
- **Inputs**: Smart Cube requirement.
- **Dependencies**: None.
- **Research Questions**: Since iOS lacks Web Bluetooth, what is the fallback? WebBLE app? Capacitor?
- **Alternatives**: PWA Web Bluetooth vs. React Native.
- **Prototype Required**: Yes.
- **Benchmark Required**: No.
- **Expected Deliverables**: Connectivity matrix report.
- **Outputs**: `02-architecture/research/platform/Bluetooth_Connectivity_Report.md`
- **Exit Criteria**: A viable path for iOS Bluetooth is identified and tested.
- **Risks**: Loss of the iOS user base for smart cube features.
- **Confidence Level**: High.
- **Status**: Complete.
- **Next Step**: Draft RFC for Hardware Abstraction Layer (HAL).

### Phase B — Core Architecture

#### C.1 Database Selection & Aggregation
- **Purpose**: Select the database to handle Ao100 statistics over 10,000+ solves locally.
- **Inputs**: Data Flow requirements.
- **Dependencies**: A.1 PWA Storage.
- **Research Questions**: Is SQLite via WASM (OPFS) faster/more reliable than Dexie (IndexedDB) for complex aggregations?
- **Alternatives**: SQLite WASM vs. Dexie.js vs. RxDB.
- **Prototype Required**: Yes.
- **Benchmark Required**: Yes.
- **Expected Deliverables**: Performance benchmark metrics.
- **Outputs**: `02-architecture/validation/benchmarks/Database_Benchmark.md`
- **Exit Criteria**: Proven <50ms query time for an Ao100 across 10k records.
- **Risks**: UI freeze during calculation.
- **Confidence Level**: Medium.
- **Status**: Blocked (A.1).
- **Next Step**: Await A.1 completion.

*(Additional phases will follow this exact strict structure as they are prioritized).*
