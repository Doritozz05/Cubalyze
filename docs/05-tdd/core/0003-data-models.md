# TDD 0003: Core Data Model Implementation

## 1. Overview
This document outlines the schemas and interfaces for the foundational data models in CubeForge (Epic 1.3).

## 2. Architecture Decisions
- **Validation Library**: `Zod` (selected for TypeScript-first validation and schema inference).
- **Entities**:
  - `User`: Represents a cuber's profile.
  - `Solve`: Represents a single execution (time, penalties, scramble, date).
  - `Session`: A collection of solves (Ao5, Ao12 contexts).
  - `Algorithm`: Represents a specific case (OLL, PLL) and its standard moves.

## 3. Schemas
- `SolveSchema`: Must include fields for `timeMs`, `penalty` (none, +2, DNF), `scramble`, `timestamp`, and `sessionId`.
- `SessionSchema`: Must include a collection of `Solve` references or embedded documents.

## 4. Validation Rules
- `timeMs` must be a positive integer.
- `penalty` is an enum: `'NONE' | '+2' | 'DNF'`.
- `timestamp` should be ISO 8601 strings or Unix epochs.

## 5. Security & Constraints
- Models must not contain database-specific ObjectIds to remain agnostic.
- Strict type checking ensures invalid data never enters the state layer.
