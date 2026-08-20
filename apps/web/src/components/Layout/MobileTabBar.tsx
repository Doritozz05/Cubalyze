"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Timer, Target, BookOpen, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import type { ParseKeys } from "i18next";
import type { ViewId } from "./sidebar.constants";

/**
 * Standard native bottom tab bar for the touch regime (phones + small tablets, <768px).
 *
 * Features:
 * - 4 primary tabs (Training, Algorithms, Timer, Stats). The "More" entry
 *   lives in the top bar (touch header) — it opens the shared grid sheet.
 * - Ultra-clean native aesthetic (iOS / Instagram style).
 * - High-contrast active tab accent color & crisp typography.
 * - Zero decorative noise or weird shape overlays.
 */

interface MobileTabBarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  className?: string;
}

type TabItem = {
  id: ViewId;
  /** i18n key in the `nav` namespace — translate at render time. */
  labelKey: ParseKeys<"nav">;
  icon: React.ElementType;
};

const MAIN_TABS: TabItem[] = [
  { id: "training", labelKey: "training", icon: Target },
  { id: "algorithms", labelKey: "algorithms", icon: BookOpen },
  { id: "timer", labelKey: "timer", icon: Timer },
  { id: "insights", labelKey: "stats", icon: BarChart3 },
];

export function MobileTabBar({
  activeView,
  onNavigate,
  className,
}: MobileTabBarProps) {
  const { t } = useTranslation("nav");

  // Determine which of the 4 slots (0..3) is active; secondary views
  // (skill-tree, profile…) highlight no tab.
  const activeIndex = useMemo(
    () => MAIN_TABS.findIndex((tab) => tab.id === activeView),
    [activeView],
  );

  return (
    <nav
      aria-label={t("primary")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.04)] select-none lg:hidden",
        className,
      )}
    >
      <div className="flex h-14 w-full items-stretch px-2 sm:px-4 md:px-6">
        {/* Slots 0..3: Primary Navigation Tabs */}
        {MAIN_TABS.map((tab, idx) => {
          const isActive = activeIndex === idx;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                hapticTap();
                onNavigate(tab.id);
              }}
              aria-current={isActive ? "page" : undefined}
              aria-label={t(tab.labelKey)}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[0.6rem] font-medium transition-all select-none min-h-11 touch-manipulation outline-none cursor-pointer active:scale-95",
                isActive ? "text-primary font-semibold" : "text-ink-3 hover:text-ink-2",
              )}
            >
              <Icon className={cn("size-5 transition-transform", isActive && "scale-105")} />
              <span className="leading-none">{t(tab.labelKey)}</span>
            </button>
          );
        })}

      </div>
    </nav>
  );
}
