"use client";

import { memo, useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import type { Solve } from "@/types";
import { SlotLayout } from "./SlotLayout";
import {
  DEFAULT_SLOT_TEMPLATE,
  getSlotTemplate,
  resolveSlotContent,
} from "./slot-templates";
import type { SlotContentConfig } from "./types";

export interface BottomLayoutProps {
  /** Selected template id (preference `bottomLayoutTemplate`). */
  templateId: string;
  solves: Solve[];
  className?: string;
  /** Filter solves to a specific puzzle type (e.g. '333', '222'). */
  puzzleFilter?: string;
  /** Injected 2D scramble net rendered by slots with a `scramble-2d` display. */
  scramble2d?: ReactNode;
  /** Injected 3D scramble rendered by slots with a `scramble-3d` display. */
  scramble3d?: ReactNode;
  /** Raw scramble string used by solvers (e.g. cross solver). */
  currentScramble?: string;
  /** Force phone density regardless of the real viewport (theme-studio mobile frame). */
  compact?: boolean;
  /** Force vertical (right rail) rendering. */
  vertical?: boolean;
}

/**
 * Renders the selected slot layout underneath (or beside) the timer.
 * Unknown ids fall back to the default template; persisted slot configs
 * are migrated on read, so old preferences never crash the render.
 *
 * Memoized: re-renders only when its props change, and `slotContent` keeps
 * a stable identity so SlotLayout's memo holds too.
 */
export const BottomLayout = memo(function BottomLayout({
  templateId,
  solves,
  className,
  puzzleFilter,
  scramble2d,
  scramble3d,
  currentScramble,
  compact = false,
  vertical = false,
}: BottomLayoutProps) {
  const configuredSlots = useStore(preferencesStore, (s) => s.bottomLayoutSlots);
  const template = getSlotTemplate(templateId) ?? DEFAULT_SLOT_TEMPLATE;

  const slotContent: Record<string, SlotContentConfig> = useMemo(() => {
    const resolved: Record<string, SlotContentConfig> = {};
    for (const slot of template.slots) {
      resolved[slot.id] = resolveSlotContent(
        configuredSlots as Record<string, unknown>,
        template.id,
        slot.id,
        slot.defaultContent,
      );
    }
    return resolved;
  }, [template, configuredSlots]);

  return (
    <SlotLayout
      template={template}
      solves={solves}
      puzzleFilter={puzzleFilter}
      className={className}
      slotContent={slotContent}
      scramble2d={scramble2d}
      scramble3d={scramble3d}
      currentScramble={currentScramble}
      compact={compact}
      vertical={vertical}
    />
  );
});
