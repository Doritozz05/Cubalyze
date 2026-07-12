# Architecture Lifecycle

This document defines the complete flow of an architectural decision from inception to implementation. It serves as the governance rulebook for how technical ideas evolve into production code.

---

## 1. Idea & Product Requirements (PRD)
**Owner**: Product Owner / Lead Architect
**Purpose**: Define the *what* and *why*.
- **Inputs**: Feature request, user feedback, or technical debt identified.
- **Outputs**: PRD (Product Requirements Document) updated.
- **Rules**: No technical implementation details are allowed here. Only what the user needs and the domain constraints.

## 2. Architecture Research
**Owner**: Exploring Engineer / AI Agent
**Purpose**: Systematically eliminate technical uncertainty. 
- **Inputs**: PRD, Domain Knowledge.
- **Outputs**: A Research Report, Prototype, or Benchmark located in `02-architecture/research/`.
- **Rules**: Research must answer specific questions outlined in the Architecture Research Roadmap. This phase is purely exploratory.

## 3. RFC (Request for Comments)
**Owner**: Lead Architect / Proposing Engineer
**Purpose**: Propose a specific technical solution based on the research.
- **Inputs**: Completed Research Report, Benchmarks.
- **Outputs**: An RFC document in `04-rfc/`.
- **Rules**: The RFC must list alternatives considered, trade-offs, and an expected implementation plan. It is open for debate.

## 4. ADR (Architecture Decision Record)
**Owner**: Lead Architect (Approver)
**Purpose**: Formally record the final, immutable decision.
- **Inputs**: Approved RFC.
- **Outputs**: An ADR document in `03-adr/`.
- **Rules**: Once an ADR is merged, the decision is locked. Any changes to this decision require a new RFC and a new ADR deprecating the old one.

## 5. Architecture Overview Update
**Owner**: Lead Architect
**Purpose**: Keep the "Current State of Truth" accurate.
- **Inputs**: New ADR.
- **Outputs**: Updated documents in `02-architecture/overview/` and `02-architecture/diagrams/`.
- **Rules**: Overviews and diagrams must instantly reflect the new ADR. If they go out of sync, the documentation fails.

## 6. TDD (Technical Design Document)
**Owner**: Implementing Engineer
**Purpose**: Map out the exact module-level implementation plan.
- **Inputs**: ADR, Architecture Overview.
- **Outputs**: A TDD document in `05-tdd/`.
- **Rules**: No architectural decisions are made here. Only software design (classes, interfaces, database schemas).

## 7. Implementation & Release
**Owner**: Engineering Team
**Purpose**: Write production code.
- **Inputs**: TDD.
- **Outputs**: Pull Requests, merged code, and Release Notes.
- **Rules**: Implementation must strictly follow the TDD. Deviations require updating the TDD.
