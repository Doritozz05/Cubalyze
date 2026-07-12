# Technical Design Documents (TDD)

## Purpose
This directory contains the detailed implementation plans (Technical Design Documents) for specific features, modules, or services. TDDs translate architectural decisions (ADRs) into concrete software designs (classes, APIs, database schemas) before coding begins.

## Scalability Governance
To prevent folder bloat as the project scales to hundreds of TDDs, all new documents **MUST** be placed in a domain-based subdirectory. Do not place files directly in the root of this folder.
- Example: `../05-tdd/frontend/0001-timer-component.md`
- Example: `../05-tdd/backend/0002-solve-ingest-service.md`

## Governance
Please refer to `[Architecture & Documentation Standards](../08-standards/Architecture_and_Documentation_Standards.md)` for rules regarding documents in this folder.
