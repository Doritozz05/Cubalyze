# AGENTS.md: Central Operating Manual for AI Agents

**Role**: AI Workflow Architect
**Purpose**: This is the supreme operating manual for all AI agents (including Antigravity, OpenCode, and future assistants) operating within the CubeForge repository. It enforces deterministic execution and strict engineering governance.

---

## 1. Mandatory CodeGraph Usage

CubeForge is a large, complex repository. **You must never guess or hallucinate the repository structure or file locations.**
- You **MUST** use CodeGraph tools (`codegraph_explore`, `codegraph_node`) to explore the repository, locate code, and understand the project structure before modifying or reading files.
- Fallback: If CodeGraph MCP tools are unavailable, use the shell command equivalent (`codegraph explore ...`).

## 2. Documentation Reading Order

Before writing *any* code or proposing a plan, you must build context by reading the documentation in this strict order:
1. **Product Requirements Document (`docs/00-product/PRD.md`)**: To understand the *Why* and *What*.
2. **Master Roadmap (`docs/01-roadmap/Master_Roadmap.md`)**: To understand the *When* and phase isolation.
3. **Architecture Decision Records (`docs/03-adr/`)**: To understand the specific technologies required for the feature.
4. **Technical Design Document (`docs/05-tdd/`)**: To understand the exact *How*. **You must not proceed without a TDD.**
5. **Engineering Standards (`docs/08-standards/`)**: To ensure your code complies with project rules.

## 3. The Implementation Pipeline

You must follow the strictly defined pipeline for any feature development:
1. Ensure the feature has an approved **TDD**. If not, request the user to approve a TDD creation phase.
2. Ensure there are no unresolved **RFCs** blocking your feature.
3. Write the code according to the TDD.
4. Write corresponding **Unit Tests** or **Integration Tests**.
5. Update `docs/06-api/` or `docs/07-database/` if your code alters public interfaces or schemas.
6. Verify your changes via local CI scripts (linting, testing).

## 4. Forbidden Behaviors

To maintain the Single Source of Truth and architectural integrity, the following actions are strictly forbidden:
- 🚫 **Do NOT write product code without a TDD.**
- 🚫 **Do NOT install new dependencies** without an explicit instruction in an ADR or TDD.
- 🚫 **Do NOT create empty placeholder documents** (especially in `05-tdd`, `06-api`, `07-database`, `12-sdk`, `13-plugins`) unless executing their specific roadmap phase.
- 🚫 **Do NOT duplicate documentation**. Link instead of copy.
- 🚫 **Do NOT ignore failing tests.** If you break a test, you must fix it or adjust it if the requirement legally changed per the TDD.
- 🚫 **Do NOT remove existing docstrings or comments** unless they are factually incorrect based on your new code.

## 5. Authoritative vs. Exploratory Documents

AI Agents must treat documents differently depending on their location in the lifecycle:
- **Authoritative** (Treat as absolute truth. Update synchronously with code changes):
  - `00-product/` (PRD)
  - `01-roadmap/` (Master Roadmap)
  - `02-architecture/overview/`
  - `03-adr/`
  - `05-tdd/`
  - `06-api/` & `07-database/`
- **Exploratory / Historical** (Read-only context. Do NOT treat as final decisions):
  - `02-architecture/research/`
  - `04-rfc/`
  - `18-archive/`

## 6. Coding & Architecture Boundaries

- **Local-First Priority**: Do not introduce network dependencies unless building explicit cloud-sync modules.
- **Modularity**: Respect the boundaries defined in the TDD. Do not mix UI rendering logic with Math Core logic.
- **Hardware Abstraction**: All smart cube interactions must pass through the defined HAL (Hardware Abstraction Layer). Never interact directly with BLE adapters from UI components.

## 7. TDD and ADR Workflow

If you are asked to design a system (acting as an Architect):
- **For Technologies**: Create an `RFC` if research is needed. Create an `ADR` only if the decision is final and approved by the user.
- **For Implementation**: Author a `TDD` explaining the specific files, schemas, and interfaces that will be created. Request user approval before writing the implementation code.

## 8. Quality Gates

Your work is subject to strict Quality Gates:
- **Definition of Ready (DoR)**: A task is ready for AI coding ONLY when a complete TDD exists, all dependencies in the Master Roadmap are met, and relevant ADRs are approved.
- **Definition of Done (DoD)**: A task is done ONLY when the code exactly matches the TDD, all unit tests pass, linters output zero errors, and documentation (API/Database) is synchronously updated.
