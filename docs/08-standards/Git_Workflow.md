# Git Workflow & Branch Strategy

**Owner**: DevOps Architect
**Lifecycle**: Living Document

## Purpose
To define how changes flow from development to production.

## Branching Model (Trunk-Based Development)
- `main`: The single source of truth. Always deployable.
- `feat/*`: For new features (e.g., `feat/gan-cube-adapter`).
- `fix/*`: For bug fixes (e.g., `fix/timer-drift`).
- `chore/*`: For maintenance tasks (e.g., `chore/update-deps`).

## Commit Convention (optional)
We follow **Conventional Commits**:
- `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- Example: `feat(hal): implement gan cube decryption`

Commitlint is **purely optional** — there is no gate, local or in CI. Plain
`git commit` never blocks any message.

Use the interactive assistant `pnpm commit` (czg) whenever you want a
well-formed conventional message — it fills every field and validates as you
type. For quick/WIP commits just use a normal `git commit`; nothing enforces
convention, so you can always rewrite messages later (e.g. `git commit --amend`
or squash on merge).

## Rules
- Direct pushes to `main` are strictly forbidden.
- Force pushing is forbidden on public/shared branches.
- Squash and merge is the preferred PR strategy to keep the history clean.
