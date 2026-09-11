"use client";

/**
 * collectionIcons.ts — the icon vocabulary for Locker categories.
 *
 * The model stores an icon **id** (a plain string) so it stays pure and
 * persistence-safe; this module is the only place that maps that id to an
 * actual Lucide component. Unknown ids fall back to the neutral gear icon.
 */

import {
  Archive,
  Box,
  Boxes,
  Circle,
  Crosshair,
  Disc3,
  Droplets,
  Gem,
  Gift,
  Layers,
  Package,
  Puzzle,
  Ruler,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Timer,
  Trophy,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Box,
  Boxes,
  Package,
  Archive,
  Droplets,
  Wrench,
  Timer,
  Layers,
  Sparkles,
  Circle,
  Disc3,
  Puzzle,
  ShoppingBag,
  Ruler,
  Zap,
  Star,
  Tag,
  Gift,
  Crosshair,
  Gem,
  Trophy,
};

export const CATEGORY_ICON_IDS = Object.keys(CATEGORY_ICONS);

/** Resolve an icon id to a component, defaulting to the gear icon. */
export function categoryIcon(id: string | undefined): LucideIcon {
  return (id && CATEGORY_ICONS[id]) || Package;
}
