# TDD 0004: Advanced WCA Timer Engine

## 1. Overview
This document outlines the headless timer logic that governs professional WCA-standard solve tracking (Epic 1.4). It incorporates advanced interaction states typical of Stackmat timers and community standards (e.g. csTimer).

## 2. Architecture Decisions
- **Core Technology**: Native JavaScript `performance.now()` for sub-millisecond precision.
- **Paradigm**: Finite State Machine (FSM).
- **Decoupling**: Strictly independent of any UI framework. Emits events for the frontend to consume.

## 3. Finite State Machine (FSM)
The timer transitions through standard WCA states including micro-states for hardware validation:
- `IDLE`: Neutral state. Waiting for inspection or action.
- `INSPECTION`: 15 seconds countdown. The engine emits warnings at 8000ms and 12000ms.
- `TOUCHING`: User placed hands on timer/spacebar. A verification delay (e.g., 300ms) begins. If hands are lifted before the delay completes, timer reverts to IDLE or INSPECTION.
- `READY`: The verification delay passed (Green Light). Engine is armed.
- `RUNNING`: User released hands. Timer is actively ticking.
- `STOPPED`: User placed hands back. Solve time is recorded.
- `COOLDOWN`: A temporary block (e.g., 500ms) after stopping to ignore ghost inputs or accidental resets.

## 4. WCA Rules Implementation
- **Inspection**: Emits events at 8s and 12s for audio calls.
- **Penalties**: Applies penalties dynamically (+2, DNF) if inspection transitions beyond 15s/17s.
- **Modifiers**: Accepts manual post-solve modifiers for +2 or DNF if judge enforces a penalty.

## 5. Interfaces
- `TimerConfig`: `{ useInspection: boolean; holdToStartDelay: number; cooldownDelay: number; }`
- `TimerEngine`: Class exposing `handleDown()`, `handleUp()`, `addModifier()`, `reset()`.
- Uses an event emitter to broadcast `onStateChange`, `onInspectionWarning`, `onPenaltyApplied`.
