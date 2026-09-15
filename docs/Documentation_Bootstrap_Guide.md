# Cubalyze Documentation Bootstrap Guide

**Version**: 1.0
**Role**: Principal Software Architect & Documentation Architect
**Purpose**: This document is the definitive, authoritative guide for the entire Cubalyze repository. It dictates how the project is organized, how architectural decisions are made, how AI agents must operate, and the strict lifecycle of every document. 

---

## 1. Single Source of Truth Philosophy

Cubalyze operates under a strict **Single Source of Truth (SSoT)** philosophy:
- **No Duplication**: Information must exist in exactly one place. If a document needs to reference information from another, it must link to it, never copy it.
- **Clear Ownership**: Every document or directory has a designated owner (e.g., Product Owner, Principal Architect, Developer).
- **Immutable History**: Once a phase is complete or an architecture decision is approved, it is immutable unless formally superseded.

## 2. Repository & Documentation Architecture

The `docs/` directory is the brain of the project. Do not create new directories unless explicitly required for scalability.

| Directory | Purpose | Owner | Lifecycle |
|---|---|---|---|
| `00-product/` | Vision, PRD, Competitive Analysis. Defines *Why* and *What*. | Product Owner | Living document. Updated when business requirements change. |
| `01-roadmap/` | Master Roadmap. Defines *When* and sequence. | Tech Lead / PM | Living document. Sequence changes require review. Do not fragment prematurely. |
| `02-architecture/`| High-level system diagrams and overarching SAD. | Principal Architect | Updated during major architectural shifts. |
| `03-adr/` | Architecture Decision Records. Defines *Which* technologies/patterns are selected. | Principal Architect | Immutable once approved. Superseded by new ADRs if needed. |
| `04-rfc/` | Requests for Comments. Used when an architectural decision requires research. | Any Contributor | Temporary state. Once resolved, yields an ADR or is archived. |
| `05-tdd/` | Technical Design Documents. Defines *How* atomic phases are implemented. | Engineering | Immutable snapshot per phase. The code becomes the SSoT post-implementation. |
| `06-api/` | API Contracts and definitions. | API Architect | Generated or manually curated. Living document tied to code. |
| `07-database/` | Database schemas and migration strategies. | Data Architect | Living document. |
| `08-standards/` | Engineering and governance rules (Coding, Git, Security). | Principal Architect | Living document. Strictly enforced in CI and by AI. |
| `09-testing/` | Test plans, QA strategies, and test data generators. | QA Lead | Living document. |
| `10-security/` | Threat models, security audits, and policies. | Security Lead | Living document. |
| `11-devops/` | CI/CD, deployment pipelines, infrastructure as code. | DevOps Architect | Living document. |
| `12-sdk/` | Documentation for public SDKs (e.g., smart cube plugins). | DevRel / SDK Team | Tied to SDK versioning. |
| `13-plugins/` | Documentation for first/third-party plugins (methods, trainers). | Plugin Architect | Tied to core platform versions. |
| `14-ai/` | Operating manuals for AI coding assistants (`AGENTS.md`). | AI Workflow Arch. | Strictly enforced. |
| `15-contributing/`| Contributor guides, code of conduct, PR templates. | OS Maintainer | Living document. |
| `16-user/` | End-user manuals and help center content. | Tech Writer | Living document tied to releases. |
| `17-releases/` | Changelogs and release notes. | Release Manager | Append-only. |
| `18-archive/` | Deprecated documents, old RFCs, obsolete ADRs. | N/A | Immutable graveyard. |

### Empty Directories Rule
Do not populate `05-tdd`, `06-api`, `07-database`, `12-sdk`, or `13-plugins` with placeholder files. They must remain empty until the Master Roadmap dictates the execution of their corresponding atomic phases.

## 3. Engineering Governance

The project relies on strict standards located in `docs/08-standards/`. These must be defined before the first line of code is written:
- **Coding Standards**: Linting, formatting, language rules (e.g., TypeScript strictness).
- **Testing Standards**: Unit, E2E, integration boundaries.
- **Git Workflow & Branching Strategy**: Protected branches, feature branches.
- **Commit Convention**: Enforcing Conventional Commits.
- **Pull Request Guidelines**: Review processes, required approvals.
- **Versioning Strategy**: Semantic Versioning applied to modules.
- **Performance & Security Standards**: Budgets for latency, FPS, and threat prevention.
- **AI Development Standards**: Rules for AI-human collaboration.

## 4. Architecture Decision Process

Technical decisions are not made on the fly. 
- If a technology choice is clear or mandated by the PRD (e.g., Web Bluetooth, min2phase), create an **ADR** immediately to codify it.
- If a technology requires exploration (e.g., Tauri vs. Electron for Desktop, Nx vs. Turborepo for Monorepo), create an **RFC**. Do not create an ADR until the RFC is resolved.

## 5. The Implementation Pipeline

Every feature follows this strict, mandatory workflow. Skipping steps is forbidden.

1. **Idea / Requirement**: Documented in the `PRD`.
2. **Scheduling**: Slotted into the `Master_Roadmap` as an Atomic Phase.
3. **Architecture Check**: Is a new technology required? 
   - Yes, requires research $\rightarrow$ `RFC` $\rightarrow$ `ADR`.
   - Yes, decision clear $\rightarrow$ `ADR`.
4. **Technical Design**: Engineering authors a `TDD` for the Atomic Phase.
5. **Quality Gate (Definition of Ready)**: TDD is reviewed and approved.
6. **Implementation**: Code is written strictly following the TDD and `08-standards`.
7. **Validation**: Automated tests pass, manual QA succeeds.
8. **Documentation Update**: APIs, Database schemas, or User docs are updated synchronously.
9. **Quality Gate (Definition of Done)**: PR Review, CI pass.
10. **Merge & Release**: Merged to main, release notes generated.

## 6. AI Development Ecosystem

Cubalyze is an AI-first repository. AI agents must operate deterministically:
- **CodeGraph Mandate**: Agents must explore the repository using CodeGraph before writing code to verify existing structures.
- **Read-Before-Write**: Agents must read the PRD, the specific TDD, and relevant ADRs before modifying the codebase.
- **No Hallucination**: Agents must never bypass the documentation pipeline or implement features without an approved TDD.

For full rules, see `docs/14-ai/AGENTS.md`.

## 7. Open Source Workflow

The repository is prepared for open-source scale. The following files at the root or `.github` level provide long-term value:
- `README.md`: The front door for users and developers.
- `CONTRIBUTING.md`: How to join the project.
- `CODE_OF_CONDUCT.md`: Behavioral expectations.
- `.github/ISSUE_TEMPLATE/`: Bug and Feature request structures.
- `.github/pull_request_template.md`: Quality enforcement at the PR level.

Other files (e.g., `FUNDING.md`, `GOVERNANCE.md`) will be deferred until the community reaches a critical mass, avoiding premature bureaucracy.

## 8. Project Initialization Checklist

Before beginning TDD authoring for Phase 1.1, the following must be cleared:

### Critical Blockers
- [x] Documentation Bootstrap Guide generated.
- [ ] Core Engineering Standards created (`08-standards/`).
- [ ] AI Operations Manual expanded (`AGENTS.md`).
- [ ] Finalize Architecture Decisions via ADRs (Monorepo, Frontend Framework, Database).

### Required
- [ ] Issue and PR templates created.
- [ ] Open Source governance stubs (`README`, `CONTRIBUTING`, `CODE_OF_CONDUCT`) established.

### Recommended (Deferrable until Phase 1.1)
- [ ] CI/CD pipeline skeleton established.

---
*This guide marks the completion of the Pre-Development Phase.*
