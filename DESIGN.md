---
name: CubeForge
description: A precision speedcubing platform — bone-white canvas, carbon ink, muted semantic timer states.
colors:
  primary: "#212529"
  primary-foreground: "#f8f9fa"
  canvas: "#f8f9fa"
  surface: "#ffffff"
  surface-2: "#f1f3f5"
  ink: "#212529"
  ink-2: "#495057"
  ink-3: "#667085"
  muted-foreground: "#667085"
  border: "#e9ecef"
  line: "#e9ecef"
  line-2: "#dee2e6"
  ready: "#2b7749"
  ready-soft: "#e7f1ea"
  hold: "#8c3c34"
  hold-soft: "#fbeae8"
  dnf: "#b3261e"
  dnf-soft: "#fcebec"
  plus2: "#96641e"
  plus2-soft: "#fbf0dc"
  caution: "#b45309"
  caution-soft: "#fef3c7"
  accent-emerald: "#047857"
typography:
  display:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace"
    fontSize: "clamp(3.75rem, 15vw, 9.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    letterSpacing: "0.18em"
    textTransform: "uppercase"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    border: "1px solid {colors.border}"
    padding: "8px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border}"
    padding: "16px 20px"
  sidebar-nav-item:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    padding: "8px"
  badge-secondary:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: CubeForge

## Overview

**Creative North Star: "The Speedroom"**

CubeForge is a room built for one thing: the solve. Everything in the interface exists to get a speedcuber to the timer, capture a clean result, and reveal what to fix next — with the minimum possible friction and decoration. The visual world is the coache's clipboard, not a video game: a pale bone-white canvas, carbon ink, tabular mono figures, and a short discipline of muted semantic accents that only ever speak to the current state of the cube (ready-green on your marks, warm-hold when applying reset pressure, dry yellow during inspection).

Two palettes share one architecture. The canvas is one step darker than the cards in dark mode so the stage reads as recessed while panels float on top; in light mode the canvas is the bone white and cards are white. Rarity is the discipline — accent washes appear only on state, never as decoration. The bigger the number, the more it earns the screen: the timer face is the legal maximum of the whole system.

**Key Characteristics:**
- One number rules the screen — the timer, set in tabular mono up to ~9.5rem, is always reachable and always legible.
- Flat at rest; depth arrives only as a response to state (hover, press, focus).
- A short, semantic accent vocabulary (ready / hold / caution / +2 / DNF) instead of a rainbow of chrome.
- A deliberately quiet, power-saving feel: low noise, thin 1px hairlines, tight tracking.
- The "phase rainbow" is the one sanctioned palette explosion — reserved for training completion and progress markers, never for chrome.

## Colors

Bone-white and carbon ink carry the page; a handful of muted semantic hues carry meaning. Accents are rare and deliberate.

