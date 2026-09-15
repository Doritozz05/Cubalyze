---
status: "Draft"
owner: "Architecture Team"
reviewers: "TBD"
created: "2026-07-13"
last_updated: "2026-07-13"
version: "0.1.0"
related_adr: ""
produces: "Solver Engine & Math Core"
tags: "math, solver, min2phase, kociemba, algorithm"
document_type: "TDD"
---

# Epic 4: Solver Engine & Mathematics - Technical Design Document

## Introduction

This Technical Design Document (TDD) specifies the implementation architecture for Epic 4 of the CubeForge roadmap: the **Solver Engine & Mathematics Core**. 
This epic implements the mathematical brain of the platform, enabling ultra-fast headless state tracking, WCA-compliant scramble generation, optimal solution search via Herbert Kociemba's two-phase algorithm (`min2phase`), and a modular method-recognition system for human solves (CFOP, Roux, etc.).

## Architecture

The Solver Engine is designed as a standalone headless library (e.g., `packages/math-core` or `packages/solver-engine`). It sits below the UI and below the Real-Time Analysis System, acting as a pure mathematical service.

**Key architectural principles:**
1. **WebWorker First**: All heavy mathematical computations (especially `min2phase` table generation and optimal search) must run in a WebWorker (via `comlink`) to prevent main thread blocking, as dictated by PRD Part 6.3 and 7.1.
2. **Server Fallback**: For low-end devices where generating `min2phase` pruning tables causes Memory/CPU issues, a serverless backend fallback will be provided (PRD Part 7.1).
3. **Plugin Architecture for Methods**: The engine does not hardcode CFOP. It exposes a generic `SolveMethod` plugin interface (PRD Part 7.2).

## Data Models

### Cube State Representation
The core mathematical state must avoid floating-point drift and heavy Object overhead.
- **Internal State**: An Int8Array or bitboard representing the permutations and orientations of the 8 corners and 12 edges (20 pieces).
- **String Representation**: The standard WCA facelet string (54 characters: UUUUUUUUURRRRRRRRR...).

### Method Plugin Interface (PRD 7.2)
```typescript
interface PhaseTransition {
  phaseId: string;
  timestampMs: number;
  stateAtTransition: string;
}

interface Suggestion {
  optimalMoves: string[];
  description: string;
}

interface MethodPhase {
  id: string;
  name: string;
  order: number;
}

export interface SolveMethod {
  readonly id: "CFOP" | "Roux" | "ZZ" | "Petrus" | "LBL" | string;
  readonly phases: MethodPhase[];
  
  // Evaluates a state and history to determine if a phase was just completed
  detectPhaseBoundary(state: string, moveHistory: string[]): PhaseTransition | null;
  
  // Suggests the optimal steps to complete the current phase
  suggestOptimalStep(state: string, phaseId: string): Suggestion;
}
```

## API Specifications

### `SolverEngine` Service
- `init(useBackendFallback?: boolean): Promise<void>`: Initializes pruning tables. If `useBackendFallback` is true or memory is restricted, it connects to the cloud API.
- `applyMove(state: string, move: string): string`: Returns the new state algebraically in O(1).
- `generateScramble(): string`: Returns a WCA-compliant random state scramble.
- `findOptimalSolution(state: string, maxDepth?: number): string`: Uses `min2phase` to find a solution in <= 20 moves.
- `registerMethod(method: SolveMethod): void`: Injects a new solve method parser.

## Implementation Details

### Phase 4.1: Mathematical Core Implementation
1. Implement corner and edge permutation/orientation tables (Standard Kociemba coordinates).
2. Implement transition matrices for all 18 standard moves (U, U', U2, R, R', R2, etc.).
3. Ensure `applyMove` operations use bitwise logic or typed array lookups for maximum performance.

### Phase 4.2: Scramble Generation Engine
1. Integrate WCA random-state logic.
2. Rather than completely randomizing the 54 stickers (which is invalid 11 out of 12 times), randomize the corners, edges, and parity, ensuring validity.
3. Pass the random valid state to the `min2phase` solver to generate the scramble sequence.
4. Filter out any sequences that solve the cube in fewer than 2 moves (PRD rule).

### Phase 4.3: Optimal Solution Calculation (`min2phase`)
1. Integrate the `min2phase` algorithm (e.g., using Chen Shuang's highly optimized implementation as a base).
2. **Table Generation**: Implement progressive table initialization in a WebWorker. The first solves might take ~1s while tables build, subsequent solves < 10ms.
3. **Backend Fallback (Missing from Roadmap, required by PRD)**: Deploy an AWS Lambda / Cloudflare Worker running `min2phase`. If the client detects low RAM or timeouts, it routes `findOptimalSolution` requests over HTTP/WebSocket.

### Phase 4.4: Multi-Method Support Architecture
1. Define the `SolveMethod` interface.
2. Implement the `CFOPMethod` plugin:
   - `Cross`: Check if 4 D-edges are correctly oriented and placed relative to centers.
   - `F2L`: Check if Cross + 4 corner-edge pairs are solved.
   - `OLL`: Check if F2L + U face stickers all face UP.
   - `PLL`: Check if solved.
3. Expose the `registerMethod` registry to allow future injection of `RouxMethod` or `ZZMethod`.

## Testing Strategy

- **Unit Tests**: Test `applyMove` against 10,000 known state-move-result triples.
- **Integration Tests**: Verify that `generateScramble()` -> `findOptimalSolution()` always yields an identity state (solved) in <= 20 moves.
- **Performance Tests**: Ensure WebWorker table generation completes within performance budgets (e.g., < 2000ms on desktop) and `findOptimalSolution` runs in < 50ms.
- **Method Tests**: Feed a known CFOP solve timeline and assert that `detectPhaseBoundary` accurately splits Cross, F2L, OLL, and PLL at the exact correct index.

## Deployment Strategy

- This is a headless logic module. It will be published as an internal monorepo package (e.g., `@cubalyze/solver-engine`).
- The Server Fallback will be deployed as a stateless edge function (e.g., AWS Lambda or Vercel Edge).
