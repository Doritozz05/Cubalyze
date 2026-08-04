# TDD-0020: Onboarding Tour (First-Load Spotlight Walkthrough)

## 1. Overview

Implements the **P0 onboarding** specified in `docs/plan_onboarding/README.md`: a one-shot
spotlight walkthrough shown on first launch that tours the main tabs (Timer → Stats →
Algorithms → Profile → Widgets → final CTA). Skill Tree and Training are **excluded**.

**Decisions locked in the plan (user-confirmed):**
- **Gate**: persisted flag `onboarding_completed` in the `app_meta` KV table (no SQL migration).
- **Format**: spotlight walkthrough built with **framer-motion** + existing `packages/ui`
  components. **Zero new dependencies** (AGENTS.md §4).

**Goals:**
- Show the tour exactly once (or until skipped), never re-show automatically.
- Never block the timer: the tour prevents accidental start but ends with a "make your
  first solve" CTA.
- Respect `prefers-reduced-motion`, work on touch (<1024px) and desktop, be fully a11y-correct.

## 2. File structure (< 300 lines/file)

```text
packages/database/src/repositories/app-meta.repository.ts   // +ONBOARDING_KEY +2 methods
packages/database/src/__tests__/profile.repository.test.ts  // +4 tests (AppMeta block)

apps/web/src/hooks/onboardingCore.ts        // pure state machine (headless, testable)
apps/web/src/hooks/useOnboarding.ts         // module-level singleton (pattern: useProfile)
apps/web/src/hooks/onboardingCore.test.ts   // vitest: transitions + init semantics

apps/web/src/components/Onboarding/
├── tourSteps.ts            // declarative step registry (6 steps)
├── OnboardingSpotlight.tsx // mask div (box-shadow) animated with framer-motion
├── TourTooltip.tsx         // card + dots + Skip/Back/Next/Done + position resolver
└── OnboardingTour.tsx      // orchestrator: measure targets, keydown guards, a11y

apps/web/src/App.tsx                        // auto-start + eligibility guard + wiring
apps/web/src/hooks/useShortcuts.ts          // +enabled prop
apps/web/src/components/Settings/sections/GeneralSection.tsx  // +replay row
apps/web/src/components/Scramble/ScrambleDisplay.tsx          // +data-onboarding-target
apps/web/src/components/Insights/InsightsDashboard.tsx        // +data-onboarding-target
apps/web/src/views/Practice/PracticeDashboard.tsx             // +data-onboarding-target
apps/web/src/components/Identity/ProfileHero.tsx              // +data-onboarding-target
apps/web/src/components/Layout/LeftSidebar.tsx                // +target on "Widgets" item
apps/web/src/components/Layout/Header.tsx                     // +target on touch Widgets btn
apps/desktop/src/database-override.ts      // +ONBOARDING_KEY re-export (keep in sync)
packages/database/src/repositories/index.ts // +ONBOARDING_KEY export
```

## 3. Persistence API (packages/database)

```typescript
export const ONBOARDING_KEY = 'onboarding_completed';

class AppMetaRepository {
  getOnboardingCompleted(): Promise<boolean>; // get(ONBOARDING_KEY) === '1'
  setOnboardingCompleted(): Promise<void>;    // set(ONBOARDING_KEY, '1')
}
```

No migration. Re-exported from `repositories/index.ts` and the desktop `database-override.ts`.

## 4. Pure state machine (apps/web/src/hooks/onboardingCore.ts)

```typescript
export type OnboardingStatus = 'loading' | 'idle' | 'active' | 'done';
export const ONBOARDING_TOTAL_STEPS = 6;

export interface OnboardingState { status: OnboardingStatus; currentStep: number }

onboardingInitialState(completed: boolean): OnboardingState // completed ? done : idle
onboardingStart(s): OnboardingState      // idle → active(0); otherwise unchanged
onboardingNext(s): OnboardingState       // active: last step → done; else step+1
onboardingBack(s): OnboardingState       // active: step>0 → step-1; else unchanged
onboardingReplay(s): OnboardingState     // done → active(0)
onboardingIsLast(s): boolean             // active && step === TOTAL-1
```

Contract: `skip`/`complete` are pure `done` transitions; **persisting the flag is the
hook's concern** (not the core's), so the core stays headless-testable.

## 5. Hook (apps/web/src/hooks/useOnboarding.ts)

Module-level singleton + `useSyncExternalStore` (exact pattern of `useProfile`).

