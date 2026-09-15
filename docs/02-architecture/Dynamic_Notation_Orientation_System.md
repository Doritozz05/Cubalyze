# Dynamic Notation System Based on Cube Orientation

**Status:** Design Complete — Ready for Implementation Review  
**Date:** July 17, 2026  
**Author:** Buffy (AI) — comprehensive research + design  
**Related ADRs:** ADR-008 (Frontend Framework), ADR-014 (Rendering), ADR-015 (Solver Engine)  
**Related Docs:** `docs/wca.md` (Article 12 — Notation), `TDD-0006-3D-Engine.md`, `PRD.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Research Findings](#2-research-findings)
   - 2.1 [WCA Notation — Article 12](#21-wca-notation--article-12)
   - 2.2 [Singmaster Rotation Mathematics](#22-singmaster-rotation-mathematics)
   - 2.3 [Bluetooth Cube IMU Capabilities](#23-bluetooth-cube-imu-capabilities)
   - 2.4 [Gyroscope-Based Orientation Tracking](#24-gyroscope-based-orientation-tracking)
3. [Mathematical Design](#3-mathematical-design)
   - 3.1 [Representation of Orientation](#31-representation-of-orientation)
   - 3.2 [The 24 Cube Orientations](#32-the-24-cube-orientations)
   - 3.3 [Face Transformation Tables](#33-face-transformation-tables)
   - 3.4 [Composition of Rotations](#34-composition-of-rotations)
   - 3.5 [Direction Preservation Proof](#35-direction-preservation-proof)
   - 3.6 [Reversibility and Consistency](#36-reversibility-and-consistency)
4. [Architecture](#4-architecture)
   - 4.1 [Design Principles](#41-design-principles)
   - 4.2 [New Modules](#42-new-modules)
   - 4.3 [Existing Files to Modify](#43-existing-files-to-modify)
   - 4.4 [Code Removed](#44-code-removed)
   - 4.5 [Complete Data Flow](#45-complete-data-flow)
5. [Compatibility Guarantees](#5-compatibility-guarantees)
6. [Test Plan](#6-test-plan)
7. [Implementation Phases](#7-implementation-phases)
8. [Risk Analysis](#8-risk-analysis)
9. [References](#9-references)

---

## 1. Problem Statement

### Current Behavior
After calibrating the cube (e.g. green = front, white = up), all physical face moves (F, R, L, U, B, D) are interpreted correctly relative to that calibration. The 3D scene's `GyroFusion` class already fuses the hardware quaternion to visually rotate the cube model — **but the move notation displayed to the user remains anchored to the original calibration frame.**

### The Bug
When the user physically rotates the entire cube (a whole-cube rotation — equivalent to an `x`, `y`, or `z` in Singmaster notation), the face labels in the UI do **not** update. Example:

- **Calibrate:** Green = Front, White = Up.
- User rotates the whole cube so Orange is now at the front.
- User turns the face that is physically on their **right** (which is now the original Back face).
- The UI shows `B` (the raw move from the cube), but the user expects `R` (the face that is currently on their right).

### Expected Behavior
After any global cube rotation:
- The new front face becomes the new **F**.
- The new right face becomes the new **R**.
- The new top face becomes the new **U**.
- etc.

The visible notation must update continuously based on the cube's current physical orientation. The visual reference must always follow the user's perspective.

### Critical Constraints
1. **NEVER modify the Bluetooth protocol flow.** Raw moves from BLE must remain exactly as received.
2. **NEVER modify the internal cube state.** `CubeState`, facelet reconstruction, scramble validation, solver — all operate on raw moves.
3. **NEVER break the existing system.** Cubes without an IMU must degrade to the current (identity) behavior.
4. **Maintain full compatibility** with existing scrambles, solves, and stored data.
5. **Modular, maintainable, extensible** design.

---

## 2. Research Findings

### 2.1 WCA Notation — Article 12

Source: `docs/wca.md` (lines 517–545), verified verbatim against the official WCA Regulations (version April 1, 2026, commit `415be08`).

#### Face Moves (Regulation 12a1)
- **12a1a** — Clockwise, 90°: `F`, `B`, `R`, `L`, `U`, `D`
- **12a1b** — Counter-clockwise, 90°: `F'`, `B'`, `R'`, `L'`, `U'`, `D'`
- **12a1c** — 180°: `F2`, `B2`, `R2`, `L2`, `U2`, `D2`

#### Rotations — Entire Puzzle (Regulation 12a4)
- **12a4a** — Clockwise, 90°:
  - `x` = same direction as `R` or `L'`
  - `y` = same direction as `U` or `D'`
  - `z` = same direction as `F` or `B'`
- **12a4b** — Counter-clockwise, 90°:
  - `x'` = same direction as `R'` or `L`
  - `y'` = same direction as `U'` or `D`
  - `z'` = same direction as `F'` or `B`
- **12a4c** — 180°: `x2`, `y2`, `z2`

**Key interpretation:** A cube rotation is defined as rotating the *entire* cube as a rigid body, as if you were performing the corresponding face turn but on all layers simultaneously. The axes are:
- **x-axis:** passes through L and R centers (the R-face axis).
- **y-axis:** passes through U and D centers (the U-face axis).
- **z-axis:** passes through F and B centers (the F-face axis).

Direction "clockwise" is determined by looking at the face from outside the cube along the positive axis direction.

#### Metrics (Regulation 12a6)
- **ETM (Execution Turn Metric):** Every face move, outer block move, and rotation counts as 1 move.
- **OBTM (Outer Block Turn Metric):** Face moves and outer block moves = 1; rotations = 0.

> For our notation system, rotations are **not moves** — they are orientation changes. They do not alter the cube's logical state. This distinction is what makes the raw/display separation clean.

---

### 2.2 Singmaster Rotation Mathematics

A whole-cube rotation relabels the faces. When the cube rotates as a rigid body, the body axes rotate with it. A face turn `M` performed *after* a rotation `R` is equivalent to `R M R⁻¹` in the original frame — this is the conjugation that defines how face labels transform.

#### Face Mapping Tables (Verified)

These tables answer: *"After rotation X, which original face now occupies each position?"* Read as `position → original face that is now there`.

