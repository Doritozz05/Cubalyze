# Architecture & Documentation Standards

**Owner**: Principal Architect
**Lifecycle**: Living Document

## Purpose
To define how architecture is designed, documented, and enforced. This includes strict governance, naming conventions, metadata requirements, and document lifecycle rules.

## Documentation Governance

1. **Single Source of Truth**: Never duplicate architectural requirements or knowledge. Always link to the definitive document.
2. **No Duplicated Information**: If knowledge exists in one place, link to it. Do not paraphrase.
3. **Overview Reflects Approved ADRs Only**: The `02-architecture/overview/` directory must only contain systems that have an approved ADR.
4. **Research Never Contains Final Decisions**: Research documents (`02-architecture/research/`) provide data, findings, and options. They recommend, but never decide. Decisions happen in ADRs.
5. **RFCs Expire After Approval/Rejection**: An RFC is a temporary proposal. Once it is resolved, it must be marked as Accepted, Rejected, or Abandoned.
6. **ADRs are Immutable**: Once an ADR is Accepted, its core decision cannot be changed. If a new decision is made, write a *new* ADR that `supersedes` the old one.
7. **TDDs Follow ADRs**: Technical Design Documents (`05-tdd`) cannot contradict ADRs. They implement the how, not the what/why.
8. **Validation Never Contains Architecture Decisions**: Validation reports just show data (e.g., benchmark numbers).
9. **Single Responsibility**: Every document must have one single, clear responsibility.

## Standardized Metadata

Every document in the ecosystem MUST start with a YAML frontmatter block. This enables AI agents and humans to understand the document context instantly.

Required fields vary by document type, but universally include:

```yaml
---
status: "[Draft | Active | Deprecated ...]"
owner: "[Name or Team]"
last_updated: "[YYYY-MM-DD]"
document_type: "[ADR | RFC | TDD | Research | ...]"
---
```

Refer to `docs/_templates/` for the exact metadata block required for each document type.

## Naming Conventions

Filenames must be strict, predictable, and devoid of ambiguity.

* **Research**: `[Technology_or_Topic]_Research.md` (e.g., `Web_Bluetooth_Research.md`)
* **ADR**: `ADR-[0000]-[Topic].md` (e.g., `ADR-0001-Turborepo.md`)
* **RFC**: `RFC-[0000]-[Topic].md` (e.g., `RFC-0001-Plugin_System.md`)
* **TDD**: `TDD-[Epic/Module]-[Component].md` (e.g., `TDD-Epic01-HAL.md`)
* **Validation**: `[Technology]_Validation_Report.md` or `[Technology]_Benchmark_Report.md` (e.g., `SQLite_Benchmark_Report.md`)

No generic names like `notes.md`, `architecture.md`, or `draft.md`.

## Document Lifecycle

Each document type has a defined lifecycle:

| Document Type | Purpose | Inputs | Outputs/Produces | Consumers | Lifecycle / Archiving |
|---|---|---|---|---|---|
| **Research** | Investigate a specific technical question or unknown. | Questions, PRD, Technical risks | RFCs or ADRs | Architects, Engineers | Becomes `Obsolete` when the decision is made. Does not move. |
| **Validation** | Prove a hypothesis via code/data. | Research hypotheses | Hard data, Validation Reports | Architects | Archival after ADR approval. |
| **RFC** | Propose a change to the system. | Research findings | ADRs | The team (for comment) | Expires after Acceptance/Rejection. |
| **ADR** | Record a formal architectural decision. | RFCs, Validation | TDDs, Architecture Overview | Everyone | Immutable. Can only be `Superseded` by a new ADR. |
| **TDD** | Detail how an ADR will be implemented in code. | ADRs | Code, API Specs | Engineers | `Implemented` when code ships. Updated alongside code. |
| **Overview** | The current, actual state of the system. | ADRs, Code | N/A | New contributors, AI Agents | Living document. Updated when ADRs are implemented. |

## Architecture Standards

1. **Modularity**: Components must be decoupled.
2. **Offline-First Priority**: No feature should fundamentally require an active network connection unless it is an explicit feature.
3. **Immutability**: Event streams (like Bluetooth moves) are immutable logs. Never rewrite history.
