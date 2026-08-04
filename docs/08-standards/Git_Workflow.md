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

## Commit Convention
We strictly enforce **Conventional Commits**:
- `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- Example: `feat(hal): implement gan cube decryption`

Use the interactive assistant `pnpm commit` (czg) — it fills every field and
validates the message before committing. The local husky hook (`commit-msg`)
blocks non-conventional messages.

### Escape hatch (local only)
For urgent/WIP commits you can bypass the **local** hook with:

```sh
SKIP_COMMITLINT=1 git commit -m "wip: ..."
```

This only skips the local check. The CI gate (`quality-gates.yml`, job
`commitlint`) **always** validates every commit message in PRs and pushes, so
bypassed messages must be squashed into a conventional one before merging.

## Rules
- Direct pushes to `main` are strictly forbidden.
- Force pushing is forbidden on public/shared branches.
- Squash and merge is the preferred PR strategy to keep the history clean.
