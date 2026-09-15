---
status: "Active"
owner: "AI Workflow Architect"
last_updated: "2026-08-12"
document_type: "AGENTS"
---

# AGENTS.md — Operating Manual for AI Assistants

> This is the **authoritative operating manual** for AI agents working in the
> Cubalyze repository. It complements (and is referenced by)
> [`../08-standards/AI_Development_Standards.md`](../08-standards/AI_Development_Standards.md).
> **Read this file first, then the reading order below, before touching anything.**

## 0. Non-Negotiable Rules

1. **Never invent.** Every claim about the system must be verifiable against the
   code. If something is not deducible from the code or the docs, **ask the
   user**. Never fabricate features, decisions, or "why"s.
2. **Never commit secrets or credentials.** Env files, keys, or tokens are never
   staged or committed.
3. **ADRs are immutable.** Once Accepted, the decision is locked. A change of
   direction requires a **new ADR** that `supersedes` the old one. Never edit an
   Accepted ADR's decision — only status notes (e.g. implementation state) are
   allowed, clearly dated.
4. **RFCs are never retroactive.** An RFC is a proposal for debate. Code already
   built has nothing to propose: register *decisions* as ADRs (marked
   "registrado retroactivamente"), never as RFCs.
5. **TDDs precede code.** New features must have an approved TDD (or an ADR that
   supersedes the need) before implementation. For already-built code, write
   TDDs *as-built* with real acceptance criteria.
6. **No undocumented tooling choices.** Adding a dependency, changing the build,
   or introducing a tool requires justification in the docs (ADR or standard).
7. **Ask before irreversible actions.** Publishing, tagging, deleting, pushing
   to main, or anything affecting production requires explicit user approval.

## 1. Documentation Reading Order

Navigate **deterministically** — never act from memory:

1. [`../README.md`](../README.md) — index of the `docs/` ecosystem + state of each section.
2. [`../02-architecture/Architecture_Index.md`](../02-architecture/Architecture_Index.md) — map of architecture docs.
3. [`../02-architecture/Architecture_Lifecycle.md`](../02-architecture/Architecture_Lifecycle.md) — the governance rulebook.
4. [`../03-adr/README.md`](../03-adr/README.md) — all decisions (ADR-001 → ADR-028, DEC-01 → DEC-29).
5. [`../05-tdd/README.md`](../05-tdd/README.md) — concrete designs per domain.
6. [`../06-api/README.md`](../06-api/README.md) — packages' public API (or regenerate with `pnpm docs:api`).
7. Domain-specific docs when working in an area: `../16-user/` (views),
   `../02-architecture/web/` (web internals), `../02-architecture/Widgets_System.md`,
   `../02-architecture/Desktop_App.md`, `../11-devops/` (CI/deploy/releases).

Machine-readable index (used by opencode): `opencode.json` in this folder.

## 2. Governance Lifecycle (never skip steps for major features)

```
PRD (00-product) → Research (02-architecture/research) → RFC (04-rfc)
→ ADR (03-adr, immutable) → Overview update (02-architecture/overview + diagrams)
→ TDD (05-tdd) → Implementation → Docs update (06-api, 16-user…) → Release (17-releases)
```

- **Major features** follow the full cycle. **Bug fixes / small changes** need a
  TDD only when the design isn't already documented (per `05-tdd/README.md`).
- When you document existing code (the current documentation effort, Fases 0–9):
  derive everything from the code, add ADRs only for *unregistered decisions*
  (mark them retroactive), and never fabricate RFCs.

## 3. Repository Conventions

- **Package manager**: pnpm (never npm/yarn). Use `pnpm --filter <pkg> …`.
- **Commits**: Conventional Commits — `feat|fix|docs|style|refactor|perf|test|
  chore|build|ci|revert`, scope in kebab-case, subject ≤100 chars. Use
  `pnpm commit` (czg) for guidance. The husky hook is **not blocking** by design
  (ADR-028) — plain `git commit` is fine.
- **Docs**: every document starts with YAML frontmatter
  (`status`, `owner`, `last_updated`, `document_type`). Never duplicate content —
  link to the source of truth instead.
- **Generated artifacts**: `docs/api/` (TypeDoc) is generated — never edit it;
  regenerate with `pnpm docs:api`.

## 4. Definition of Done (from `../08-standards/Pull_Request_Guidelines.md`)

A change is done only when:

1. **CI green**: lint, typecheck, and tests pass (`pnpm lint`, `pnpm typecheck`,
   `pnpm test`; CI gates in `../11-devops/CI_and_Quality_Gates.md`).
2. **Traceable**: code maps to an approved TDD or documented decision.
3. **Docs updated**: API changes → `06-api`; DB schema → `07-database`;
   behavior changes → the relevant section of `docs/`.
4. **No new line-length violations** (`pnpm lint:lines`, TDD-0006 gate).

## 5. Working with this repo (practical rules)

- **Verify before claiming**: use `grep`/reading the actual source over
  assumptions; the git history has many uninformative "fix" commits — the code
  is the truth.
- **Prefer editing existing files** over creating new ones; make the fewest
  changes that address the request.
- **Check the worktree first**: this repo is often worked on in a git worktree;
  run `git worktree list --porcelain` to locate the user's main checkout and
  bootstrap (`pnpm install --frozen-lockfile`) before running project commands.
- **Ask when in doubt**: accumulate questions and resolve them with the user at
  the end of a phase/unit — never invent an answer.
