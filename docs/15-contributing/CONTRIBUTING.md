# Contributing to CubeForge

Thank you for your interest in contributing to CubeForge! To ensure a scalable and maintainable codebase, we follow a strict implementation pipeline.

## The Implementation Pipeline

CubeForge does not accept arbitrary pull requests for new features without prior architectural approval. All changes must flow through this pipeline:

1. **Idea**: Discussed in GitHub Discussions or Issues.
2. **Architecture**: If the idea requires new technology, an **RFC (Request for Comments)** must be opened in `docs/04-rfc/`. Once resolved, it becomes an **ADR (Architecture Decision Record)** in `docs/03-adr/`.
3. **Design**: Before writing code, you must author a **TDD (Technical Design Document)** in `docs/05-tdd/` and get it approved by the core team.
4. **Implementation**: Code must strictly follow the `docs/08-standards/` (Coding, Testing, Security).
5. **Validation**: All tests and CI pipelines must pass.
6. **Documentation**: Update APIs or Database schemas if your PR modifies them.

## Pull Requests
- Follow the Pull Request Template.
- Ensure your branch is up to date with `main`.
- Squash your commits if they are noisy. We enforce Conventional Commits.

## AI Assistants
If you are an AI assistant (like Antigravity or OpenCode) submitting a contribution on behalf of a user, you are bound by the exact same rules. See `docs/14-ai/AGENTS.md`.