> **Verification method:** These tables were derived by tracing the edge permutations in the project's own `CubeState.ts` (`baseU.ep`, `baseR.ep`, `baseF.ep`), NOT from external sources. For each base move, `ep[i]` tells us which piece arrives at position `i`, which directly reveals the face cycle.

**x rotation** (rotate like `R` — verified from `baseR.ep`: F→U, U→B, B→D, D→F; L and R stay):

| Position | U | D | F | B | L | R |
|:--------:|:--:|:--:|:--:|:--:|:--:|:--:|
| **x**    | F  | B  | D  | U  | L  | R  |
| **x'**   | B  | F  | U  | D  | L  | R  |
| **x2**   | D  | U  | B  | F  | L  | R  |

**y rotation** (rotate like `U` — verified from `baseU.ep`: B→R, R→F, F→L, L→B; U and D stay):

| Position | U | D | F | B | L | R |
|:--------:|:--:|:--:|:--:|:--:|:--:|:--:|
| **y**    | U  | D  | R  | L  | F  | B  |
| **y'**   | U  | D  | L  | R  | B  | F  |
| **y2**   | U  | D  | B  | F  | R  | L  |

**z rotation** (rotate like `F` — verified from `baseF.ep`: L→U, U→R, R→D, D→L; F and B stay):

| Position | U | D | F | B | L | R |
|:--------:|:--:|:--:|:--:|:--:|:--:|:--:|
| **z**    | L  | R  | F  | B  | D  | U  |
| **z'**   | R  | L  | F  | B  | U  | D  |
| **z2**   | D  | U  | F  | B  | R  | L  |

#### Composition
Cube rotations form the **rotation group of the cube** (the octahedral group `O`), which has **24 elements** and is isomorphic to `S₄` (permutations of the 4 body diagonals). Rotations are **non-commutative**: `y` then `x` ≠ `x` then `y`.

Composition rule: to apply rotation `A` then rotation `B`, the combined mapping is `mapping_B ∘ mapping_A` (apply A's mapping first, then B's). Equivalently, the combined quaternion is `q_B · q_A` (quaternion multiplication, B after A).

---

### 2.3 Bluetooth Cube IMU Capabilities

Verified from the project's own `gan-protocol` source code (`packages/gan-protocol/src/gan-cube-protocol.ts`) and cross-referenced with community reverse-engineering (cubing.js, gan-protocol npm).

#### GAN Smart Cubes

| Model | Protocol Gen | Gyro Supported | Orientation Data |
|:------|:------------:|:--------------:|:-----------------|
| GAN Mini ui FreePlay | Gen2 | ✅ Yes | Quaternion + angular velocity |
| GAN12 ui FreePlay | Gen2 | ✅ Yes | Quaternion + angular velocity |
| GAN12 ui | Gen2 | ✅ Yes | Quaternion + angular velocity |
| GAN356 i Carry S | Gen2 | ✅ Yes | Quaternion + angular velocity |
| GAN356 i Carry | Gen2 | ✅ Yes | Quaternion + angular velocity |
| GAN356 i 3 | Gen2 | ✅ Yes | Quaternion + angular velocity |
| Monster Go 3Ai | Gen2 | ✅ Yes | Quaternion + angular velocity |
| **GAN356 i Carry 2** | **Gen3** | **❌ No** | **None** (hardcoded `gyroSupported: false`) |
| GAN12 ui Maglev | Gen4 | ⚠️ Limited | Quaternion (only if model = `GAN12uiM`) |
| GAN14 ui FreePlay | Gen4 | ❌ No | None |

**Coordinate system (from `gan-cube-protocol.ts` line 106):**
> "Cube orientation quaternion, uses **Right-Handed coordinate system, +X - Red, +Y - Blue, +Z - White**"

The quaternion is a 16-bit signed fixed-point value per component, normalized to `[-1, 1]`. Angular velocity is a 4-bit value per axis.

**Update frequency:** ~6-7 Hz (periodic, bundled with state events). This is low but sufficient for detecting discrete 90° orientation changes (a whole-cube rotation takes 200-500ms in practice).

#### Other Manufacturers

| Manufacturer | Model | IMU | Orientation Data |
|:-------------|:------|:---:|:-----------------|
| **Giiker** (Mi Cube / M3) | — | ❌ No | Magnetic/rotational encoders only. State sync, no inertial telemetry. |
| **MoYu** (WeiLong AI) | — | ❌ Unknown | Proprietary, not supported by open-source libs. No public IMU access. |
| **Chuwen / GoCube** | Rubik's Connected | ✅ Yes (6-axis) | Quaternion, but documented drift. Not supported in this project. |

**Conclusion:** In this codebase, **only GAN Gen2 cubes** (and Gen4 `GAN12uiM`) provide usable orientation quaternions. The `gyroSupported` flag in the HARDWARE event is the definitive runtime check.

---

### 2.4 Gyroscope-Based Orientation Tracking

#### Can it be deterministic?
**Yes — with the snap-to-24-orientations approach.** The cube's rotation group has only 24 discrete elements. We do not need to track continuous orientation; we only need to know *which of the 24 orientations* the cube is currently in. This is a nearest-neighbor classification on the 4D hypersphere, not an integration/estimation problem.

#### Drift
GAN cubes use sensor fusion (accelerometer + gyroscope). The accelerometer fixes the "up" direction via gravity, eliminating roll/pitch drift. Yaw drift is bounded but present. However, because we **snap to discrete orientations**, small drift does not cause incorrect classification until the drift exceeds ~45° (half the angular distance between adjacent orientations). In practice, drift of a few degrees is absorbed by the snap.

Furthermore, the cube's internal move detection (hall sensors on each face) provides implicit calibration events — each move confirms the cube's facelet state, anchoring the orientation.

#### The Snap Algorithm
Given an observed quaternion `q_obs` and 24 reference quaternions `{q_1, ..., q_24}` (one per cube orientation):

```
bestIndex = argmax_i |dot(q_obs, q_i)|
```

We use the **absolute** dot product because `q` and `-q` represent the same rotation. If `|dot| > threshold` (e.g. 0.9, corresponding to < ~25° deviation), we accept the orientation. Otherwise, the cube is mid-rotation and we hold the last known orientation.