```typescript
interface UseOnboardingResult {
  status: OnboardingStatus;
  currentStep: number;
  totalSteps: number;
  start: () => void;             // idle → active(0)
  next: () => void;              // active step+1 | done (persists on last)
  back: () => void;
  skip: () => Promise<void>;     // active → done + setOnboardingCompleted()
  complete: () => Promise<void>; // active → done + setOnboardingCompleted()
  replay: () => void;            // done → active(0), never persists
}
```

- `ensureInitialized()`: `initDB()` → `getOnboardingCompleted()` → `idle` or `done`.
  Shared promise, idempotent under StrictMode (pattern `useProfile`).
- Persist failures are non-fatal (log + still transition in-memory).

## 6. Tour steps (tourSteps.ts)

| # | id | view | target selector |
|---|---|---|---|
| 1 | timer | `timer` | `[data-onboarding-target="timer"]` |
| 2 | stats | `insights` | `[data-onboarding-target="insights"]` |
| 3 | algorithms | `practice` | `[data-onboarding-target="practice"]` |
| 4 | profile | `profile` | `[data-onboarding-target="profile"]` |
| 5 | widgets | `timer` | `[data-onboarding-target="widgets-entry"]` |
| 6 | final | `timer` | — (centered tooltip, no target) |

```typescript
export interface TourStep { id: string; view: ViewId; title: string; body: string; target?: string }
```

`target` optional (final step). Micro-copy lives in the registry (English, matches app UI).

## 7. OnboardingTour behavior

- On step change: `onNavigate(step.view)`, then measure `querySelector(step.target)`
  → `getBoundingClientRect()`. The rect is committed only after 2 consecutive identical
  frames (skips hidden/zero-size targets) so slide-ins, view transitions and layout
  shifts can't strand the highlight on stale coordinates. Retry up to ~500ms. Missing
  target → centered tooltip, never blocks. The committed box is padded +6px so the
  ring/rounded corners never clip content flush against the target's edges.
- Mask: `motion.div` absolutely positioned at the rect with
  `box-shadow: 0 0 0 9999px rgba(0,0,0,0.55)` (pure neutral black — no blue
  tint) + `border-line` ring + `rounded-xl`. Spring animation between steps
  (disabled under `prefers-reduced-motion`).
- Tooltip: desktop resolves side (bottom preferred, flip top/left/right by space);
  touch (<1024px via `useIsTouch`) anchors bottom-center above the bottom tab bar.
- Keydown while active: `Escape` → skip; `Space`/arrows → `preventDefault` (never arms the timer).
- a11y: `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby`,
  `aria-live="polite"` step announcements, focus moved to tooltip on enter, focus-visible rings.
- App integration: `WidgetHost`/`CubeButtonGate` hidden while active; `useShortcuts` gains
  `enabled?: boolean` (default true) wired to `status !== 'active'`.

## 8. Auto-start + eligibility guard (App.tsx)

When `useOnboarding.status === 'idle'` **and** `useProfile` not loading **and**
`usePersistentSession` not loading → check the secondary guard:

```typescript
const hasData = solves.length > 0 || !!profile?.displayName?.trim() || !!profile?.handle?.trim();
hasData ? complete() /* persist done, never show */ : setTimeout(start, 600)
```

The 600 ms delay lets the timer paint first. Guard reads **after** session load finishes
(`loading === false`) so returning users never see the tour.

## 9. Tests

| Area | File | Cases |
|---|---|---|
| Repo | `profile.repository.test.ts` (AppMeta block) | `getOnboardingCompleted` false when missing; true after `setOnboardingCompleted`; set is INSERT OR REPLACE; idempotent |
| Core | `onboardingCore.test.ts` | initial idle/done; start idle→active; start active no-op; next through 6 steps (last → done); back clamps at 0; replay done→active(0); isLast |

## 10. Exit criteria / DoD

1. First launch (empty DB, default profile) → tour auto-starts after ~600 ms.
2. Skip/ESC/backdrop-click/complete → flag persisted; reload never re-shows.
3. Returning user (has solves or edited profile) → tour never auto-shows.
4. Replay from Settings → General → tour runs again; flag untouched.
5. Timer cannot start while the tour is active; widgets/3D button hidden.
6. `pnpm typecheck` (apps/web, packages/database), `npx vitest run` (new tests), lint clean.
7. Desktop (`database-override.ts`) compiles with the new `ONBOARDING_KEY` export.

## 11. Out of scope

- Training / Skill Tree stops (user decision).
- Welcome step-0 modal (plan D6: tour starts directly on Timer).
- Widget Explorer auto-open preview in step 5 (tour only highlights the entry point).
- Persisting per-step progress (reload mid-tour restarts from step 0, plan D3).
