"use client";

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
  /** Force phone density regardless of the real viewport (theme-studio mobile frame). */
  compact?: boolean;
  /** Force vertical (right rail) rendering. */
  vertical?: boolean;
}

/**
 * Renders the selected slot layout underneath (or beside) the timer.
 * Unknown ids fall back to the default template; persisted slot configs
 * are migrated on read, so old preferences never crash the render.
 */
export function BottomLayout({
  templateId,
  solves,
  className,
  puzzleFilter,
  scramble2d,
  compact = false,
  vertical = false,
}: BottomLayoutProps) {
  const configuredSlots = useStore(preferencesStore, (s) => s.bottomLayoutSlots);
  const template = getSlotTemplate(templateId) ?? DEFAULT_SLOT_TEMPLATE;

  const slotContent: Record<string, SlotContentConfig> = {};
  for (const slot of template.slots) {
    slotContent[slot.id] = resolveSlotContent(
      configuredSlots as Record<string, unknown>,
      template.id,
      slot.id,
      slot.defaultContent,
    );
  }

  return (
    <SlotLayout
      template={template}
      solves={solves}
      puzzleFilter={puzzleFilter}
      className={className}
      slotContent={slotContent}
      scramble2d={scramble2d}
      compact={compact}
      vertical={vertical}
    />
  );
}
