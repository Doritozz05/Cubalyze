# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Speedcubers** (primary), from relative novices to sub-15 elites, practicing on desktop during sessions and on mobile on the go.
- Their job: time solves frictionlessly, track progress over time, train and retain algorithms, and identify and fix the specific weak phase(s) holding back their time.
- A secondary, aspirational audience of **WCA competitors** whose practice is evaluated against official-format scrambles, timing, and penalty rules — served by compatibility, not by organizing competitions.

## Product Purpose

CubeForge unifies what has always been fragmented across five separate tool classes — timing, smart-cube analytics, algorithm training, algorithm databases, and solver/engine infrastructure — into one cohesive, offline-first, AI-oriented application for speedcubers. Success means a cuber can time a solve on one device, have it analyzed for phase weaknesses, be fed a targeted algorithm-training drill, and see it all tracked in one place — without an internet connection and without exporting data between apps.

## Positioning

The single platform that coherently unifies the five ecosystem layers (timer → smart-cube analytics → algorithm training → algorithm database → engine infrastructure) with a modern, extensible, offline-first architecture. No current tool (csTimer, Cubeast, Twisty Timer, GAN Cube Station, SpeedCubeDB, CubeSkills) covers all five layers; the incumbent alternatives are either monolithic (csTimer), vendor-locked (GAN), coverage-siloed (Cubeast/CubeDesk), or content-only (CubeSkills). This differentiated positioning was confirmed independently in the PRD and in the August 2026 product audit.

## Operating Context

- Practice happens in a **desk session** (desktop or laptop, often with a hardware input) or as **portable practice** (mobile on the bus or between classes) — so the same work must feel native in both.
- **Offline-first** is a hard reality: practice must keep working with zero network; all core analysis, solver, and timer features are embedded client-side.
- **Smart cube hardware** (GAN cube over Web Bluetooth) and **StackMat** (over audio) are primary input methods and must work in place of manual timing.
- **WCA-format compatibility** governs scramble generation, timing rules, and penalties — official-status scrambles are a reference format, not a certification claim.
- Data is held locally in SQLite WASM (OPFS) with versioned migrations and export/import.

## Capabilities and Constraints

Current (verified in August 2026 audit):
- Timer with manual/hardware input, scramble generation, penalties, session stats.
- Smart-cube analytics via GAN Web Bluetooth and StackMat audio, with clock-drift correction.
- Real-time 3D cube engine for solve playback and comparison.
- Algorithm database, algorithm training with FSRS spaced repetition, and a skill tree.
- Statistics/charts, widgets, and a stats dashboard.
- 352+ passing tests, typecheck clean; visual worlds and surfaces ship from the incumbent codebase.

Constraints and explicit gaps (do not fabricate as built):
- Only **2×2 and 3×3** WCA events supported so far.
- **Undecided / not built yet:** user account & identity, multi-device sync, AI Coach, backend/API, and onboarding. The `ai-core`, `sync-engine`, and `api` packages are empty placeholders.
- GPLv3 licensing of several cited reference engines (csTimer, parts of cubing.js, tnoodle-lib) warns against direct code integration without legal audit; safe path is reimplementing documented protocol logic.

## Brand Commitments

- **Name:** CubeForge.
- **Positioning claim:** open-source, AI-first, offline-first speedcubing platform that unifies the five ecosystem layers.
- **Open source:** the project is intentionally open-source; open-source posture is binding.
- **Engineering governance:** strict pipeline PRD → Roadmap → ADR → RFC → TDD → Code; AI coding assistants must read the project's AGENTS.md governance before contributing. Binding.
- **WCA compatibility** as a design constraint (formats, not organizing competitions).

## Evidence on Hand

- `docs/00-product/PRD.md` — master product/architecture/design document (research, positioning, surfaces, data model).
- `docs/01-roadmap/Master_Roadmap.md` — execution and dependency plan (sole source of truth for planning order).
- `docs/00-product/Auditoria_Producto_2026-08.md` — code-grounded audit of real state vs. promises (tests, package coverage, navigation, hardware, persistence, explicit absences).
- Repo code: `apps/web` (React PWA, ~42,921 lines), `apps/desktop` (Tauri), `apps/api` (empty), and 16/19 packages with real code.
- **Absences:** no testimonials, no paying customers, no deployment/benchmark claims, no AI, sync, or account exists yet. Any such claim in future surface work must be marked speculative, not presented as shipped.

## Product Principles

1. **One frictionless entry point to timing** — the timer is reachable in one tap/key above all else (the clearest lesson from csTimer and Twisty Timer).
2. **Offline-first and private-by-default** — analysis and solving are embedded client-side; the platform must not degrade when disconnected.
3. **Progressive by depth, not by tiers** — a new user sees the simple truth; advanced users can dig as deep as they want without being pushed.
4. **Consistency of identity across 2D and 3D** — same face colors, same notation, same thresholds between the stats view and the cube view.
5. **Unify the five layers once, not five times** — every capability must interoperate inside one data model (solve → move events → analysis → training → statistics), never as isolated exportable silos.

## Accessibility & Inclusion

No product-specific accessibility requirement, standard, or user need has been established beyond platform defaults. Do not fabricate an a11y commitment; treat conformance to web platform basics as the default floor until one is declared.