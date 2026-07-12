# TDD 0004: Base Timer Engine

## 1. Overview
This document outlines the headless timer logic that governs manual solve tracking (Epic 1.4).

## 2. Architecture Decisions
- **Core Technology**: Native JavaScript `performance.now()` for sub-millisecond precision.
- **Paradigm**: Finite State Machine (FSM).
- **Decoupling**: Strictly independent of any UI framework. Emits events for the frontend to consume.

## 3. Finite State Machine (FSM)
The timer transitions through standard WCA states:
- `IDLE`: Waiting to start.
- `INSPECTION`: 15 seconds countdown.
- `INSPECTION_PENALTY`: Transitioning beyond 15s leads to +2, and beyond 17s to DNF.
- `READY`: Hands placed (simulated), ready to start the timer.
- `RUNNING`: Timer is actively ticking.
- `STOPPED`: Timer has ended, final time is calculated.

## 4. WCA Rules Implementation
- Handling the 15-second inspection window strictly.
- Applying penalties dynamically (+2, DNF) based on state transitions or user input.

## 5. Interfaces
- `TimerEngine`: Class that exposes `start()`, `stop()`, `startInspection()`, `reset()`.
- Uses an event emitter or callback mechanism (`onTick`, `onStateChange`) to broadcast changes without direct DOM manipulation.
