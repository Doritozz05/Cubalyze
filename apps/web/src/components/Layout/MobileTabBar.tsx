"use client";

import { motion, LayoutGroup } from "framer-motion";
import { Timer, Dumbbell, BookOpen, BarChart3, Network, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVE_PILL_SPRING } from "./sidebar.constants";
import type { ViewId } from "./sidebar.constants";

/**
 * Bottom tab bar for the touch regime (mobile + tablet, <1024px).
 *
 * Desktop (>=1024px) is untouched: this component is `lg:hidden`, so it never
 * renders on the desktop rail layout. It provides native-app-style navigation
 * (Twisty Timer style) with uniform flat tabs (Timer stays centered).
 *
 * - `onNavigate` reuses the same `ViewId` navigation as the desktop rail.
 * - `onOpenMore` opens the touch navigation sheet (Settings, Widgets, theme…).
 * - Respects `env(safe-area-inset-bottom)` for iOS home indicator.
 */

interface MobileTabBarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  /** Open the "More" sheet (hamburger equivalent, replaced by bottom bar). */
  onOpenMore?: () => void;
  className?: string;
}

type TabItem = {
  id: ViewId;
  label: string;
  icon: React.ElementType;
};

const MAIN_TABS: TabItem[] = [
  { id: "training", label: "Training", icon: Dumbbell },
  { id: "practice", label: "Algorithms", icon: BookOpen },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "insights", label: "Stats", icon: BarChart3 },
  { id: "skill-tree", label: "Skills", icon: Network },
];

export function MobileTabBar({
  activeView,
  onNavigate,
  onOpenMore,
  className,
}: MobileTabBarProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe shadow-[0_-2px_16px_rgba(0,0,0,0.06)] lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch px-1">
        <LayoutGroup>
          {MAIN_TABS.map((tab) => {
            const isActive = activeView === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[0.58rem] font-medium transition-colors select-none",
                  "min-h-11 touch-manipulation outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isActive ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-active"
                    className="absolute inset-x-1.5 inset-y-1 rounded-lg bg-surface-2"
                    transition={ACTIVE_PILL_SPRING}
                  />
                )}

                <Icon className="relative z-10 size-5" />
                <span className="relative z-10 leading-none">{tab.label}</span>
              </button>
            );
          })}

          {/* More — opens the touch sheet (Settings, Widgets, theme, cube…) */}
          <button
            type="button"
            onClick={onOpenMore}
            aria-label="More options"
            className={cn(
              "relative flex min-h-11 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md text-[0.58rem] font-medium text-ink-3 transition-colors select-none outline-none hover:text-ink-2 focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <Menu className="size-5" />
            <span className="leading-none">More</span>
          </button>
        </LayoutGroup>
      </div>
    </nav>
  );
}
