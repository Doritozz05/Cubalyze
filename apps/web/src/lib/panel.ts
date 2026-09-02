/**
 * CubeForge Panel Tokens
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
 * Standard Input / Search Glass Integration:
 * When liquid-glass is active, all standard `[data-slot="input"]`, `input[type="text"]`,
 * and `textarea` elements inherit:
 *   - background: `var(--glass-bg-subtle)`
 *   - border: `1px solid var(--glass-border)`
 * This ensures search fields match the panel's tint instead of showing stark solid borders.
 */

