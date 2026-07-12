# Requests for Comments (RFC)

This directory is used for proposing and discussing architectural decisions, tooling choices, or major structural changes before they are finalized.

## Workflow
- RFCs are the first step in the decision-making process for complex architectural choices.
- Anyone can create an RFC to propose a solution (e.g., "RFC 0001: Monorepo Tooling - Turborepo vs Nx").
- Once an RFC is thoroughly researched, discussed, and a consensus is reached, the decision is formally recorded as an **ADR** in `../03-adr/`.
- The RFC is then considered resolved.

## Status
Currently, there are no open RFCs. This directory remains empty until real proposals are drafted for the project's technology stack.

## Scalability Governance
To prevent folder bloat as the project scales to hundreds of RFCs, all new documents **MUST** be placed in a domain-based subdirectory. Do not place files directly in the root of this folder.
- Example: `../04-rfc/frontend/0001-ui-framework.md`
- Example: `../04-rfc/hardware/0002-bluetooth-hal.md`
