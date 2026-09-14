"use client";

import { cn } from "@/lib/utils";
import type { SubBadge } from "@/utils/subBadges";

export type SubBadgeStyleVariant = "solid" | "gradient" | "outline";

interface BadgeColor {
  base: string;
  dark: string;
}

/**
 * Professional badge palette: 10 hardcoded solid colors.
 * Inline styles (not Tailwind classes) so dynamic picks never hit purge.
 */
export const SUB_BADGE_PALETTE: BadgeColor[] = [
  { base: "#2563EB", dark: "#1E40AF" },
  { base: "#059669", dark: "#065F46" },
  { base: "#D97706", dark: "#92400E" },
  { base: "#E11D48", dark: "#881337" },
  { base: "#7C3AED", dark: "#4C1D95" },
  { base: "#0891B2", dark: "#164E63" },
  { base: "#DB2777", dark: "#831843" },
  { base: "#65A30D", dark: "#3F6212" },
  { base: "#0F766E", dark: "#134E4A" },
  { base: "#475569", dark: "#1E293B" },
];

export const SUB_BADGE_VARIANTS: SubBadgeStyleVariant[] = [
  "solid",
  "gradient",
  "outline",
];

export interface SubBadgeStyle {
  colorIndex: number;
  variant: SubBadgeStyleVariant;
  base: string;
  dark: string;
}

/** FNV-1a 32-bit — stable across sessions, devices, accounts. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic style for a badge: same puzzle + threshold → same color +
 * variant on every account, device and session. Pure function, no hooks,
 * no randomness. Variant reads higher hash bits so it does not correlate
 * with the color index.
 */
export function badgeStyleFor(badge: {
  puzzle: string;
  seconds: number;
}): SubBadgeStyle {
  const h = hashString(`${badge.puzzle}:${badge.seconds}`);
  const colorIndex = h % SUB_BADGE_PALETTE.length;
  const variant =
    SUB_BADGE_VARIANTS[
      Math.floor(h / SUB_BADGE_PALETTE.length) % SUB_BADGE_VARIANTS.length
    ];
  const color = SUB_BADGE_PALETTE[colorIndex];
  return { colorIndex, variant, base: color.base, dark: color.dark };
}

function styleForVariant(style: SubBadgeStyle): React.CSSProperties {
  switch (style.variant) {
    case "solid":
      return {
        backgroundColor: style.base,
        borderColor: style.dark,
        color: "#FFFFFF",
      };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(135deg, ${style.base}, ${style.dark})`,
        borderColor: style.dark,
        color: "#FFFFFF",
      };
    case "outline":
      return {
        backgroundColor: "transparent",
        borderColor: style.base,
        color: style.base,
      };
  }
}

const BADGE_FRAME =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap select-none";

export function SubBadge({
  badge,
  style,
  className,
}: {
  badge: SubBadge;
  style: SubBadgeStyle;
  className?: string;
}) {
  return (
    <span className={cn(BADGE_FRAME, className)} style={styleForVariant(style)}>
      <span className="nums">Sub {badge.thresholdLabel}</span>
      <span className="font-medium opacity-85">{badge.puzzleLabel}</span>
    </span>
  );
}

/** Neutral "+N" overflow chip, same frame, no random color. */
export function SubBadgeOverflow({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        BADGE_FRAME,
        "border-line bg-surface-2 text-ink-2",
        className,
      )}
    >
      <span className="nums">+{count}</span>
    </span>
  );
}