#### Extracting the Face Mapping
Each of the 24 quaternions corresponds to a permutation of the body axes. To find which physical face/color is currently at front/up/right:
1. Define base vectors: `Front = (0,0,1)`, `Up = (0,1,0)`, `Right = (1,0,0)`.
2. Apply the quaternion's rotation matrix `R` to these vectors.
3. The resulting vectors indicate which original face is now pointing in each direction.

> **Key insight from research:** The IMU provides the "guess"; the logical cube state (move sequence) provides the ground truth. We use the IMU only for orientation, never for state.

---

## 3. Mathematical Design

### 3.1 Representation of Orientation

We represent the cube's current orientation as an element of the 24-element rotation group. Two equivalent representations:

1. **Quaternion** (for IMU snapping): A unit quaternion `q ∈ SO(3)` that we snap to the nearest of 24 reference quaternions.
2. **Face permutation** (for move remapping): A bijection `σ: {U,D,F,B,L,R} → {U,D,F,B,L,R}` that maps each *position* to the *original face* currently occupying it.

Both are maintained in sync. The quaternion is the input (from IMU); the face permutation is the output (for move remapping).

```
type CubeOrientation = {
  quaternion: Quaternion;        // snapped, relative to calibration
  faceMap: FacePermutation;      // position → original face
  label: string;                 // e.g. "Green-Front/White-Up" (for debugging)
};
```

### 3.2 The 24 Cube Orientations

