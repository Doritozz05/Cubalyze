# CubeForge — UI/UX Audit & Architecture Roadmap (2026)

> **Status:** Research Report → expected entrypoint for one or more RFCs → ADRs → TDDs.
> **Owners:** Senior Product Designer · UX Researcher · Staff Frontend Architect · Information Architect · Speedcubing Domain Expert · HCI Specialist.
> **Scope:** Entire visual + interaction stack of CubeForge (`apps/web`) with explicit preparation for **Trainer, Algorithms, Analysis/Progress, Smart Cube, Sessions, Skill Tree, Competitions, Settings** and future modules.
> **Non-goals:** UI redesign of in-place visuals. **Identity is preserved.** This report addresses **structural scalability**, not aesthetic restyling.
> **Companion doc:** depends on previous UI work; precedes `RFC-UI-XXX-Architecture.md`, `ADR-025-UI_Redesign.md` and the per-module `TDD-XX-*.md` files.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Cross-cutting principles (apply to every phase)](#2-cross-cutting-principles-apply-to-every-phase)
3. [Part 1 — Audit of the current UI](#3-part-1--audit-of-the-current-ui)
4. [Part 2 — Navigation flow review](#4-part-2--navigation-flow-review)
5. [Part 3 — Cube3DPanel verdict](#5-part-3--cube3dpanel-verdict)
6. [Part 4 — Stats Panel: hybrid recommendation](#6-part-4--stats-panel-hybrid-recommendation)
7. [Part 5 — Left Sidebar as navigation center](#7-part-5--left-sidebar-as-navigation-center)
8. [Part 6 — U2 analysis (rescue / discard)](#8-part-6--u2-analysis-rescue--discard)
9. [Part 7 — App areas and `activeView` map](#9-part-7--app-areas-and-activeview-map)
10. [Part 8 — Coming Soon strategy](#10-part-8--coming-soon-strategy)
11. [Part 9 — Product coherence matrix](#11-part-9--product-coherence-matrix)
12. [Part 10 — Extended roadmap (phases)](#12-part-10--extended-roadmap-phases)
13. [Risks and mitigations](#13-risks-and-mitigations)
14. [Glossary](#14-glossary)
15. [Acceptance criteria summary](#15-acceptance-criteria-summary)

---

## 1. Executive summary

The actual CubeForge UI is **aesthetically excellent and semantically grounded**: a bone-white canvas + carbon ink palette, monospaced `.nums` for tabular numerics, semantic tints (`--ready`, `--hold`, `--dnf`, `--plus2`), a precise motion language (`ease: [0.4, 0, 0.2, 1]`) and a Settings dialog that already uses a sidebar-with-sections pattern. **Nothing of this should change.**

The architectural debt is concentrated in `apps/web/src/App.tsx`, which orchestrates a single `<MainLayout>` of two columns and exposes a tab set (Times/Stats/Analysis) plus a Cube3D swap. This pattern **was designed for a single-purpose timer**. As soon as the cubing roadmap introduces Trainer, Algorithms, Skill Tree or Competitions, this layout becomes both **too small** (no full-screen views) and **too loud** (header carrying domain + chrome + hardware).

**The single most important decision** in this document is to **introduce a top-level `activeView` router (AppShell) and convert the Left Sidebar into the navigation center** while extracting the ChromeOverlay pattern from Cube3DPanel into a reusable primitive. The whole roadmap follows from that.

**Aesthetic baseline that must NEVER change** (canon for designers and reviewers):

- Palette tokens: `--canvas / --surface / --surface-2 / --ink / --ink-2 / --ink-3 / --line / --line-2`.
- Semantic tokens: `--ready / --ready-soft / --hold / --hold-soft / --dnf / --dnf-soft / --plus2 / --plus2-soft`.
- Typography: Geist Sans + Geist Mono, `.nums` for time/figures.
- Motion: duration 0.15–0.25 s, easing `[0.4, 0, 0.2, 1]`, layoutId for shared indicator animations (`sidebar-active`, `settings-active-bg`).
- Settings always as a **Dialog with a sidebar**; sections are declarative in `settings.constants.ts`.
- Numbers smaller than `0.7rem` reserved for chrome (labels, tags, badges). Numbers ≥ `0.7rem` are reserved for actual data.

---

## 2. Cross-cutting principles (apply to every phase)

These are the principles any PR must satisfy. They are non-negotiable gates for every fase of the roadmap.

### 2.1 Aesthetic stability
- Any new view, dialog or component must consume the **existing CSS variables**. Hard-coded `#ffffff`, `#000000` or `gray-*` Tailwind utilities are forbidden.
- New semantic colours must be added to `:root` and `.dark` of `apps/web/src/index.css` and exposed as a Tailwind token via `@theme inline { --color-... }`.
- No new font family. No font-size outside the existing scale without an ADR.

### 2.2 Motion language
- Easing **always** `[0.4, 0, 0.2, 1]` (Material Expressive "standard").
- Durations constrained to: 0.12 s (micro), 0.15 s (label reveal), 0.20 s (layout), 0.25 s (panel), 0.35 s (page transition). No ad-hoc durations.
- `prefers-reduced-motion`: every `motion.aside`, `motion.div`, `AnimatePresence` must respect `useReducedMotion()`. Default fallback = no animation, instant layout swap.
- LayoutGroup with `layoutId` for shared indicator animations (already in `Sidebar` and `SettingsSidebar`).

### 2.3 Accessibility (a11y)
- WCAG 2.1 AA contrast for any text-token pair. Use the canonical palette only; if a contrast fails, darken the *background* token, not the foreground.
- Every interactive element must be keyboard-operable. Visible focus ring using the `--ring` token. No outline removed.
- `aria-label` on icon-only buttons (already enforced in Header buttons).
- Live regions: only the timer has `aria-live="polite"` to avoid screen reader chatter.
- SettingsDialog: trap focus + restore focus to last active element on close.
- Sidebar collapsed (56 px): icons alone are visible. Each icon-only button has `title=` + `aria-label=`. Tested with NVDA + VoiceOver.

### 2.4 Naming conventions
- **Components:** `PascalCase.tsx`, no suffix for atomic components, `View` for top-level route area, `Shell` for layout wrappers (`SessionShell`), `Panel`/`Card`/`Tile` for layout units.
- **Hooks:** `use-` prefix, camelCase verbs (`useSolveSession`, `usePersistentSession`).
- **State stores:** `preferencesStore`, `orientationStore`, `sessionStore`. Zustand selectors must always be narrow (`useStore(store, (s) => s.x)`).
- **File per component** by default. Co-locate sub-components with a `Parent.tsx` + `Parent.components.tsx` only when they are not reusable elsewhere.
- **Routes / views:** lowercase kebab in `activeView`: `'session' | 'training' | 'algorithms' | 'analytics' | 'progress' | 'skill-tree' | 'competitions' | 'settings' | 'smart-cube'`.

### 2.5 Performance budgets
Every page-level bundle (gzipped) must weigh in at:
- **Initial shell:** ≤ 110 kB
- **Per-view additional code:** ≤ 35 kB (with code-splitting per `activeView`).
- **Recharts** is forbidden outside AnalyticsView; isolated behind `import()` to keep it out of the Session bundle.
- **Worker-based 3D engine** must remain the only consumer of OffscreenCanvas. Anything else that tries to use it is a regression.
- Frame budget: SessionView maintains 60 fps on a 5-year-old MacBook Air. Stress tested in CI with `lighthouse-ci --throttling-method=simulate`.

### 2.6 Browser matrix (HCI baseline)
- Chrome / Edge ≥ last 2 stable; Safari ≥ 16.4 (PWA + Web Bluetooth); Firefox ≥ last 2 stable (limited — Web Bluetooth intentionally not supported).
- iOS Safari receives a fallback via `navigator.userAgent` and the `use-mobile` hook; the Smart Cube flow ships with a graceful "Not supported on iOS Safari" panel.
- All views must render correctly at 1280 × 720 (laptop), 1920 × 1080 (desktop) and 375 × 667 (mobile).

### 2.7 Data contracts (TypeScript)
Any state that crosses module boundaries must be typed in `packages/types`. New view data shapes (e.g. `Analytics` aggregations, `SkillNode`, `AlgorithmSet`) MUST:
- Live in `packages/types/`.
- Be re-exported via `@cubeforge/types`.
- Have a Zod schema mirrored to the TS type for IndexedDB persistence validation.

### 2.8 Documentation responsibility ladder
- A new view MUST have: (a) a `TDD-XX-ViewName.md` in `docs/05-tdd/`, (b) an entry in `docs/02-architecture/overview/UI_Map.md` and (c) screen captures in `docs/16-user/screens/<view>.png` once shipped.
- The TDD must include **acceptance criteria** matching the table in §15 of this document.
- A view cannot be merged without its TDD being approved by the Docs Maintainer.

### 2.9 Testing strategy (per phase baseline)
- **Unit (vitest):** pure logic (stats math, scheduler, analysis engine) ≥ 90 % coverage.
- **Component (vitest + Testing Library):** every view must have an integration test that renders the empty / populated / error / loading states.
- **Visual regression (Playwright + snapshot):** every view must have a baseline snapshot in light + dark mode.
- **Accessibility test:** `@axe-core/playwright` on every new public view.

---

## 3. Part 1 — Audit of the current UI

The visual layer is healthy; the structural layer has predictable ceilings. Tabular diagnosis:

| Component | Responsibility today | Mixed duties | Visual noise | Scales? | Verdict |
|---|---|---|---|---|---|
| **`Header`** (`apps/web/src/components/Layout/Header.tsx`) | Session · BT · PB · Puzzle · toggles | **Yes:** domain (SessionId, PB), chrome (toggles), hardware (BT) | Medium | **No** — new domain state will overflow | **Redistribute.** Puzzle + Session move to SessionView; BT to Sidebar/system. |
| **`LeftSidebar`** (`apps/web/src/components/Layout/LeftSidebar.tsx`) | Timer · Settings · Theme | No, but under-used (3 items) | No | **Yes** with groups | **Expand** to navigation center. |
| **`MainLayout`** (`apps/web/src/components/Layout/MainLayout.tsx`) | `main` + right contextual panel | **Yes:** forces every page into a 2-column shape | No | **No** — Skill Tree / full-screen analytics will not fit | **Rewrite** as AppShell with router. |
| **`Cube3DPanel`** (`apps/web/src/components/Cube3D/Cube3DPanel.tsx`) | Worker · OffscreenCanvas · recent-moves overlay | No | No | **Yes** | **Keep**, **extract** to a context-based widget. |
| **`StatsPanel`** (`apps/web/src/components/Stats/StatsPanel.tsx`) | Best single highlight · Ao5 trend · aggregate grid | **Yes:** mixes session with historical aggregates | Medium | **No** for cross-method / monthly PBs | **Migrate** to `AnalyticsView`. |
| **`SessionStats`** (`apps/web/src/components/Stats/SessionStats.tsx`) | Ao5/Ao12/Best/Mean row under the Timer | No | No | **Yes** | **Keep** as the live "in-motion" feedback strip. |
| **`TimesList`** (`apps/web/src/components/Stats/TimesList.tsx`) | Solve log: +2/DNF/Clear/Delete per row, hover-peek menu | No | Low | **Yes** | **Evolve** to **click-to-detail** drawer. |
| **`SolveAnalysisPanel`** (`apps/web/src/components/Stats/SolveAnalysisPanel.tsx`) | Phase breakdown · TPS · Pauses · CFOP/Roux specifics | No | No | **Yes** | **Make parameterised** — reusable for any `Solve` from any list. |
| **`TimerContainer` + `TimerDisplay`** (`apps/web/src/components/Timer/Timer*`) | Phase orchestration · monospace time · state-tinted halo | No | No | **Yes** | **Keep.** Most polished surface in the app. |
| **`SettingsDialog`** (`apps/web/src/components/Settings/SettingsDialog.tsx`) + **Sidebar** + **`settings.constants.ts`** | Sidebar-with-sections pattern, 8 declared sections, animated transitions | No | No | **Excellent** | **Keep the pattern.** `PlaceholderSection` already implements the "SOON" story. |
| **Design tokens** (`apps/web/src/index.css`) | Palette · scrollbar · `.nums` · `::selection` | No | No | **Yes** | **Lock.** Any PR that adds a new non-token colour is rejected. |
| **`CubeConnector`** (`apps/web/src/components/Hardware/CubeConnector.tsx`) | Web Bluetooth pairing (HTTPS-only, manual MAC fallback) | Partial — couples BT trigger to Header | No | **Yes** as standalone | **Extract** `DeviceMenu` for Sidebar/system. |
| **`ScrambleDisplay`** (`apps/web/src/components/Scramble/ScrambleDisplay.tsx`) | Scramble text · states · verification | No | No | **Yes** | **Keep**, but consume orientation-aware notation from a single source. |

### Global diagnosis

- **Aesthetic layer:** stable, premium, reusable. Any new module adopts it for free through the CSS-variable bridge.
- **Structural layer:** `App.tsx` is the orchestrator of *all* slices. This is the single biggest scalability debt. Migrating to an `AppShell` + `activeView` reduces `App.tsx` from ~280 to ~30 lines and isolates views from each other.
- **State layer:** `packages/state` (zustand) is already split (`preferencesStore`, `orientationStore`); next slices belong here (`activeView`, `sidebarCollapsed`, `pipCubeVisible`, etc.).
- **Hardware layer:** the global `GanCubeAdapter` singleton is correct; only its **trigger** (currently the Header button) needs to migrate.

---

## 4. Part 2 — Navigation flow review

### 4.1 Today's effective flow

```
[App Load]
   │
   ├─ Header → CubeConnector (Dialog) → onSuccess toast → close
   │
   ├─ MainLayout
   │   ├─ Section:
   │   │   ├─ ScrambleDisplay (optional, gated by scrambleVerification)
   │   │   ├─ TimerContainer → phase machine (idle,h holding,ready,running,stopped,inspection,ready_for_move)
   │   │   └─ SessionStats (Ao5/Ao12/Best/Mean)
   │   └─ Aside (Tabs: Times · Stats · Analysis) ⇄ Cube3D toggle
   │
   └─ LeftSidebar footer → SettingsDialog → Theme toggle
```

### 4.2 Where it breaks with roadmap modules

1. **Trainer**: where does it live? There's no `TrainingView`. The Settings dialog has a "Training" *section icon* but only renders `PlaceholderSection`.
2. **Algorithms**: the **library** is not navigable from anywhere except Settings.
3. **Skill Tree / Competitions**: not even advertised. The user has no mental model of "things CubeForge will do".
4. **Return path discipline**: a cuber who exits the (future) Algorithms view has no obvious affordance to return to their active session timer.

### 4.3 What is missing

- A **router** (`activeView`) at the application shell level.
- A **command palette** bounded to in-app navigation (not global Cmd-K — see Part 6).
- **Deep-linking**: clicking a solve in `TimesList` must open the analysis of *that specific solve*, not of the *latest* one. Today this only works when the user manually switches the right-tab to "Analysis".

---

## 5. Part 3 — Cube3DPanel verdict

> **Verdict: keep. Extract. Promote to widget.**

### 5.1 What works brilliantly today

- **Worker singleton** that survives Strict-Mode unmount/remount so the OffscreenCanvas → WebGL context is never re-transferred.
- **Resize via ResizeObserver** decoupled from React renders.
- **`recentMoves` overlay** at the bottom using `compactMoveNotation` — compact, calm, theme-aware (`bg-background/60 backdrop-blur-sm`).
- **Drag-to-rotate** with `setPointerCapture`, no third-party libs.
- **Calibration + Reset** buttons placed in the panel header, not buried.

### 5.2 Patterns to extract (and where they belong)

| Pattern | Extract to | Reuse case |
|---|---|---|
| **`FeedOverlay`** (recent-moves bar) | `apps/web/src/components/shared/ChromeOverlay.tsx` | Algorithms viewer, Replay, Training, Side-by-side comparison. |
| **Worker + OffscreenCanvas persistence** | Documented as a rule in `08-standards/Coding_Standards.md`; encapsulate as a `createRendererWorker()` factory in `packages/cube-3d-engine/`. | Every new 3D feature must use it. |
| **Picture-in-Picture mini-cube** | New `Cube3DPip.tsx` consumer of `Cube3DContext` | Algorithms, Training, Competitions. |
| **Calibration controls** | A new `Cube3DSetupCard` in the future `SmartCubeView` | Decouples 3D controls from the canvas panel. |

### 5.3 Invariants that MUST stay

- The wiring with `orientationStore`, `globalCubeAdapter.moves$`, `syncBridge.bindCube()`.
- Cubie's `WorkerSingleton` module-level pattern (prevents duplicate WebGL contexts).
- Pointer drag handling on the canvas (no replacement by OrbitControls or similar — keep custom control).

---

## 6. Part 4 — Stats Panel: hybrid recommendation

### 6.1 The five options evaluated

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A) Keep only quick stats in Header | Low noise | Header becomes a dashboard, kills hierarchy. | ❌ Reject. |
| B) Keep contextual panel | Works | Width/height cap blocks richer charts. | ⚠️ Keep only as in-session summary; remove "Analysis" tab. |
| C) Delete it | Simplifies | Removes immediate post-solve value. | ❌ Reject. |
| D) Move everything to a dedicated analytics view | Full-screen | Loses "hot" feedback at end of session. | ⚠️ Partial. |
| **E) Hybrid** (recommended) | Best of both worlds | ~150 LOC migration. | ✅ **Adopt.** |

### 6.2 Recommendation E — Hybrid CubeForge

1. **`SessionStats` stays under the Timer unchanged.** It's the rapid feedback loop. The "Best" cell already uses `bg-ready-soft/40` accent which is *just enough* signal.
2. **`TimesList` becomes click-to-detail.** Clicking a solve opens a **right drawer** (or bottom sheet on mobile) with a parameterised `SolveAnalysisPanel`. The drawer reads the clicked `Solve`, not "the latest".
3. **`StatsPanel` migrates entirely** to a dedicated `AnalyticsView` reached from the Sidebar. The trend chart grows into multi-window (Ao5 · Ao12 · Ao50 · Ao100 · Ao1000) with month-range pickers.
4. The right-tab "Analysis" tab is **removed**, because its purpose is now served by the drawer.

### 6.3 Redundancies to suppress as part of this migration

- The PB chip in `Header` vs the "Best single" highlight in `StatsPanel`: both display best single. Once `AnalyticsView` ships, the `Header` chip stays as globale, the panel's "Best single" tile stays as session-scoped. **Different scope, no overlap.**
- The Ao5/Ao12 cells duplicated in `SessionStats` vs `StatsPanel`: documented as **two scopes (live vs historical)**, never re-merged.

---

## 7. Part 5 — Left Sidebar as navigation center

Yes — and the pattern is already half there. The hover-to-expand animation (`56 → 208 px`, easing `[0.4,0,0.2,1]`, spring-ish with 0.15–0.2 s), the group/subgroup concept in the existing layout and the `SidebarGroupTitle` component are exactly the right substrate.

### 7.1 Proposed Sidebar tree

```
cubeforge                       [brand + collapse]
─────────────────────────────
WORKSPACE                      [group]
  • Session                    active (= activeView=='session')
  • Training                   future → tag SOON
  • Algorithms                 future → tag SOON

INSIGHTS                       [group]
  • Analytics                  future
  • Progress                   future
  • Skill Tree                 future

COMMUNITY                      [group]
  • Competitions               future
  • Leaderboards               future → tag SOON
─────────────────────────────
SYSTEM                         [group]
  • Smart Cube                 future (extracted CubeConnector)
  • Settings                   ↦ SettingsDialog (existing)
  • Theme                      icon-only toggle (existing)
```

### 7.2 Spec for the new `Sidebar.tsx`

- Replace ad-hoc JSX with a declarative constant `LEFT_SIDEBAR_SECTIONS` mirroring `settings.constants.ts`'s shape:
  ```ts
  type SectionId = 'session' | 'training' | 'algorithms' | 'analytics'
                  | 'progress' | 'skill-tree' | 'competitions'
                  | 'leaderboards' | 'smart-cube' | 'settings';
  type NavItem = {
    id: SectionId;
    label: string;
    icon: LucideIcon;
    status?: 'available' | 'soon' | 'beta';
    badge?: React.ReactNode;
  };
  type NavGroup = { id: 'workspace'|'insights'|'community'|'system'; label: string; items: NavItem[] };
  ```
- Hover-expand unchanged (the `sidebar.constants.ts` already defines timings and widths).
- Active indicator uses the existing `layoutId="sidebar-active"` motion pattern.
- Items with `status === 'soon'` get `opacity-50 cursor-not-allowed` and a `title="Disponible próximamente"`. **Never** a banner or a popover.
- Mobile sheet already implemented by `LeftSidebar.tsx` (the `isMobile` branch with `Sheet`) is **kept as is** — no new mobile pattern is required.

### 7.3 Naming and concentration discipline

- Maximum **9 visible items** at 56 px collapsed width to preserve scannability. Anything above that lives under a section's "More" popover — but we should resist the temptation. The cuber should *see* every destination at a glance.

---

## 8. Part 6 — U2 analysis (rescue / discard)

U2 is a Next.js proposal with a dark warm OKLCH palette, 22 mock views, an AI Coach panel and a global Command Palette. It is *architecturally interesting but visually alien* to CubeForge.

| 🟢 RESCUE | Why | 🔴 DISCARD | Why |
|---|---|---|---|
| **`viewComponents` dict** in an `AppShell` | Decouples routing from layout. Solves our App.tsx ceiling. | **Dark warm palette (OKLCH)** | Breaks identity. Bone-white + ink stays. |
| **`navSections` array** driving the sidebar | Configurable without touching JSX. | **AI Coach Panel floating** | Promises mature conversational AI; CubeForge is focus-first, not chat-first. |
| **`activeTrainingModule` sub-router** | Local sub-state inside one view, clean separation. | **Command Palette global (⌘K)** open by default | Discoverability burden for newcomers. Defer until Algorithms library exceeds ~200 items. |
| **Hydration-safe `useIsClient`** for theme-aware icons and dates | Today's `mounted` boolean works but isn't a reusable hook. | **22 views as a goal** | Wrong KPI. We win on per-view quality, not bulk. |
| **`history` / `timeline`** as a domain area | Real need visible in `TimesList` view-only. | **Dense dashboards with multi-card heatmaps** | Speedcubing wants minimal surface area; cards-of-cards dilutes focus. |
| **Per-view layout shells** (e.g. `<SessionShell>`) | Mirrors our recommendation in §1. | **Mock dataset pattern** | We have real persistence in Dexie/IndexedDB. No theatre. |
| **`StoredSolve` rich shape** (`status`, `phases`) | Already mostly aligned with `SolveMetrics`. | **Settings re-implemented as routes** | We have a *better* SettingsDialog with sidebar pattern already. |

### 8.1 Independent of U2 (keep our win)

- `SettingsDialog` as a **Dialog** with a **sidebar**. This is what `apps/web/src/components/Settings/SettingsDialog.tsx` already does — keep it. U2's "settings as full route" would be a regression.
- The **bone-white / carbon-ink** palette in `apps/web/src/index.css` is the brand. Re-styling to OKLCH warm is forbidden.

---

## 9. Part 7 — App areas and `activeView` map

Each view has a single responsibility. The router responds to **state**, not URL, in v1 (URL routing is a separate RFC for a later release).

| `activeView` | Single responsibility | Today | Future |
|---|---|---|---|
| `'session'` | Capture solves, validate scramble, show immediate feedback, log solves, in-session live stats. | Already implemented. | Persist view scroll on tab refocus. |
| `'training'` | Active drill execution: F2L · OLL · PLL · Cross · COLL etc. | — | AlgTrainer + GenericTrainer + sub-router. |
| `'algorithms'` | Catalogue: browse, search, filter, favourite, watch 3D preview. | — | Library of cases per method. |
| `'analytics'` | Cross-session analysis, trends, distributions. | StatsPanel/TrendChart (in right tab). | Full-screen, multi-window. |
| `'progress'` | Calendar heatmap, weekly targets, PB history. | — | Connects to `SolveMetrics` aggregate API. |
| `'skill-tree'` | Gamified skill graph per method. | — | Nodes unlock via drill completions. |
| `'competitions'` | WCA-lite round flow, judge attestation, leaderboard. | — | Reuses `analytics` aggregations. |
| `'smart-cube'` | One screen for HW: connect, battery, gyro calibration, firmware updates. | CubeConnector in Header (Dialog). | Reborn as full sidebar entry. |
| `'settings'` | App-wide preferences, HW, behaviour. | SettingsDialog (already sidebar-based). | Add remaining sections out of `Placeholder` land. |

### 9.1 Settings sub-sections already declared

`apps/web/src/components/Settings/settings.constants.ts` lists 8 sections: General, Appearance, Smart Cube, Timer, Analysis, Training, Notifications, Advanced. Only three sections are real today (Appearance, Timer, Analysis); the rest render `PlaceholderSection`. The migration plan is to convert each placeholder into a real section **without changing the dialog pattern**.

---

## 10. Part 8 — Coming Soon strategy

### 10.1 Pros
- Communicates direction without committing to dates.
- Educates the cuber about the **mental space** of CubeForge (workspace / insights / community / system).
- Reduces "when X?" support load.

### 10.2 Cons
- Too prominent = smoke; too invisible = no communication.
- Clickable dead items burn trust.
- Permanent "BETA" tags dilute signal.

### 10.3 Style spec (binding)

| Aspect | Rule |
|---|---|
| Opacity | `opacity-50` (visibly inert, not deleted). |
| Cursor | `cursor-not-allowed`. |
| Tooltip | `title="Disponible próximamente"` + matched `aria-disabled`. |
| Tag | `SOON` in `text-[0.55rem] tracking-[0.18em] uppercase text-ink-3` only. No bright colour. |
| Promotion | When MVP lands → tag change to `BETA`. |
| Removal | After ≤ 2 minor releases free of critical issues, the tag disappears silently (no PR copy required). |
| Settings | `PlaceholderSection` already implements the shotgun idea (icon + polite empty-state). Use it verbatim — no extra banners. |

### 10.4 Forbidden patterns
- "Coming soon" banners in active views.
- Modals interrupting the solve flow.
- Marketing-shaped colour accents.
- Clickable items that do nothing.

---

## 11. Part 9 — Product coherence matrix

| View | MUST | MUST NOT |
|---|---|---|
| **Session** | Capture solves, live feedback, log | Long historical chart, multi-method comparison, algorithm catalogue |
| **Training** | Drill execution metrics | Ad-hoc manual solves, leaderboards |
| **Algorithms** | Browse, visualise, favourite | Tracking, drill execution |
| **Analytics** | Trends, PBs, distributions | Real-time timer, live capture |
| **Progress** | Heatmaps, goals | Drill execution, catalogue |
| **Skill Tree** | Visualise level, unlock challenges | Ladder rank, attempt tracking |
| **Competitions** | Round admin, attempts | Single-solve analysis deep-dive |
| **Smart Cube** | Discovery, calibration, telemetry | Catalog of algorithms |
| **Settings** | Preferences | Live session actions |

### 11.1 Duplications today's audit flags
- ⚠️ `StatsPanel` (right tab) ↔ future `AnalyticsView`. **Action:** when AnalyticsView lands, **retire** `StatsPanel` from the right tab in `MainLayout`.
- ⚠️ "PB" chip in Header ↔ "Best single" tile in `StatsPanel`. **Action:** keep both as scopes *globale* vs *session* — but document the difference in `docs/16-user/`.

---

## 12. Part 10 — Extended roadmap (phases)

Each phase lists **what**, **why**, **acceptance criteria**, **deliverables**, **risks**, **out of scope**, **dependencies** and **documentation artefacts**.

### Phase 0 — Freeze visual identity

**What:** Lock the palette, motion, typography, scrollbar and `.nums` rules as a v1-stable canon. Add a CI guard.
**Why:** Any subsequent PR must be measurable against a fixed baseline; without this, drift creeps in.
**Acceptance:**
- `apps/web/src/index.css` is marked as **do not modify** in PR template.
- A grep guard in CI fails the build if a non-token colour literal appears in `apps/web/src/**/*.{ts,tsx}` outside `index.css` and `theme-provider.tsx`.
- ADR `ADR-024-Visual_Identity_Freeze.md` written.
**Deliverables:**
- CI guard (custom script + npm script `check:tokens`).
- ADR.
- Updated PR template.
**Out of scope:** new modules.
**Dependencies:** none.
**Docs:** ADR + entry in `docs/02-architecture/overview/UI_Map.md`.

### Phase 0b — Cross-cutting conventions

**What:** Codify motion, a11y, naming, performance, browser matrix, data contracts, testing and documentation rules.
**Why:** Each phase must inherit a known set of invariants.
**Acceptance:**
- `docs/08-standards/UI_Standards.md` written (motion, a11y, naming, perf, browser matrix, token usage, testing).
- `packages/types` README documents the per-view contract.
- ESLint rule in `packages/config-eslint` blocks non-token hex literals.
**Deliverables:**
- UI Standards doc.
- ESLint rule.
- Two example components audited.
**Out of scope:** any view code change.
**Dependencies:** Phase 0.
**Docs:** `UI_Standards.md`; updates to `Architecture_and_Documentation_Standards.md`.

### Phase 1 — AppShell foundation

**What:** Introduce `AppShell.tsx` and `activeView` in `packages/state`. Reduce `App.tsx` to a thin mount.
**Why:** Remove the `App.tsx` structural ceiling.
**Acceptance:**
- `apps/web/src/App.tsx` ≤ 30 LOC.
- `viewComponents` dict exists with 2 entries (`session`, `algorithms-stub-not-visible` placeholder).
- Sidebar click on a future item keeps `activeView` state but renders a `PlaceholderView` (reuses the same pattern as `PlaceholderSection`).
- Theme + Sidebar collapse preserved.
- All keyboard shortcuts (`Space`, `Esc`, `Ctrl+Shift+S`, `Ctrl+Shift+C`) still work session-only.
**Deliverables:**
- `components/Layout/AppShell.tsx` with `viewComponents` dict.
- `packages/state/navigationStore.ts` (zustand) with `activeView`, `setActiveView`, `lastActiveView`.
- Updated `App.tsx`.
- Updated `MainLayout.tsx` (or replaced by `AppShell`).
- Tests: unit on navigation store; integration on AppShell; snapshot for desktop + mobile.
**Risks:** Worker singleton timing during remount of `<main>`; mitigated by a `viewPort` boundary that doesn't tear the worker.
**Out of scope:** removing `MainLayout` if any consumer depends on the right tab.
**Dependencies:** Phase 0b.
**Docs:** TDD `TDD-XX-AppShell.md`; new entry in `UI_Map.md`.

### Phase 2 — Header redistribution + tab removal

**What:** Move `CubeConnector` and puzzle selector out of `Header`. Simplify right-tab set from `{Times, Stats, Analysis}` to `{Times}`.
**Why:** Header is at capacity; right-tab forces the same "always Analysis" coupling.
**Acceptance:**
- `Header.tsx` contains only: brand, session switcher dropdown, PB chip, theme toggle, sidebar-collapse toggle, mobile menu.
- CubeConnector lives in `DeviceMenu` (a Popover in the Sidebar footer).
- Puzzle selector moves into the `SessionView` topbar as `<ScrambleDisplay>`'s sibling.
- `App.tsx` no longer renders a "Stats" or "Analysis" right-tab.
**Deliverables:**
- `components/DeviceMenu.tsx`.
- `components/SessionView/SessionTopbar.tsx`.
- Updated `AppShell.tsx` to drop the right-tab shell when `activeView === 'session'`.
**Risks:** Users who relied on the BT button in the header may miss it. **Mitigation:** a one-time Focus Ring + skeleton pulse on the Sidebar Smart Cube entry; release note in changelog.
**Out of scope:** rebuilding CubeConnector UI; only its housing changes.
**Dependencies:** Phase 1.
**Docs:** `TDD-XX-DeviceMenu.md`; update `UI_Map.md`.

### Phase 3 — Click-to-detail in TimesList

**What:** Clicking a solve opens a **drawer** (desktop) or **bottom sheet** (mobile) showing a parameterised `SolveAnalysisPanel` for that solve.
**Why:** Today's "Analysis" tab shows the latest solve, not the clicked one — a UX bug.
**Acceptance:**
- `TimesList` row click (or keyboard `Enter`) opens a focused drawer.
- Drawer has Esc to close, returns focus to the row, traps Tab inside.
- The drawer reuses the existing `SolveAnalysisPanel` with a `solve: Solve` prop, no new component.
- Mobile: bottom sheet with snap points 25% / 60% / 90%.
- Shareable: deep-link to a specific solve via `?solve=<id>` after Phase 11.
**Deliverables:**
- `components/SolveDetailDrawer.tsx`.
- `components/SolveDetailSheet.tsx` (mobile).
- Updates to `TimesList` to wire interactions.
**Risks:** A drawer with very long analysis content cards (Phase 4 enhancements) might overflow; mitigated by virtualisation.
**Out of scope:** solving `SolveAnalysisPanel`'s accordion state URL sync.
**Dependencies:** Phase 2 (so we can remove the right-tab clean).
**Docs:** `TDD-XX-SolveDetailPanel.md`.

### Phase 4 — AnalyticsView (full migration)

**What:** Lift `StatsPanel` + `TrendChart` into a full-screen `AnalyticsView`. Add broader windows (Ao50, Ao100, Ao1000) and a month-range picker. Recharts isolated behind code-splitting.
**Why:** Right-panel Stats cap blocks cross-method / monthly PBs that the community will demand.
**Acceptance:**
- `activeView === 'analytics'` opens `views/Analytics/AnalyticsView.tsx`.
- Route to a `AnalyticsView` from the Sidebar group INSIGHTS, no `SOON` tag.
- TrendChart window switcher: Ao5 · Ao12 · Ao50 · Ao100 · Ao1000.
- Cube cube solves count + solve time histograms + phase distribution.
- Recharts bundle is loaded **only** when AnalyticsView is mounted.
- Visual snapshot test in light + dark.
- Accessibility test (axe) passes.
**Deliverables:**
- `apps/web/src/views/Analytics/AnalyticsView.tsx`.
- Refactor of `TrendChart.tsx` to expose `window` controlled or uncontrolled.
- Removed: `StatsPanel.tsx`, `Tabs{Stats}` from App.tsx.
- Unit tests for the aggregations in `packages/analysis-engine`.
**Risks:** Aggregation queries on the client; large windows can freeze the UI. **Mitigation:** WebWorker in `packages/analysis-engine` (already partially wrapped).
**Dependencies:** Phase 1.
**Docs:** `TDD-XX-AnalyticsView.md`.

### Phase 5 — Sidebar overhaul (Roadmap segments)

**What:** Convert LeftSidebar to declarative sections. Add groups `WORKSPACE / INSIGHTS / COMMUNITY / SYSTEM`. Items declared as `LEFT_SIDEBAR_SECTIONS` constant.
**Why:** Sets the canvas for every future view. Discoverable destinations.
**Acceptance:**
- 9 items visible collapsed (≤ 9 is the readability cap).
- Hover-expand stays smooth (≤ 200 ms total).
- Coming Soon items render at `opacity-50` with `title` and `aria-disabled`.
- Mobile sheet (`isMobile` branch) unchanged.
- Group labels in `text-[0.62rem] uppercase tracking-[0.15em] text-sidebar-foreground/40` exactly as today.
**Deliverables:**
- Updated `components/Layout/LeftSidebar.tsx`.
- `components/Layout/sidebar.constants.ts` extended with `LEFT_SIDEBAR_SECTIONS`.
- Snapshot tests for desktop + mobile + light + dark.
**Risks:** Brand group labels visually compete with the brand text. **Mitigation:** re-use the existing `SidebarGroupTitle` opacity and identical font tokens.
**Dependencies:** Phase 1 (AppShell router).
**Docs:** `TDD-XX-SidebarV2.md`.

### Phase 6 — Cube3D decoupling: Picture-in-Picture + ChromeOverlay

**What:** Promote the recent-moves overlay to `components/shared/ChromeOverlay.tsx`. Allow Cube3D to mount anywhere via a context.
**Why:** Algorithms/Training/Competitions want a mini-cube in a corner without rewriting `MainLayout`.
**Acceptance:**
- `ChromeOverlay` accepts `items`, `variant`, `maxVisible`, `position` and renders the same look as today's bottom bar.
- `Cube3DContext` exposes provider/consumer hooks.
- New `Cube3DPip.tsx` shows a 200×200 mini-cube in the bottom-right of any active view, opt-in via prop.
- Algorithm viewer can show its own `ChromeOverlay` for notation.
- Worker singleton preserved.
**Deliverables:**
- `components/shared/ChromeOverlay.tsx`.
- `components/Cube3D/Cube3DContext.tsx`.
- `components/Cube3D/Cube3DPip.tsx`.
- `components/Cube3D/Cube3DPanel.tsx` refactored to consume the context.
**Risks:** ⚠️ Strict-Mode double-effects on the cube. **Mitigation:** keep the module-level `workerSingleton`.
**Dependencies:** Phase 4 (so the 3D bundle tree-shakes correctly).
**Docs:** `TDD-XX-Cube3DContext.md`; update `apps/web/src/components/Cube3D/README.md`.

### Phase 7 — Training & Training sub-router

**What:** Build `training/` with `TrainingOverview`, `AlgTrainer`, `GenericTrainer`. Sub-state `activeTrainingModule` mirrors U2's good idea.
**Why:** The first non-session view needed to validate the AppShell pattern beyond the timer.
**Acceptance:**
- `activeView === 'training'` shows `TrainingOverview`.
- Selecting Cross / F2L / OLL / PLL / COLL / ZBLL etc. sets `activeTrainingModule` and renders `AlgTrainer` or `GenericTrainer`.
- Algorithm scrolls use the new `ChromeOverlay`.
- Drill completion writes a `practiceResult` inside IndexedDB (Dexie schema migration).
- Statistics are limited to **this drill** — no global averages in this view.
**Deliverables:**
- `apps/web/src/views/Training/TrainingView.tsx`.
- `apps/web/src/views/Training/AlgTrainer.tsx`.
- `apps/web/src/views/Training/GenericTrainer.tsx`.
- Dexie migration in `packages/database`.
- Visual + axe snapshot tests.
**Risks:** Drill algorithm drift if Method prefs change mid-session. **Mitigation:** freeze the algorithm set when the drill starts.
**Dependencies:** Phase 6 (Cube3D available as context).
**Docs:** `TDD-XX-TrainingView.md`; `docs/06-api/Training_Module_API.md`.

### Phase 8 — SkillTree

**What:** Skill nodes per method (Cross · F2L lookahead · OLL recognition · PLL recognition · Lookahead). Unlock flow based on `practiceResult` aggregates.
**Why:** Gamification of training.
**Acceptance:**
- `activeView === 'skill-tree'` shows `<SkillTreeGraph>`.
- Node unlock uses a deterministic rule (e.g. 100 cross solves under X seconds).
- Node detail in a side-panel that reuses `ChromeOverlay` for any embedded notation.
- `text-[0.62rem] tracking-[0.18em]` for skills tier labels.
**Deliverables:**
- `apps/web/src/views/SkillTree/SkillTreeView.tsx`.
- `apps/web/src/views/SkillTree/SkillTreeGraph.tsx` (custom SVG renderer, no d3 dependency).
- Aggregation in `packages/analysis-engine`.
- Tests for unlock rule determinism.
**Risks:** Visual complexity. **Mitigation:** ≤ 12 visible nodes at one zoom level.
**Dependencies:** Phase 7.
**Docs:** `TDD-XX-SkillTreeView.md`.

### Phase 9 — Progress

**What:** Calendar heatmap of training days, weekly targets, PB ladder.
**Why:** Most asked-for feature in user research.
**Acceptance:**
- `activeView === 'progress'` shows `<ProgressDashboard>`.
- Heatmap uses CSS-grid (no D3 dependency).
- Weekly target goal persists via `preferencesStore`.
- PB ladder renders solved-by-best.
**Deliverables:**
- `apps/web/src/views/Progress/ProgressView.tsx`.
- `apps/web/src/views/Progress/HeatmapGrid.tsx`.
- `packages/types` extension: `WeeklyTarget`, `PBHistory`.
- Tests.
**Risks:** Cross-timezone date drift. **Mitigation:** centralise date math in `packages/state` with `Intl.DateTimeFormat`.
**Dependencies:** Phase 7.
**Docs:** `TDD-XX-ProgressView.md`.

### Phase 10 — Algorithms viewer

**What:** Browseable catalogue of algorithms by case + method + set.
**Why:** The cuber's reference book.
**Acceptance:**
- `activeView === 'algorithms'` shows `<AlgorithmGrid>`.
- Search + filter (method, set, memorability badge).
- Algorithm preview uses 3D context + ChromeOverlay + notation.
- Favourites persist via `preferencesStore`.
**Deliverables:**
- `apps/web/src/views/Algorithms/AlgorithmsView.tsx`.
- `apps/web/src/views/Algorithms/AlgorithmCard.tsx`.
- `packages/types` extension: `AlgorithmSet`, `AlgorithmCase`.
**Risks:** Library size. ⚠️ Without lazy loading the bundle blows up. **Mitigation:** virtualised list (`@tanstack/react-virtual`).
**Dependencies:** Phase 6.
**Docs:** `TDD-XX-AlgorithmsView.md`.

### Phase 11 — Competitions & Community

**What:** Round flow (Scramble → Inspection → Attempt → Result). Leaderboards.
**Why:** Community retention.
**Acceptance:**
- `activeView === 'competitions'` shows `<CompetitionList>`.
- Round detail: `<RoundDetail>` with attempt inputs (manual entry + Smart Cube fallback).
- Leaderboard uses only `anonymisedHandle + PB + best-of-round`.
- WCA-style exports as CSV from `<CompetitionExportButton>`.
**Deliverables:**
- `apps/web/src/views/Competitions/CompetitionsView.tsx`.
- `apps/web/src/views/Competitions/RoundDetail.tsx`.
- Aggregation in `packages/analysis-engine`.
**Risks:** Privacy/anonymity expectations. **Mitigation:** opt-in only, no real-name sync.
**Dependencies:** Phase 7 (reuses drill aggregator subset).
**Docs:** `TDD-XX-CompetitionsView.md`.

### Phase 12 — Smart Cube dedicated view

**What:** `activeView === 'smart-cube'` becomes a real screen, not a dialog.
**Why:** Battery, firmware, multi-device pairing need real estate.
**Acceptance:**
- Shows device list, last sync, battery, gyro/chip model, calibration history, firmware version.
- "Test move" micro-canvas renders live.
- Reuses `Cube3DPip` if scale allows.
**Deliverables:**
- `apps/web/src/views/SmartCube/SmartCubeView.tsx`.
- Refactor `CubeConnector` into `web-bluetooth` adapter exposing the same singleton with state surface.
**Risks:** iOS Safari fallback. Keep the graceful "Not supported on iOS Safari" panel visible.
**Dependencies:** Phase 2 (CubeConnector unmounted from Header).
**Docs:** `TDD-XX-SmartCubeView.md`.

### Phase 13 — Polish, accessibility, performance, telemetry, docs

**What:** Closing pass on a11y, performance budgets, browser matrix, internal telemetry, documentation refresh.
**Why:** Without this, every prior fase slips back into entropy.
**Acceptance:**
- Lighthouse desktop score ≥ 95 (perf, a11y, best-practices, SEO).
- Lighthouse mobile score ≥ 90.
- axe tests across every `activeView` pass.
- TTI ≤ 2.5 s on simulated slow 4G; ≤ 1.0 s on cable.
- Recharts isolated to AnalyticsView bundle (size ≤ 60 kB gzipped).
- Documentation: `Architecture_Overview.md` updated; `UI_Map.md` keeps every view; `16-user/` has 1 page per view.
- Source map for bundle splits visible via Vite analyzer; CI checks `bundle:report` size.
**Deliverables:**
- `docs/02-architecture/overview/UI_Map.md` final.
- `docs/16-user/<view>/index.md` for each view.
- Visual regression baseline for every view in light + dark.
**Risks:** A11y regressions. **Mitigation:** axe in CI on `viewComponents` map.
**Dependencies:** Phases 1–12.
**Docs:** CHANGELOG + UI Map refresh.

### Cross-cutting concerns — enforced throughout

These are **not phases**, they are constraints applied during any fase:

- **Performance budgets** (see §2.5): any PR that pushes a view above the budget is rejected with a comment pointing to the offending chunk.
- **Accessibility** (see §2.3): CI fails on any axe violation on a public view.
- **Documentation** (see §2.8): a view merged without TDD approval is reverted.
- **Naming** (see §2.4): ESLint enforces `navData` constant naming + `View` suffix on top-level routes.
- **Migration safety:** every phase is built behind a feature flag (`?feature=...`) until smoke-tested in staging for at least one minor release. CubeForge is opinionated about **avoiding silent regressions** for cubers.

---

## 13. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| 3D worker singleton regression on phased mounts | Medium | High | Codify `workerSingleton` invariant; module-level only; CI snapshot of Cube3DPanel mount cycle. |
| Visual drift away from bone-white palette | High over years | High | Phase 0 CI guard + ADR; design review at every merge. |
| TimesList click-to-detail feels heavy on mobile | Medium | Medium | Bottom sheet with snap points; virtualization for analysis accordions. |
| Recharts bundle inflates initial load | Medium | High | Code-split via `import()`; only AnalyticsView pays the cost. |
| Coming-Soon items get clicked and break trust | Low | Medium | Static guard + visible disabled state; auto redirect to SettingsDialog if ever required. |
| 3D-Context leaks across views | Low | High | `Cube3DContext` is created lazily and explicit-unsubscribed. |
| Method-default drift breaks existing solves | Medium | Medium | Freeze `analysis.method` at solve time; never retro-mutate. |
| Cubers on iOS Safari hit Bluetooth wall | Static | Low | Graceful "Not supported on iOS Safari" panel in SmartCubeView; documentation. |
| Performance regressions as views grow | Medium | High | Lighthouse CI gate on every PR; bundle-analyzer in CI. |

---

## 14. Glossary

| Term | Meaning in CubeForge |
|---|---|
| **`activeView`** | State value (`packages/state/navigationStore`) naming the current top-level area. |
| **AppShell** | The new compositional root replacing `MainLayout`'s responsibilities for routing. |
| **Cuber** | User (speedcube practitioner). The persona the design is centered on. |
| **Cube3DContext** | React context that lets any view consume the 3D engine + adapters. |
| **`storedSolve`** | The Dexie row in IndexedDB containing `time`, `scramble`, `penalty`, `method`, `analysis`. |
| **ChromeOverlay** | Reusable, theme-aware info strip at the bottom of any 3D-feel view. |
| **Session stats vs Analytics** | Two scopes: hot/live vs cold/historical. Same data, different temporal lens. |
| **PIP cube** | Picture-in-Picture mini-cube component (≤ 200×200), opt-in per view. |
| **WIP — Pulse** | An ADR or RFC under construction. |
| **PHASE X** | Granular roadmap stage defined in §12. |

---

## 15. Acceptance criteria summary

A view (UI surface) is ready to ship **only** if:

| Criterion | Measure |
|---|---|
| **Visual** | Uses only tokens from `index.css`; no hardcoded colours. |
| **Motion** | Easing `[0.4,0,0.2,1]`; duration in the four-tier scale; respects `useReducedMotion`. |
| **Accessibility** | Lighthouse a11y ≥ 95; axe clean; keyboard-operable. |
| **Performance** | Per-view bundle ≤ 35 kB gzipped; no Recharts imported outside AnalyticsView. |
| **Naming** | `View` suffix on routes; constants exported from `*.constants.ts`. |
| **Tests** | Component integration + visual snapshot + axe in CI. |
| **Documentation** | TDD approved; entry in `UI_Map.md`; one user-guide page in `16-user/`. |
| **Coming Soon semantics** | Items respecting opacity-50 cursor-not-allowed + `title` + `aria-disabled`. |
| **Brand consistency** | No OKLCH, no `dark` warm palette, no banner modals. |
| **Data contracts** | All shapes typed in `packages/types` with Zod schemas for persistence. |

---

> **End of audit.** This document is the **entrypoint** for any roadmap-aligned UI work. From here, the natural next steps are drafting the corresponding RFC and ADRs (`RFC-UI-XXX-Architecture.md`, `ADR-024-Visual_Identity_Freeze.md`, `ADR-025-UI_Redesign.md`) and the per-view TDDs that the phases list above already imply.
