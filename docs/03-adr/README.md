# Architecture Decision Records (ADR)

This directory contains the finalized, immutable architectural decisions for the CubeForge project. 

## Workflow
- ADRs are **NOT** generated speculatively.
- An ADR is only created when an architecture decision is **finalized** and **approved**.
- If a technology requires research or team discussion, create a Request for Comments (RFC) in `../04-rfc/` first. Only convert it to an ADR once the RFC is resolved.
- If a technology is explicitly mandated by the PRD (e.g., Web Bluetooth, min2phase), an ADR can be created directly without an RFC.

## Status
Currently, no architectural decisions have been finalized. This directory remains empty (aside from templates) until real research is conducted and decisions are made.

## Scalability Governance
To prevent folder bloat as the project scales to hundreds of ADRs, all new documents **MUST** be placed in a domain-based subdirectory. Do not place files directly in the root of this folder.
- Example: `../03-adr/frontend/0001-ui-framework.md`
- Example: `../03-adr/hardware/0002-bluetooth-hal.md`
