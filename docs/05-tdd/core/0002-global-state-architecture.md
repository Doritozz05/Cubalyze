# TDD 0002: Global State Architecture

## 1. Overview
This document outlines the architecture for the global state management within the Cubalyze application (Epic 1.2).

## 2. Architecture Decisions
- **Library**: `Zustand` (selected for minimal boilerplate, headless nature, and ease of decoupling from UI).
- **Offline-First Paradigm**: The state store must act as the ultimate source of truth locally. Changes are synchronously applied to the local store, and asynchronously synced to persistent storage/cloud.
- **Modularity**: State is split into granular stores (e.g., TimerStore, SessionStore) to prevent unnecessary re-renders in the frontend and to enforce clear boundaries.

## 3. Data Flow
1. **Action/Event**: A module (e.g., timer, bluetooth) dispatches an action.
2. **State Mutation**: Zustand updates the internal state.
3. **Persistence Middleware**: A middleware intercepts specific state changes and persists them to IndexedDB or LocalStorage.
4. **Subscription**: UI components (or headless listeners) react to the state change.

## 4. Key Interfaces
- `StateCreator`: Standard Zustand interfaces for type-safe state building.
- Middleware adapters for logging and local persistence.

## 5. Security & Constraints
- Sensitive user data must not be persisted in plain text if local storage is used without explicit encryption.
- The state package must remain framework-agnostic (no React-specific code inside `@cubalyze/state`).