The 24 orientations are generated by composing the 9 base rotations (x, x', x2, y, y', y2, z, z', z2) and taking the closure. Equivalently, they are all permutations of the 3 axes with determinant +1 (proper rotations).

We pre-compute all 24 as a static table. Each entry contains:
- A representative quaternion (for snapping).
- The face permutation (for move remapping).
- A human-readable label.

**Generation algorithm:**
```
1. Start with identity orientation.
2. BFS/DFS: apply x, x', x2, y, y', y2, z, z', z2 to each known orientation.
3. Deduplicate by quaternion equivalence (q ≡ -q).
4. Result: exactly 24 unique orientations.
```

This is a one-time computation at module load. The table is small (24 entries × ~40 bytes each = ~1KB).

### 3.3 Face Transformation Tables

The core operation: **given a raw move (face + direction) and the current orientation, produce the display move.**

If the current orientation's face map is `σ` (position → original face), then:
- The raw move is `face_raw` (the face the cube *thinks* was turned, in the calibration frame).
- We need to find which *position* that face is currently in: `position = σ⁻¹(face_raw)`.
- The display move is `position` with the same direction.

**Example:**
- Orientation after `y` rotation: `σ = {U:U, D:D, F:R, B:L, L:F, R:B}` (position → original).
  - Position F has original R (the R face moved to F position in the y cycle: B→R→F→L→B).
  - Position L has original F (the F face moved to L position).
- Raw move: `F` (the original front face was turned).
- `σ⁻¹(F) = L` (the original F face is now in the L position, since `σ(L) = F`).
- Display move: `L` with the same direction.
- Raw move: `R` (the original right face was turned).
- `σ⁻¹(R) = F` (the original R face is now in the F position, since `σ(F) = R`).
- Display move: `F` with the same direction.

This is a **pure lookup** — O(1), no floating point, no ambiguity.

#### Full Permutation Tables for Base Rotations

For implementation, here are the `σ` (position → original face) maps for each base rotation, derived from the tables in §2.2:

```typescript
// After rotation, position → original face currently there
const ROTATION_FACE_MAPS: Record<string, Record<CubeFace, CubeFace>> = {
  identity: { U:'U', D:'D', F:'F', B:'B', L:'L', R:'R' },
  x:        { U:'F', D:'B', F:'D', B:'U', L:'L', R:'R' },
  "x'":     { U:'B', D:'F', F:'U', B:'D', L:'L', R:'R' },
  x2:       { U:'D', D:'U', F:'B', B:'F', L:'L', R:'R' },
  y:        { U:'U', D:'D', F:'R', B:'L', L:'F', R:'B' },
  "y'":     { U:'U', D:'D', F:'L', B:'R', L:'B', R:'F' },
  y2:       { U:'U', D:'D', F:'B', B:'F', L:'R', R:'L' },
  z:        { U:'L', D:'R', F:'F', B:'B', L:'D', R:'U' },
  "z'":     { U:'R', D:'L', F:'F', B:'B', L:'U', R:'D' },
  z2:       { U:'D', D:'U', F:'F', B:'B', L:'R', R:'L' },
};
```

### 3.4 Composition of Rotations

To compose rotation A (applied first) then rotation B (applied second):
```
σ_combined(position) = σ_B(σ_A(position))    // function composition
q_combined = q_B · q_A                         // quaternion multiplication (B after A)
```

This is associative and matches the group operation. The 24-orientation table is the closure under this operation.

### 3.5 Direction Preservation Proof

**Theorem:** A whole-cube rotation preserves the direction (CW/CCW/180) of every face move. Only the face label changes.

**Proof:**

A face move is a rotation of one slice by ±90° or 180° about the face's axis. A whole-cube rotation is a rigid-body rotation that moves the face's axis to a new position, but the rotation *angle and sense* about that axis are preserved because the whole-cube rotation is a proper rotation (determinant +1, no reflection).

Formally: if `M` is a face move (rotation by angle θ about axis `â`) and `R` is a whole-cube rotation, then:
```
R · M · R⁻¹ = rotation by θ about axis R(â)
```
The angle θ is unchanged. The axis `â` is mapped to `R(â)`, which corresponds to the new face position. The sign of the rotation is preserved because `R` is orientation-preserving.

**Verification with the project's own `CubeState.ts`:**

The `CubeState` class defines base moves with corner/edge permutations and orientations. A whole-cube rotation conjugates a move: `R · M_U · R⁻¹ = M_{σ⁻¹(U)}` with the *same* direction multiplier. We verified this by checking that the permutation tables for `x`, `y`, `z` in §2.2 map each face to a unique target without sign flips — the direction enum (`1`, `-1`, `2`) passes through unchanged.

**Practical consequence:** The `CubeMoveDirection` field in `CubeMoveEvent` is **never modified** by the notation transformation. Only `face` is remapped.

```typescript
function rawToDisplayMove(raw: CubeMoveEvent, orientation: CubeOrientation): DisplayMove {
  const displayFace = inverseFaceMap(orientation.faceMap, raw.face);
  return {
    face: displayFace,
    direction: raw.direction,   // ALWAYS preserved
    cubeTimestamp: raw.cubeTimestamp,
    hostTimestamp: raw.hostTimestamp,
  };
}
```

### 3.6 Reversibility and Consistency

**Reversibility:** Every orientation transformation is a bijection (permutation of 6 faces). The inverse orientation is obtained by inverting the quaternion and inverting the face map. Applying a rotation and then its inverse returns to identity — verified by the group property.

**Consistency:** The transformation is a group homomorphism. For any sequence of raw moves `M₁ M₂ ... Mₙ` and orientation `O`:
```
display(M₁ M₂ ... Mₙ, O) = display(M₁, O) display(M₂, O) ... display(Mₙ, O)
```
Each move is independently remapped. This means:
- The display notation is always consistent with the current orientation.
- If the orientation changes mid-sequence (due to a physical rotation), each move is remapped according to the orientation *at the time that move was received*.
- Historical moves retain their original display notation (they were correct at the time).

---

## 4. Architecture

### 4.1 Design Principles

1. **Separation of concerns:** Raw moves, logical state, display notation, and orientation tracking are four independent layers.
2. **Additive, not invasive:** New modules are added; existing modules are modified minimally (wiring only).
3. **Graceful degradation:** If no IMU is available, the system uses the identity orientation — zero behavior change.
4. **Single source of truth:** The `OrientationTracker` is the only component that knows the current orientation. All consumers ask it.
5. **No modification to raw data:** `CubeMoveEvent` objects from BLE are never mutated. Display moves are new objects.

### 4.2 New Modules

#### Module 1: `packages/types/src/orientation.ts`
**Responsibility:** Shared type definitions for orientation, display moves, and rotation events.

```typescript
// A permutation mapping: position → original face currently occupying it
export type FacePermutation = Record<CubeFace, CubeFace>;

// The cube's current orientation (one of 24 possible)
export interface CubeOrientation {
  quaternion: { x: number; y: number; z: number; w: number };
  faceMap: FacePermutation;
  label: string;  // e.g. "F:Green U:White R:Red" (calibration-relative)
}

// A display move — same structure as CubeMoveEvent but with remapped face
export interface DisplayMove {
  face: CubeFace;
  direction: CubeMoveDirection;
  cubeTimestamp: number;
  hostTimestamp: number;
}

// A rotation event — whole-cube rotation detected (for analysis metadata)
export interface RotationEvent {
  axis: 'x' | 'y' | 'z';
  direction: CubeMoveDirection;  // 1=CW, -1=CCW, 2=180
  timestamp: number;
  fromOrientation: CubeOrientation;
  toOrientation: CubeOrientation;
}

// Capability flags
export interface OrientationCapabilities {
  hasIMU: boolean;
  gyroSupported: boolean;
}
```

**API:** Pure types, exported from `@cubalyze/types`.

---

#### Module 2: `packages/math-core/src/orientation/OrientationTable.ts`
**Responsibility:** Pre-compute and store the 24 cube orientations with their quaternions and face maps.

```typescript
export interface OrientationEntry {
  id: number;                    // 0-23
  quaternion: Quaternion;        // Three.js Quaternion (unit)
  faceMap: FacePermutation;      // position → original face
  label: string;
}

export class OrientationTable {
  static readonly ENTRIES: OrientationEntry[];  // 24 entries
  static readonly IDENTITY: OrientationEntry;

  // Snap an observed quaternion to the nearest orientation
  static snap(q: { x: number; y: number; z: number; w: number }): {
    entry: OrientationEntry;
    confidence: number;  // |dot product|, 0..1
  };

  // Get orientation by face map (for manual/composition lookup)
  static fromFaceMap(map: FacePermutation): OrientationEntry;

  // Compose two orientations: apply A first, then B
  static compose(a: OrientationEntry, b: OrientationEntry): OrientationEntry;
}
```

**Implementation notes:**
- Uses `three` `Quaternion` (already a dependency of `math-core`).
- The 24 entries are generated at static init time via BFS over the 9 base rotations.
- `snap()` iterates 24 entries computing `|dot|` — O(24), sub-microsecond.
- No GC pressure: all entries are pre-allocated singletons.

---

#### Module 3: `packages/math-core/src/orientation/MoveTransformer.ts`
**Responsibility:** Pure functions to remap raw moves to display moves and vice versa.

```typescript
export class MoveTransformer {
  // Raw → Display: remap face according to current orientation
  static toDisplay(
    raw: CubeMoveEvent,
    orientation: CubeOrientation
  ): DisplayMove;

  // Display → Raw: inverse remap (for replay/manual input)
  static toRaw(
    display: DisplayMove,
    orientation: CubeOrientation
  ): CubeMoveEvent;

  // Remap a sequence of moves
  static toDisplaySequence(
    rawMoves: CubeMoveEvent[],
    orientation: CubeOrientation
  ): DisplayMove[];

  // Remap a scramble string (for display in current orientation)
  static remapScrambleString(
    scramble: string,
    orientation: CubeOrientation
  ): string;
}
```

**Implementation:** Pure lookups using `orientation.faceMap` and its inverse. Direction is always preserved (per §3.5).

---

#### Module 4: `packages/cube-3d-engine/src/hardware/OrientationTracker.ts`
**Responsibility:** Track the cube's current orientation by fusing IMU quaternion data. Emit orientation changes and rotation events.

```typescript
export class OrientationTracker {
  // Current orientation (identity until first confident snap)
  readonly current: CubeOrientation;

  // Observable: emits on orientation change
  readonly orientation$: Observable<CubeOrientation>;

  // Observable: emits rotation events (x/y/z) for analysis
  readonly rotationEvents$: Observable<RotationEvent>;

  // Capabilities
  readonly capabilities: OrientationCapabilities;

  constructor(options: {
    gyro$?: Observable<GyroEvent>;
    gyroSupported: boolean;
    calibrationQuaternion?: Quaternion;  // from GyroFusion calibration
  });

  // Called when GyroFusion calibrates — sets the reference frame
  setCalibration(q: { x: number; y: number; z: number; w: number }): void;

  // Called on each gyro event
  update(gyro: GyroEvent): void;

  // Reset to identity (e.g. on disconnect)
  reset(): void;

  dispose(): void;
}
```

**Algorithm:**
1. On calibration, store the calibration quaternion `q_cal`.
2. On each gyro event, compute `q_relative = q_cal⁻¹ · q_raw` (orientation relative to calibration).
3. Snap `q_relative` to the nearest of 24 orientations.
4. If confidence > threshold (0.9) AND the snapped orientation differs from current:
   - Emit a `RotationEvent` (compute the delta: which x/y/z rotation produced the change).
   - Update `current`.
   - Emit on `orientation$`.
5. If confidence < threshold, hold current orientation (cube is mid-rotation).

**Rotation event computation:** Given `from` and `to` orientations, find the shortest rotation in `{x, x', x2, y, y', y2, z, z', z2}` that transforms `from` into `to`. This is a lookup in the composition table: `delta = compose(inverse(from), to)`.

---

#### Module 5: `packages/state/src/orientation.store.ts`
**Responsibility:** Zustand store exposing the current orientation to React components.

```typescript
interface OrientationState {
  orientation: CubeOrientation;       // default: identity
  capabilities: OrientationCapabilities;
  setOrientation: (o: CubeOrientation) => void;
  setCapabilities: (c: OrientationCapabilities) => void;
  reset: () => void;
}
```

This decouples the tracker (in the 3D engine package) from the UI (in the web app). The web app subscribes to the store; the tracker updates it.

---

#### Module 6: `apps/web/src/hooks/useOrientation.ts`
**Responsibility:** React hook that connects the `OrientationTracker` to the store and provides display-move transformation to components.

```typescript
export function useOrientation(): {
  orientation: CubeOrientation;
  capabilities: OrientationCapabilities;
  // Transform a raw move to display
  toDisplay: (raw: CubeMoveEvent) => DisplayMove;
  // Transform a raw move to notation string
  toDisplayNotation: (raw: CubeMoveEvent) => string;
  // Remap a scramble string for display
  remapScramble: (scramble: string) => string;
};
```

---

### 4.3 Existing Files to Modify

#### 4.3.1 `packages/types/src/index.ts`
- **Why:** Add exports for the new orientation types.
- **What changes:** Add `export * from './orientation'` at the end.
- **Impact:** None (purely additive).

#### 4.3.2 `packages/math-core/src/index.ts`
- **Why:** Export the new orientation modules.
- **What changes:** Add `export * from './orientation/OrientationTable'` and `export * from './orientation/MoveTransformer'`.
- **Impact:** None (purely additive).

#### 4.3.3 `packages/cube-3d-engine/src/index.ts`
- **Why:** Export `OrientationTracker`.
- **What changes:** Add `export * from './hardware/OrientationTracker'`.
- **Impact:** None (purely additive).

#### 4.3.4 `packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts`
- **Why:** Expose `gyroSupported` capability after the HARDWARE event.
- **What changes:** Add a public `gyroSupported: boolean` property, set it in the `HARDWARE` event handler (line ~131). Currently the hardware info is consumed but `gyroSupported` is not surfaced.
- **Lines affected:** ~5 lines added.
- **Impact:** Minimal. The `gyro$` observable already exists; this just adds a boolean flag.

#### 4.3.5 `packages/cube-3d-engine/src/hardware/GyroFusion.ts`
- **Why:** Notify the `OrientationTracker` when calibration occurs, so the tracker can set its reference frame.
- **What changes:** Add an optional callback `onCalibrate?: (q: Quaternion) => void` that fires inside `calibrate()`. The `OrientationTracker` registers this callback.
- **Lines affected:** ~3 lines added to `calibrate()`.
- **Impact:** Minimal. The callback is optional; if not set, behavior is unchanged.

#### 4.3.6 `packages/cube-3d-engine/src/workers/EngineWorker.ts`
- **Why:** Instantiate and wire the `OrientationTracker` alongside `GyroFusion`. The tracker needs the gyro stream, which arrives via Comlink.
- **What changes:**
  - Add `private orientationTracker: OrientationTracker` field.
  - In `init()`, create the tracker (but don't connect it to a gyro stream yet — gyro events come via `updateGyro()`).
  - In `updateGyro()`, also call `orientationTracker.update()`.
  - In `calibrateGyro()`, also notify the tracker.
  - Expose a Comlink method `getOrientation()` that returns the current orientation.
- **Lines affected:** ~15 lines added.
- **Impact:** Minimal. The tracker runs in the worker thread alongside the 3D engine. It does not affect rendering.

> **Design decision:** The `OrientationTracker` lives in the **worker** (not the main thread) because the gyro stream already flows into the worker via Comlink. This avoids a second BLE→main-thread subscription.
>
> **Worker→main-thread communication:** The worker exposes a Comlink method `onOrientationChange(callback)` that accepts a `Comlink.proxy()`-wrapped callback. When the tracker detects an orientation change, it invokes this callback with the new `CubeOrientation`. The main-thread `useOrientation` hook registers this callback and forwards the update to the Zustand `orientation.store`. This is the standard Comlink pattern for worker→main-thread events (already used implicitly by the render loop).
>
> **Quaternion convention for the 24 reference quaternions:** The `OrientationTable` stores reference quaternions in the **same convention as the calibrated `GyroFusion` quaternion** — i.e., Three.js right-handed (Y-up), after the `GyroFusion.updateTargetQuaternion()` remapping (`x, z, -y, w`). The `OrientationTracker` receives the *already-remapped* quaternion from `GyroFusion` (or applies the same remapping itself), computes `q_relative = q_cal⁻¹ · q_raw`, and snaps that to the table. This ensures the reference quaternions and the observed quaternion are in the same coordinate system. The base axes are: `+X = Right (Red)`, `+Y = Up (White)`, `+Z = Front (Green)` in the calibrated frame, matching the standard Three.js cube orientation.

#### 4.3.7 `apps/web/src/components/Cube3D/Cube3DPanel.tsx`
- **Why:** The move overlay (lines 49-52, 220-230) currently displays raw notation. It must display **display notation**.
- **What changes:**
  - Import `useOrientation`.
  - Replace the notation construction (line 50):
    ```typescript
    // OLD:
    const notation = ev.face + (ev.direction === -1 ? "'" : ev.direction === 2 ? "2" : "");
    // NEW:
    const notation = orientationHook.toDisplayNotation(ev);
    ```
  - Subscribe to the orientation store to update the store when the worker reports orientation changes.
- **Lines affected:** ~10 lines changed.
- **Impact:** The move overlay now shows orientation-adapted notation. When no IMU is available, `toDisplayNotation` returns the raw notation (identity map), so behavior is unchanged.

#### 4.3.8 `apps/web/src/components/Scramble/ScrambleDisplay.tsx`
- **Why:** The scramble tokens should display in the current orientation (per user decision #1).
- **What changes:**
  - Accept an optional `displayScramble?: string` prop (the remapped scramble).
  - If provided, render `displayScramble` tokens instead of raw `scramble` tokens.
  - The **validation states** (`states[]`, `currentIndex`) still index into the **raw** scramble (validation works on raw moves internally). Only the **displayed text** changes.
- **Lines affected:** ~8 lines changed.
- **Impact:** The scramble text adapts to orientation; validation logic is untouched.

#### 4.3.9 `apps/web/src/hooks/useScrambleValidator.ts`
- **Why:** The validator works on **raw moves** (no change to validation logic). But the `errorMoves` display and the `actualMoves` tracking should optionally show display notation.
- **What changes:**
  - The validation logic (lines 244-375) is **unchanged** — it operates on raw `notation` and raw `CubeState`.
  - Add a parallel `displayActualMoves: string[]` that stores the display notation of each actual move (using `useOrientation().toDisplayNotation`).
  - Expose `displayActualMoves` and `displayErrorMoves` in the result for the UI.
- **Lines affected:** ~10 lines added (no existing lines changed).
- **Impact:** None on validation. The UI gets display-notation move lists for error display.

#### 4.3.10 `apps/web/src/hooks/useTimerUI.ts` (line 114)
- **Why:** The timer subscribes to `moves$` only to detect move activity (start/stop). It does not use the face/direction.
- **What changes:** **Nothing.** The timer only needs to know *that* a move happened, not *which* face. The subscription stays on raw moves.
- **Impact:** None.

#### 4.3.11 `apps/web/src/components/Timer/TimerContainer.tsx`
- **Why:** No direct move notation display.
- **What changes:** **Nothing.**
- **Impact:** None.

#### 4.3.12 Future: Analysis Engine (`packages/analysis-engine`)
- **Why:** Per user decision #2, the analysis engine should receive raw moves **plus** rotation events.
- **What changes:** When the analysis engine is implemented (currently just a `package.json` placeholder), it will subscribe to:
  - `moves$` (raw moves) — for TPS, pauses, method detection.
  - `orientationTracker.rotationEvents$` — for rotation counting, unnecessary-rotation detection, and reconstructing the user's perspective.
- **Impact:** None currently (package is a placeholder). This is a forward-compatible contract.

---

### 4.4 Code Removed

**No code is removed.** This is a purely additive design. The only changes to existing code are:
- Adding optional callbacks/props (backward compatible).
- Replacing raw notation construction with a call to `toDisplayNotation()` (which returns raw notation when orientation is identity).

This minimizes regression risk.

---

### 4.5 Complete Data Flow

#### Flow A: Display Notation Pipeline

```
Bluetooth (BLE)
    │
    ▼
Raw Move (CubeMoveEvent)          ← NEVER modified
    │
    ├──► SyncBridge ──► EngineWorker ──► 3D Cube (visual)
    │         │                          (rotation animation, unchanged)
    │         │
    │         └──► GyroFusion (visual orientation, unchanged)
    │
    ├──► OrientationTracker ◄── gyro$ (quaternion stream)
    │         │
    │         ▼
    │    CubeOrientation (snapped to 24)
    │         │
    │         ├──► orientation.store (Zustand)
    │         │         │
    │         │         ▼
    │         │    useOrientation() hook
    │         │         │
    │         │         ▼
    │         │    MoveTransformer.toDisplay(raw, orientation)
    │         │         │
    │         │         ▼
    │         │    DisplayMove / notation string
    │         │         │
    │         │         ├──► Cube3DPanel (move overlay)
    │         │         ├──► ScrambleDisplay (scramble tokens)
    │         │         └──► Error move display
    │         │
    │         └──► rotationEvents$ (x/y/z events)
    │                   │
    │                   ▼
    │              Analysis Engine (future)
    │
    └──► [unchanged consumers]
```

#### Flow B: Internal State Pipeline (Unchanged)

```
Bluetooth (BLE)
    │
    ▼
Raw Move (CubeMoveEvent)          ← NEVER modified
    │
    ├──► CubeState.applyMove()    ← logical state reconstruction
    │         │
    │         ▼
    │    CubeState (cp, co, ep, eo)
    │         │
    │         ├──► Scramble Validation (useScrambleValidator)
    │         │         │
    │         │         ▼
    │         │    expectedFacelets comparison (RAW, unchanged)
    │         │
    │         ├──► Min2PhaseSolver (solver engine)
    │         │         │
    │         │         ▼
    │         │    Solution (raw notation)
    │         │
    │         └──► FaceletStringConverter
    │                   │
    │                   ▼
    │              Facelet string (for DB, sync)
    │
    └──► Timer (move detection only)
```

**The two flows are completely separate.** Flow A (display) depends on Flow B (raw) for the move events but never feeds back into it. The orientation tracker is a read-only consumer of the gyro stream.

---

## 5. Compatibility Guarantees

| Concern | Guarantee |
|:--------|:----------|
| **Bluetooth protocol** | Not touched. `GanCubeAdapter`, `gan-protocol` — zero changes to BLE handling. |
| **Raw moves** | `CubeMoveEvent` objects are never mutated. `DisplayMove` is a new type. |
| **Cube state** | `CubeState.applyMove()` receives raw moves only. No orientation logic in `CubeState`. |
| **Scramble validation** | Works on raw moves and raw `CubeState`. Only the *displayed* scramble text changes. |
| **Solver** | Receives raw facelet strings. Not affected. |
| **Stored data** | DB stores raw scrambles and raw moves. No schema changes. |
| **Replay** | Can replay raw moves (unchanged) or display moves (via inverse transform). |
| **Algorithms** | Algorithm library shows raw notation (orientation-independent). Display adaptation is a UI-layer concern. |
| **Cubes without IMU** | `OrientationTracker` with `gyroSupported=false` → identity orientation. `toDisplayNotation` returns raw notation. Zero behavior change. |
| **GyroFusion (visual)** | Still works as before. The `OrientationTracker` is a *parallel* consumer of the gyro stream, not a replacement. |

---

## 6. Test Plan

### 6.1 Unit Tests — `OrientationTable`

| Test | Initial State | Input | Expected Output |
|:-----|:--------------|:------|:----------------|
| Identity snap | — | Identity quaternion (0,0,0,1) | `id=0`, confidence=1.0 |
| x snap | — | Quaternion for 90° about x-axis | `faceMap: {U:F, D:B, F:D, B:U, L:L, R:R}` |
| x' snap | — | Quaternion for -90° about x-axis | `faceMap: {U:B, D:F, F:U, B:D, L:L, R:R}` |
| x2 snap | — | Quaternion for 180° about x-axis | `faceMap: {U:D, D:U, F:B, B:F, L:L, R:R}` |
| y snap | — | Quaternion for 90° about y-axis | `faceMap: {U:U, D:D, F:R, B:L, L:F, R:B}` |
| y' snap | — | Quaternion for -90° about y-axis | `faceMap: {U:U, D:D, F:L, B:R, L:B, R:F}` |
| y2 snap | — | Quaternion for 180° about y-axis | `faceMap: {U:U, D:D, F:B, B:F, L:R, R:L}` |
| z snap | — | Quaternion for 90° about z-axis | `faceMap: {U:L, D:R, F:F, B:B, L:D, R:U}` |
| z' snap | — | Quaternion for -90° about z-axis | `faceMap: {U:R, D:L, F:F, B:B, L:U, R:D}` |
| z2 snap | — | Quaternion for 180° about z-axis | `faceMap: {U:D, D:U, F:F, B:B, L:R, R:L}` |
| 24-element closure | — | Generate all compositions | Exactly 24 unique entries |
| Compose x then y | identity | x, then y | Same as compose(x, y) entry |
| Compose y then x | identity | y, then x | Different from compose(x, y) — non-commutative |
| Snap with noise | — | Identity + 10° random rotation | Still snaps to identity, confidence > 0.95 |
| Snap mid-rotation | — | 45° about y (between y and identity) | Confidence < 0.9 (ambiguous) |

### 6.2 Unit Tests — `MoveTransformer`

| Test | Orientation | Raw Move | Expected Display |
|:-----|:-----------|:---------|:-----------------|
| Identity F | identity | F, CW | F, CW |
| Identity R' | identity | R, CCW | R, CCW |
| Identity U2 | identity | U, 180 | U, 180 |
| After y: raw F | y | F, CW | L, CW (F moved to L position) |
| After y: raw R | y | R, CW | F, CW (R moved to F position) |
| After y: raw U | y | U, CW | U, CW (U unchanged by y) |
| After y: raw F' | y | F, CCW | L, CCW (direction preserved) |
| After y: raw R2 | y | R, 180 | F, 180 (direction preserved) |
| After x: raw U | x | U, CW | B, CW (U moved to B position) |
| After x: raw F | x | F, CW | U, CW (F moved to U position) |
| After z: raw U | z | U, CW | R, CW (U moved to R position) |
| After y2: raw F | y2 | F, CW | B, CW (F↔B swap) |
| After y2: raw L | y2 | L, CW | R, CW (L↔R swap) |
| Reverse: display L after y | y | (inverse) | F, CW (round-trip) |
| Scramble remap | y | "F R U R' U'" | "L F U F' U'" |
| Scramble remap identity | identity | "R U R' U'" | "R U R' U'" (unchanged) |

### 6.3 Unit Tests — `OrientationTracker`

| Test | Setup | Input | Expected |
|:-----|:------|:------|:---------|
| No IMU | gyroSupported=false | — | Orientation stays identity forever |
| First gyro event | calibrated, gyroSupported=true | q=identity | Orientation = identity, no rotation event |
| y rotation detected | calibrated | q snaps to y | `orientation$` emits y orientation; `rotationEvents$` emits {axis:y, dir:CW} |
| x rotation detected | calibrated | q snaps to x | Emits x orientation; rotation event {axis:x, dir:CW} |
| z' rotation detected | calibrated | q snaps to z' | Emits z' orientation; rotation event {axis:z, dir:CCW} |
| y2 rotation | calibrated | q snaps to y2 | Emits y2; rotation event {axis:y, dir:180} |
| Mid-rotation hold | at y, q=45° about y | ambiguous q | Orientation stays y (no change), no rotation event |
| Sequence y then x | calibrated | q→y, then q→compose(x,y) | Two rotation events: y(CW), then x(CW). Final = compose(x,y) |
| Sequence x then y | calibrated | q→x, then q→compose(y,x) | Two rotation events: x(CW), then y(CW). Final ≠ previous test's final |
| Rapid orientation changes | calibrated | q→y→y'→y2 fast | 3 rotation events, final=y2 |
| Gyro loss | at y, gyro$ stops | — | Orientation stays y (last known) |
| Gyro reconnect | at y, gyro$ resumes | q→identity | Emits identity, rotation event y'(CCW) or equivalent |
| Reset | at y | reset() | Orientation = identity |
| Calibration changes | at y, recalibrate | new q_cal | Orientation recomputed relative to new calibration |

### 6.4 Integration Tests

| Test | Scenario | Expected |
|:-----|:---------|:---------|
| Full pipeline: IMU + move | Calibrate (green=F, white=U), rotate y, turn original-F face | 3D shows rotation; move overlay shows "L" (not "F"); scramble validation still works on raw "F" |
| Scramble display adapts | Generate scramble "R U R' U'", rotate y, check display | Display shows "F U F' U'" (R→F, U→U per y map) |
| Scramble validation unaffected | Start scramble, rotate cube during scrambling | Validation still tracks raw moves correctly; display shows adapted notation |
| No IMU cube | Connect GAN356 i Carry 2 (gyroSupported=false) | All notation is raw (identity); zero behavior change vs. current system |
| Timer unaffected | Rotate cube during solve | Timer start/stop unaffected; move detection works on raw moves |
| Solver unaffected | Solve a cube, rotate during solve | Solver receives raw facelets; solution in raw notation |
| DB storage unaffected | Complete a solve after rotating | Stored scramble and moves are raw; no schema change |
| GyroFusion visual unaffected | Calibrate, rotate | 3D cube visually rotates as before (GyroFusion unchanged) |

### 6.5 Edge Cases

| Case | Expected Behavior |
|:-----|:------------------|
| Cube disconnected mid-rotation | Orientation holds at last known; resets to identity on reconnect+recalibrate |
| Gyro data corrupted (non-unit quaternion) | `snap()` normalizes; if still garbage, confidence < threshold, orientation holds |
| Very fast rotations (flick) | Multiple rotation events emitted in sequence; final orientation correct |
| Rotation during scramble application | Display adapts; validation tracks raw moves |
| All 24 orientations visited | Each produces correct display remapping; no duplicates; round-trip reversible |
| Quaternion sign flip (q vs -q) | `snap()` uses absolute dot product; handles correctly |

### 6.6 Mathematical Equivalence Verification

A property-based test: for **all 24 orientations** and **all 18 moves** (6 faces × 3 directions):
1. `toRaw(toDisplay(move, O), O) === move` (round-trip reversibility).
2. `toDisplay(move, O).direction === move.direction` (direction preservation).
3. `toDisplay(move, identity) === move` (identity is no-op).
4. `toDisplay(toDisplay(move, A), B) === toDisplay(move, compose(A, B))` (composition homomorphism).

These properties are tested with a fast-check / property-based test runner over the 24×18 = 432 combinations.

---

## 7. Implementation Phases

### Phase 1: Core Math (no UI changes)
- `packages/types/src/orientation.ts` — type definitions
- `packages/math-core/src/orientation/OrientationTable.ts` — 24-orientation table + snap
- `packages/math-core/src/orientation/MoveTransformer.ts` — move remapping
- Unit tests for all three (§6.1, §6.2)
- **Validation:** `pnpm --filter @cubalyze/math-core test`

### Phase 2: Orientation Tracker (no UI changes)
- `packages/cube-3d-engine/src/hardware/OrientationTracker.ts`
- Wire into `EngineWorker.ts` (instantiate, feed gyro events, expose via Comlink)
- Unit tests for tracker (§6.3)
- **Validation:** `pnpm --filter @cubalyze/cube-3d-engine test`

### Phase 3: State + Hooks
- `packages/state/src/orientation.store.ts`
- `apps/web/src/hooks/useOrientation.ts`
- Wire `GanCubeAdapter.gyroSupported` flag
- Wire `GyroFusion.calibrate()` callback to tracker
- **Validation:** `pnpm --filter @cubalyze/state test` + `pnpm --filter web typecheck`

### Phase 4: UI Integration
- `Cube3DPanel.tsx` — use `toDisplayNotation` for move overlay
- `ScrambleDisplay.tsx` — accept and render `displayScramble`
- `useScrambleValidator.ts` — add `displayActualMoves`/`displayErrorMoves`
- **Validation:** `pnpm --filter web typecheck` + `pnpm --filter web lint` + manual browser test

### Phase 5: Integration Tests
- Write integration tests (§6.4)
- Property-based tests (§6.6)
- **Validation:** `pnpm test`

### Phase 6: Review & Polish
- Code review
- Edge case testing with real hardware
- Performance profiling (snap() in render loop)

---

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|:-----|:----------:|:------:|:-----------|
| IMU drift causes wrong orientation | Medium | High (wrong notation) | Snap to 24 discrete orientations absorbs drift up to ~25°. Calibration resets drift. Move events provide implicit re-anchoring. |
| 6-7 Hz gyro rate too slow | Low | Medium | Whole-cube rotations take 200-500ms; 6-7 Hz captures at least 1-3 samples per rotation. Confidence threshold prevents false positives. |
| Worker communication latency | Low | Low | Orientation updates are async; UI updates within 1 frame. Move display is computed in the main thread from the store (no worker round-trip per move). |
| Breaking scramble validation | Very Low | Critical | Validation logic is untouched. Only display text changes. Extensive integration tests. |
| Performance regression | Very Low | Low | Snap is O(24) sub-microsecond. No new allocations in hot path. |
| Non-GAN cubes | N/A | N/A | Only GAN is supported in this codebase. Other adapters would need their own gyro$ implementation. |

---

## 9. References

1. **WCA Regulations, Article 12 — Notation.** `docs/wca.md` (lines 517-545). Version April 1, 2026, commit `415be08`. [Online](https://www.worldcubeassociation.org/regulations/#article-12-notation).
2. **Singmaster, David.** *Notes on Rubik's Magic Cube.* — foundational notation system.
3. **Kociemba, Herbert.** [kociemba.org](https://kociemba.org/) — Two-Phase algorithm, cube group theory.
4. **Rotation group of the cube.** [Math StackExchange](https://math.stackexchange.com/questions/46038/proof-that-cube-has-24-rotational-symmetries). The 24-element octahedral group `O ≅ S₄`.
5. **GAN protocol reverse engineering.** `packages/gan-protocol/src/gan-cube-protocol.ts` — coordinate system: `+X=Red, +Y=Blue, +Z=White` (line 106). Quaternion parsing (lines 350-367, 1083-1100).
6. **cubing.js.** [GitHub: cubing/cubing.js](https://github.com/cubing/cubing.js) — smart cube protocol implementations, quaternion handling.
7. **Quaternion snap to 24 cube orientations.** [StackOverflow](https://stackoverflow.com/questions/70755388/how-to-calculate-the-quaternions-of-all-24-rotations-of-a-cube).
8. **Project source: `GyroFusion.ts`.** `packages/cube-3d-engine/src/hardware/GyroFusion.ts` — existing calibration and SLERP fusion logic.
9. **Project source: `CubeState.ts`.** `packages/math-core/src/CubeState.ts` — Kociemba move tables, used to verify direction preservation.
10. **Project source: `FACE_ROTATION_MAP`.** `packages/cube-3d-engine/src/constants/faceRotation.ts` — axis/layer/sign conventions for 3D rendering.

---

*End of document.*