### Primary
- **Carbon Ink** (#212529): the primary actionable color. Used for primary buttons, brand mark tile, and the collapsed number on the timer. In dark mode the ink inverts toward the paper (#e9ecef) so the same role reads on the dark canvas.

### Neutral
- **Bone Canvas** (#f8f9fa light / #14171b dark): the page background. One step below the surface tonal layer, so the stage sits recessed.
- **Card Surface** (#ffffff light / #1b1f23 dark): panels, widgets, dialogs. Sits one step above canvas.
- **Raised Surface** (#f1f3f5 light / #24292e dark): secondary plates, sidebar active pill, muted fills, chip fill.
- **Ink** (#212529 light / #e9ecef dark): primary text — the near-black that carries headlines and the timer.
- **Ink-2** (#495057 / #adb5bd in dark): secondary text and strong run-of-solve labels.
- **Ink-3 / Muted Foreground** (#667085 light, ~4.8:1 AA on white / #9099a3 dark): tertiary text, placeholder, hint lines. Bumped to gray-600 so secondary text passes WCAG AA.
- **Hairline** (#e9ecef / #2a2f35): 1px borders and dividers; **Hairline-2** (#dee2e6 / #343a40) reserved for the thin scrollbar thumb.

### Semantic accent set (the timer states)
- **Ready** (#2b7749, soft #e7f1ea): "on your marks" — green used for the ready timer state, PB gains, active pulse dot. Darkened from #4c9a6a so normal-size accent text clears 4.5:1 on the bone canvas (5.19:1) and its soft bg (4.73:1).
- **Hold** (#8c3c34, soft #fbeae8): warm reset pressure — applied while holding the cube on the pad. Darkened from #c8554a for AA (7.09:1), kept distinct from dnf.
- **DNF** (#b3261e, soft #fcebec): did-not-finish. The one hard destructive hue, shared with destructive buttons.
- **+2** (#96641e, soft #fbf0dc): two-second penalty — ochre, kept distinct from hold and caution. Darkened from #a8650a for AA (4.81:1).
- **Caution** (#b45309 light / #facc15 dark, soft #fef3c7): inspection countdown. Light mode sits at amber-700 so caution text clears 4.5:1 on the bone canvas while staying warm and distinct from +2's ochre; dark mode brightens to yellow-400 for the low-glare canvas.
- **Emerald Accent** (#047857 light / #34d399 dark): a single functional green for successful linkage and confirmation.

### Phase rainbow (the one sanctioned explosion)
A 12-tone Tailwind-400 vocabulary (blue, emerald, teal, amber, violet, purple, indigo, rose, cyan, orange, sky, pink) plus functional 500/600 shades, used to color-code training exercises, calendar tasks, and progress markers. Never used for chrome.

### Named Rules
**The One Number Rule.** The timer is the only element that may command more than ~5rem of type. Everything else yields to it.

**The Rare Accent Rule.** The semantic accents appear only on state. At rest the screen is ink on bone; color is earned by meaning.

## Typography

**Display Font:** ui-monospace / Cascadia Code / Source Code Pro / Menlo / Consolas (mono)
**Body Font:** ui-sans-serif / system-ui / Segoe UI (sans)
**Label Font:** the mono stack

**Character:** The pairing is the room: a calm, secular sans for the chrome and a tall, serious mono for everything measured. Two voices only — one narrates structure, the other narrates the result.

### Hierarchy
- **Timer** (400, `clamp(3.75rem,15vw,9.5rem)`, 1.0): the one number. Tabular, tight-tracked `-0.01em`, `leading-none`. Only the live/stopped solve may live here.
- **Headline** (600, ~1.25rem, sans): dashboard titles, card titles (`leading-none`).
- **Title** (600, ~1rem, sans): section and panel headings.
- **Body** (400, 0.875rem, 1.5, sans): default running text, ~65 Chromatic limit for paragraph content.
- **Label / Hint** (400, 0.7rem, mono): the context hint under the timer and eyebrow labels — uppercase, tracked `0.18em`, ink-3. The uppercase mono eyebrow is the signature micro-voice of the room.

### Named Rules
**The Measured-Only Rule.** Only real measurements render in mono: times, deltas, timestamps, notes. Chrome that "decorates" with mono is misusing the two-voice system.

## Layout

A fixed chrome shell around one growing stage. Desktop uses a collapsed-or-hover rail (56px collapsed, 208px expanded), grouped nav, and a full-bleed stage; below 1024px the rail collapses into a touch tab bar and sheet navigation with safe-area play (`env(safe-area-inset-*)`). The stage owns the remaining space and the timer sits centered on it, vertically and horizontally, so it is one tap/key from any place in the product.

Rhythm is the 4 → 12 → 16 → 24px scale: compact 8px inside controls, 12px between a control and its eyebrow, 16-24px between panels. Bodies scale `clamp()` for the timer but stay on a fixed 0.875rem base elsewhere. The whole app is a single overflow-hidden viewport — scrolling happens inside panels, never the page.

## Elevation & Depth

Flat by default, flat is the law. Depth is expressed through **tonal layering** (canvas darker than surface, surface darker than the raised `surface-2`) plus 1px hairlines, never through heavy shadows.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A soft shadow appears only as a response to state — a raised/hover card or elevated layer — and stays subtle (`shadow-xs`/`shadow-sm`). No ambient shadow on resting layout.

## Shapes

Deliberately restrained geometry. The form language is **soft, not fancy**: `rounded-md` (6px) for buttons and inputs, `rounded-lg` (8px) for **all content panels and cards** (the real app standard — see `PANEL_BASE` in `lib/panel.ts`), `rounded-xl` (12px) reserved for media containers (cube canvas viewport, replay transport bar, modal sheets), full roundness (`9999px`) for dots, avatars, and scrollbar thumbs. Corners never exceed 12px on the largest interactive surface. The brand mark and CubeMark are square tiles (`rounded-md`) — the room has no mascot and hides nothing behind a logo.

## Components

Each component is soft, restrained, and state-aware — tactile on hover, calm at rest.

### Buttons
- **Shape:** `rounded-md` (6px), height 36px (32px small, 40px large), `shadow-xs` base.
- **Primary:** Carbon Ink background (#212529), paper foreground. On hover the ink thins (`bg-primary/90`); focus gets a 3px `ring-ring/50` ring plus a `border-ring`.
- **Outline:** transparent/paper background, 1px Hairline border; hover fills `bg-accent` (raised surface). Dark mode uses a translucent `bg-input/30` stroke.
- **Secondary:** raised-surface fill, ink text. **Ghost:** no fill at rest, raised-surface wash on hover. **Destructive:** DNF red.
- **Motion:** `transition-all` ~150-200ms; `[&_svg]` icons sized 16px. +2px raise on press variants via transforms where used.
- **Liquid Glass Theme:** neutral fills (`bg-surface` / `bg-surface-2` / `bg-card` / `bg-white` / `bg-background` / `bg-canvas`) remap to the frosted chip token `--glass-btn-bg`, and the `secondary` / `muted` / `accent` tokens inherit the same chip tone — so buttons and chips never render as solid white/gray blocks against the amber glass backplate (engine-owned in `index.css`, no component changes needed). Hover raises the chip to `--glass-btn-bg-hover` with a hairline shadow instead of an opaque wash. Buttons carry **no** `backdrop-filter` (they nest inside already-blurred panels — blur-over-blur turns milky). Primary, destructive and the semantic state buttons (ready / hold / dnf / +2 / caution, `bg-ink`) keep their solid fills so emphasis survives the glass. **Dock + context-menu items are the designed exceptions:** flat surfaces by design (icon-only macOS-style pills in the dock; icon+label items in the right-click menu) — the engine's `hover:bg-surface-2` match is zeroed at rest inside `[data-context-zone="dock"]` and `[data-context-zone="context-menu"]`, so they never show a persistent background (only the hover chip remains).

### Badges / Chips
- **Style:** `rounded-md` (6px), `text-xs`, 2px 8px padding, 1px hairline border for outline variants. **Secondary** fill is the raised surface.
- **State:** selected chips swap to Carbon Ink primary fill with paper text.

### Cards / Containers
- **Corner Style:** `rounded-lg` (8px) — the real standard for all content panels and cards across the app. `rounded-xl` (12px) is reserved for media containers (cube canvas, replay transport, floating modals).
- **Background:** surface (#ffffff light / #1b1f23 dark).
- **Shadow Strategy:** `shadow-sm` only when raised; resting cards are flat behind a 1px hairline.
- **Internal Padding:** 20px horizontal / 16px vertical (`px-5 py-4`); touch-responsive `max-lg:px-4 max-lg:py-3`. Canonical constant: `PANEL_BASE` in `apps/web/src/lib/panel.ts`.
- **CardTitle:** `leading-none`, semibold, sans.

### Inputs / Fields
- **Style:** transparent background, 1px Hairline border, `rounded-md` (6px), height 36px, 12px x-padding, `text-base`-at-`md:text-sm`.
- **Liquid Glass Theme:** inputs adopt `var(--glass-bg-subtle)` fill and `var(--glass-border)` border so search fields harmonize seamlessly with the glass backplate without stark white lines.
- **Focus:** border shifts to `border-ring` with a 3px `ring-ring/50` ring. **Error:** `border-destructive` + `ring-destructive/20`. **Disabled:** 50% opacity, not-allowed cursor.

### Active Selection Pills (Rail & Lists)
- **Style:** Floating frosted card (`.glass-active-pill`) with `rounded-md` (6px), complete 4-sided `1px solid var(--glass-border)`, and `backdrop-filter: blur(10px) saturate(150%)`.
- **Geometry Rule:** Always maintain inset breathing room (e.g. `inset-x-1.5 inset-y-0.5` or container padding). Never use `inset-y-0` against dividing lines, ensuring zero edge-clipping artifacts across list rows and sidebars.

### Navigation (sidebar rail)
- **Style:** a grouped rail of `rounded-md` items, `text-sm`, 8px padding, 16px gaps. Inactive items are `text-sidebar-foreground/70`; hover adds a raised-surface wash (`hover:bg-sidebar-accent`).
- **Active:** a raised-surface pill (`bg-sidebar-accent`) sits under the item, springing between destinations (`ACTIVE_PILL_SPRING`, spring 380/30) — the pill is a motion layer, not a colored highlight.
- **Brand:** header tile is `size-8 rounded-md bg-ink text-surface` — a carbon square holding the CubeMark.
- **Status:** the Timer item shows a `size-1.5 rounded-full bg-ready animate-pulse` dot while a solve engine is primed.
- **Mobile:** below 1024px the rail becomes a touch tab bar with `pb-safe` safe-area padding; navigation opens a Sheet.

### Timer Face (signature)
- **Shape / Color:** tabular mono, tracked `-0.01em`, `leading-none`, default ink. Size `clamp(3.75rem, 15vw, 9.5rem)`.
- **State colors:** idle/running = Ink; inspection = Caution (yellow); holding = Hold (warm); ready = Ready (green); checking move = Ink-2. Holding also downscales the face to `scale-[0.985]`. Transitions ~150ms, ease-out.
- **PB delta:** a secondary inline tabular value (up to ~1.8rem) above the acid test: negative = Ready green with `−`, positive = DNF red with `+`.
- **Hint eyebrow:** the uppercase mono micro-voice (`0.7rem`, `tracking-[0.18em]`, ink-3) sits one rhythm step below the number with an `aria-live` polite announce.
- **Inspection:** swaps to a 15 → +2 → DNF countdown in the same face, color-shifted to Caution.

## Do's and Don'ts

### Do:
- **Do** let the timer number own the stage; keep everything else out of its size class.
- **Do** use the accent vocabulary only for real state (ready / hold / caution / +2 / DNF), and reserve the phase rainbow for training/progress markers alone.
- **Do** keep ink on bone at rest; earn color with meaning.
- **Do** render measurements in the mono face with tabular numerals.
- **Do** show depth as tonal layering + hairlines first, soft shadows only when a panel is raised.
- **Do** keep corners within the 4-12px discipline (6px controls, 12px cards) and reserve full roundness for dots and avatars.

### Don't:
- **Don't** introduce raw saturated gradients, neon glows, or glassmorphism chrome — the room is flat and low-noise.
- **Don't** restyle the timer appearance for hunks; it only changes color by state in the documented set.
- **Don't** add ambient shadows to resting layout.
- **Don't** paint chrome in the phase rainbow; it is a data-specimen palette, not a UI theme.
- **Don't** set body text narrower than ~0.75rem or below ink-3's AA-passing contrast.
- **Don't** add a mascot, illustration layer, or decorative serif display font.