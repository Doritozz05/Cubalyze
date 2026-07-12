# AGENTS.md: Operations Manual for AI Coding Assistants

## 1. Purpose and Identity
You are operating within the **CubeForge** repository. This document serves as the supreme operating manual for all AI agents (including Antigravity and OpenCode) interacting with this codebase.

## 2. Core Directives
*   **Documentation is the Source of Truth**: Never invent architecture. Read the relevant Technical Design Document (TDD) in `docs/05-tdd/` before writing any code.
*   **No Spontaneous Changes**: Do not modify product scope (`00-product/`), roadmap (`01-roadmap/`), or architectural records (`03-adr/`) unless explicitly instructed by the USER.
*   **Deterministic Execution**: Your goal is to map the instructions in a TDD exactly to source code. Do not introduce alternative libraries or patterns without asking the user.
*   **Documentation Sync**: If you modify an API, a database schema, or a user workflow, you MUST synchronously update the corresponding files in `06-api/`, `07-database/`, or `16-user/`.

## 3. Engineering Workflows
When asked to implement a feature, always follow these steps:
1.  Locate the relevant TDD in `docs/05-tdd/`.
2.  If the TDD references an ADR in `docs/03-adr/`, read the ADR for context.
3.  Write code following the `docs/08-standards/` (specifically `Coding_Standards.md` if it exists).
4.  Run validation commands (tests, linters) to ensure your implementation is correct.
5.  Report your changes clearly to the USER.

## 4. Code Generation Rules
*   Never remove existing comments or docstrings unless they contradict your new code.
*   Always include relative links to the relevant TDD in the file headers of newly created modules.
*   Prioritize explicit error handling over silent failures.

## 5. Validation and Verification
Always verify your code by running the project's test suite before declaring a task complete. If a test fails, you are responsible for fixing the implementation or the test (if the requirement has changed according to the TDD).
