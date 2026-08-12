# CubeForge Documentation Ecosystem

Welcome to the CubeForge Documentation repository. This `docs/` folder is the **Single Source of Truth** for the entire project.

## Directory Structure & Index

The documentation is organized sequentially to match the software development lifecycle. Every document must have a single clear responsibility.

- `_templates/` - Standardized templates for all document types.
- `00-product/` - Product requirements and vision.
  - `domain/` - **Domain Knowledge**: The business rules and reality of speedcubing (WCA rules, notation, algorithms).
- `01-roadmap/` - Strategic roadmap and execution planning.
- `02-architecture/` - System design, research, and validation.
  - `Architecture_Lifecycle.md` - The governance lifecycle from idea to code.
  - `overview/` - The established truth (post-ADR system design).
  - `research/` - Exploration of alternatives and the Research Roadmap.
  - `validation/` - Prototypes and benchmarks.
  - `diagrams/` - Visual architecture models.
- `03-adr/` - Architecture Decision Records (Immutable, approved decisions).
- `04-rfc/` - Requests for Comments (Proposals based on research).
- `05-tdd/` - Technical Design Documents (Module-level implementation plans).
- `06-api/` - API specifications and interfaces.
- `07-database/` - Database schemas and migrations.
- `08-standards/` - Coding, engineering, and documentation standards.
- `09-testing/` - Test strategies, frameworks, and plans.
- `10-security/` - Threat models, audits, and privacy policies.
- `11-devops/` - CI/CD, environments, and deployment guides.
- `12-sdk/` - SDK documentation for third-party integrations.
- `13-plugins/` - Plugin ecosystem rules and architecture.
- `14-ai/` - AI Agent instructions (`AGENTS.md`) and manifests.
- `15-contributing/` - Contribution guidelines for humans.
- `16-user/` - End-user documentation and manuals.
- `17-releases/` - Changelogs and release notes.
- `18-archive/` - Deprecated, rejected, or historical documents.

## Navigation & Wayfinding

No document should ever be an orphan. Always refer to the specific Index or README of the folder you are in.
Every folder explains its purpose. If you are lost, start here or in the [Architecture Index](02-architecture/Architecture_Index.md).

### The Documentation Lifecycle Flow
To guarantee maintainability, we strictly follow this sequence from idea to code:
**[1. PRD](00-product/PRD.md)** -> **[2. Roadmap](01-roadmap/Master_Roadmap.md)** -> **[3. Research](02-architecture/research/Architecture_Research_Roadmap.md)** -> **[4. RFC](04-rfc/README.md)** -> **[5. ADR](03-adr/README.md)** -> **[6. Arch Overview](02-architecture/Architecture_Index.md)** -> **[7. TDD](05-tdd/README.md)** -> **Implementation**

Never skip a step for major features.

## Standards and Governance

This documentation is strictly governed. Refer to the [Architecture & Documentation Standards](08-standards/Architecture_and_Documentation_Standards.md) for rules on naming, metadata, document lifecycles, and formatting. **Never create a document from scratch without using a template from `_templates/`.**

## AI-First Development

This repository is optimized for AI-assisted development. All AI agents must abide by the rules defined in [`08-standards/AI_Development_Standards.md`](./08-standards/AI_Development_Standards.md) and the operating manual [`14-ai/AGENTS.md`](./14-ai/AGENTS.md). The documentation structure is designed for deterministic navigation, minimal context switching, and low hallucination risk.

## Estado de las secciones (2026-08-12)

| Sección | Estado |
|---|---|
| 00-product, 01-roadmap, 02-architecture, 03-adr, 04-rfc, 05-tdd, 08-standards, 15-contributing | ✅ pobladas |
| 06-api (Fase 4), 11-devops (Fase 6), 16-user (Fases 1), 17-releases (Fase 8) | ✅ pobladas en 2026-08-12 |
| 07-database, 09-testing, 10-security | 🟡 READMEs de entrada con punteros (el contenido vive en ADRs/06-api/11-devops) |
| 12-sdk, 13-plugins | 🔴 vacías por diseño — aún no hay SDK público ni plugins de terceros |
| 14-ai | ✅ `AGENTS.md` (manual de agentes) + `opencode.json` |
| 18-archive | ✅ inventario de planes archivados |

La **API reference** generada (TypeDoc) vive en `docs/api/` (gitignored; regenerar con `pnpm docs:api`).

## The Bootstrap Guide

For a complete explanation of how to use this documentation ecosystem, refer to the **[Documentation Bootstrap Guide](./Documentation_Bootstrap_Guide.md)**.
