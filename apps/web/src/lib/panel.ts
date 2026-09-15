/**
 * Cubalyze Panel Tokens
 *
 * Canonical className strings for panel / card primitives.
 *
 * Rules (from DESIGN.md + real codebase standard):
 *   - Corner radius: `rounded-lg` (8 px) -- the real standard across all panels.
 *   - Border:        `border border-line` -- 1 px hairline (#e9ecef / #2a2f35).
 *   - Background:    `bg-surface` -- always one level above canvas.
 *   - Padding scale: px-5/py-4 desktop, px-4/py-3 touch.
 *
 * Usage:
 *   import { PANEL_BASE } from "@/lib/panel";
 *   <div className={cn(PANEL_BASE, "flex flex-col gap-2")} />
 *
 * Do NOT use these for full-height layout containers (those own their
 * own scroll / overflow / flex setup and should not carry card padding).
 */

/** Standard content panel -- 20px h / 16px v, responsive for touch. */
export const PANEL_BASE =
  "rounded-lg border border-line bg-surface px-5 py-4 max-lg:px-4 max-lg:py-3" as const;

/** Compact panel -- 16px h / 12px v, for denser info-heavy cards. */
export const PANEL_COMPACT =
  "rounded-lg border border-line bg-surface px-4 py-3" as const;

/** Flush panel -- no internal padding; owns its inner layout (lists, tables, canvases). */
export const PANEL_FLUSH =
  "rounded-lg border border-line bg-surface overflow-hidden" as const;

/**
 * Metric grid -- hairline-separated tile grid.
 * Use `gap-px` on a `bg-line` background; wrap each tile in a `bg-surface` div.
 * Example: `<div className={cn(PANEL_METRIC_GRID, "grid-cols-4")}>`
 */
export const PANEL_METRIC_GRID =
  "grid gap-px overflow-hidden rounded-lg border border-line bg-line" as const;

/**
 * CSS semantic class for a glass selection pill (active row/item indicator).
 * Applied by the liquid-glass engine when `html.liquid-glass` is active.
 * Used in SolveListPanel's ActivePill and the LeftSidebar active background.
 * Always combine with `bg-sidebar-accent` as the non-glass fallback color.
 *
 * Selection Pill Geometry Rules (TDD / Visual Standard):
 *   - NEVER use `inset-y-0` in packed lists (it touches cell dividers causing visual line artifacts).
 *   - Use `inset-x-1.5 inset-y-0.5` (or padded floating rows) with `rounded-md`.
 *   - All 4 sides must carry `border: 1px solid var(--glass-border)` so it reads as a true floating frosted card.
 *
 * Example:
 *   <div className="pointer-events-none absolute inset-x-1.5 inset-y-0.5 rounded-md bg-sidebar-accent glass-active-pill" />
 */
export const GLASS_ACTIVE_PILL_CLASS = "bg-sidebar-accent glass-active-pill" as const;

/**
 * Liquid Glass Button / Chip Tokens (engine-owned, apps/web/src/index.css).
 *
 * When html.liquid-glass is active, neutral button fills are remapped:
 *   - buttons with bg-surface / bg-card / bg-white / bg-background / bg-canvas
 *     adopt `var(--glass-btn-bg)` (translucent frosted chip) + glass hairline;
 *   - the secondary / muted / accent tokens point at the same chip token, so
 *     shadcn secondary/outline/ghost variants and selected chips tint with
 *     the backplate instead of rendering solid white/gray;
 *   - hover raises to `var(--glass-btn-bg-hover)` (+1px hairline shadow).
 *
 * Label text is never glass: text-surface / text-sidebar / text-accent
 * read the remapped tokens, so the engine restores their solid originals
 * for text usages only (inverted buttons stay readable).
 * Buttons NEVER get backdrop-filter under glass (nested blur → milky);
 * panels nested inside glass panels instead get a standard HALF-POWER
 * liquid (--glass-nested-bg + --glass-nested-blur, engine rule in
 * index.css) so inner surfaces read as depth, not dry fills. Toasts
 * (sonner, [data-sonner-toast]) join the panel rule, so they render
 * frosted like every other floating panel.
 * Primary / destructive / semantic state buttons keep their solid fills.
 * The dock, the context menu, the session switcher, the Settings /
 * Explorer sidebar tabs, the Training method rail and every X/cross
 * close button are the designed exceptions: they are flat (icon-only
 * pills / menu items / tabs / method buttons / closers), so the engine
 * zeroes their rest fill inside [data-context-zone="dock"],
 * [data-context-zone="context-menu"], [data-context-zone="session"],
 * [data-context-zone="settings-sidebar"],
 * [data-context-zone="explorer-sidebar"],
 * [data-context-zone="training-methods"],
 * [data-context-zone="algorithms-nav"],
 * [data-context-zone="mobile-header"] and
 * [data-context-zone="timer-actions"], plus a :has() glyph rule
 * for cross buttons (lucide X fingerprint) and the shadcn dialog-close
 * slot (only the hover chip remains).
 */

/**
 * Standard Input / Search Glass Integration:
 * When liquid-glass is active, all standard `[data-slot="input"]`, `input[type="text"]`,
 * and `textarea` elements inherit:
 *   - background: `var(--glass-bg-subtle)`
 *   - border: `1px solid var(--glass-border)`
 * This ensures search fields match the panel's tint instead of showing stark solid borders.
 */

