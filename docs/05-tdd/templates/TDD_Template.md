---
id: tdd-[nnn]
title: "[Feature or Component Name]"
type: tdd
status: draft # Options: draft, review, approved, implemented, obsolete
related_roadmap_phase: "[Epic/Phase ID]"
related_adrs: ["[ADR-NNN]"]
author: "[Author Name or Agent ID]"
date: "YYYY-MM-DD"
---

# TDD-[NNN]: [Feature Name]

## 1. Context & Scope
Provide a brief summary of what is being built, why it's needed, and what the scope of this implementation is.

## 2. Requirements
### 2.1 Functional Requirements
- What must the system do?

### 2.2 Non-Functional Requirements
- Performance, scaling, security constraints.

## 3. Proposed Solution
Detail the technical approach. How are the components interacting? What patterns are being used?

## 4. Data Model / State Changes
- Detail any changes to the database schema.
- Detail any changes to the global application state (Redux/Zustand).

## 5. API Interface Changes
List any new API endpoints, GraphQL mutations, or changes to existing payloads.

## 6. Security & Privacy
- Are there new attack vectors?
- How is PII handled?

## 7. Testing Strategy
- Unit test targets.
- Integration test targets.

## 8. Rollout Plan
- Are there migration scripts needed?
- Will this be behind a feature flag?
