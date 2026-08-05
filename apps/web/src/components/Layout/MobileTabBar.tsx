"use client";

import { motion, LayoutGroup } from "framer-motion";
import { Timer, Dumbbell, BookOpen, BarChart3, Network, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import { ACTIVE_PILL_SPRING } from "./sidebar.constants";
import type { ViewId } from "./sidebar.constants";

/**
 * Bottom tab bar for the touch regime (mobile + tablet, <1024px).
 *
 * Desktop (>=1024px) is untouched (`lg:hidden`).
 * Provides 5 primary navigation tabs plus a "More" button that opens
 * a swipeable bottom grid sheet with secondary options.
 */

interface MobileTabBarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  /** Open the "More" bottom grid sheet. */
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
  { id: "algorithms", label: "Algorithms", icon: BookOpen },
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
                onClick={() => {
                  hapticTap();
                  onNavigate(tab.id);
                }}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[0.58rem] font-medium transition-colors select-none",
                  "min-h-11 touch-manipulation outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
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

          {/* More — opens the touch grid sheet (Settings, Smart Cube, Theme) */}
          <button
            type="button"
            onClick={(e) => {
              hapticTap();
              // Drop focus before the modal drawer marks this nav `aria-hidden`
              // (background sibling of the portal). Keeping focus here would
              // trigger Chrome's "Blocked aria-hidden ... descendant retained
              // focus" warning. The drawer's own focus trap re-focuses its
              // content for keyboard users.
              e.currentTarget.blur();
              onOpenMore?.();
            }}
            aria-label="More options"
            className="relative flex min-h-11 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md text-[0.58rem] font-medium text-ink-3 transition-colors select-none outline-none hover:text-ink-2 focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <Menu className="size-5" />
            <span className="leading-none">More</span>
          </button>
        </LayoutGroup>
      </div>
    </nav>
  );
}
