---
status: "Draft"
owner: "Principal Architect"
last_updated: "2026-07-12"
document_type: "Architecture Overview"
---

# System Architecture Overview

This document acts as the Current State of Truth for the technical stack and implementation details of CubeForge. All decisions here must trace back to approved ADRs.

## 1. Frontend Client
- **Web App**: Component-based SPA, Progressive Web App (PWA).
- **Mobile App**: React Native or Flutter.
- **Desktop App**: Tauri / Electron.
- **Local Storage**: IndexedDB (web) / SQLite (mobile/desktop).

## 2. Backend Services
- **API Gateway**: Node.js microservices / modular monolith.
- **Database**: PostgreSQL (relational profile data) via Supabase.
- **Time-series DB**: For event storage.

## 3. Core Engines
- **Mathematical Solver Engine**: WASM / JS port of min2phase.
- **3D Engine**: WebGL via three.js or cubing.js `<twisty-player>`.
- **Training Algorithm**: Spaced Repetition System (e.g., SM-2).

## 4. Hardware Abstraction Layer
- **Protocol Stack**: Web Bluetooth API.
- **Clock Drift**: Linear regression time adjustment technique for hardware timers.

## 5. Synchronization
- **Methodology**: Event-based offline-first sync.
- **Conflict Resolution**: Last-write-wins with vector versioning / CRDTs for collaborative features.

## 6. AI Engine
- **Implementation**: RAG pipeline connected to LLM backend (e.g. OpenAI/Anthropic/Local).
- **Format**: JSON-parsed deterministic outputs for structured coaching.
