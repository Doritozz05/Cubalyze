"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Target, BookOpen, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/utils/haptics";
import type { ViewId } from "./sidebar.constants";

/**
 * Curved floating bottom tab bar for the touch regime (mobile + tablet, <1024px).
 *
 * Features:
 * - 4 primary tabs (Training, Algorithms, Timer, Stats) + 1 "More" tab (opens grid sheet).
 * - Morphing SVG scooped notch cutout along the top edge of the navbar.
 * - Floating circular active badge that slides smoothly across tabs with spring physics.
 */

interface MobileTabBarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  /** Open the "More" bottom grid sheet. */
  onOpenMore?: () => void;
  mobileMoreOpen?: boolean;
  className?: string;
}

type TabItem = {
  id: ViewId;
  label: string;
  icon: React.ElementType;
};

const MAIN_TABS: TabItem[] = [
  { id: "training", label: "Training", icon: Target },
  { id: "algorithms", label: "Algorithms", icon: BookOpen },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "insights", label: "Stats", icon: BarChart3 },
];

export function MobileTabBar({
  activeView,
  onNavigate,
  onOpenMore,
  mobileMoreOpen = false,
  className,
}: MobileTabBarProps) {
  // Determine which of the 5 slots (0..4) is active
  const activeIndex = useMemo(() => {
    if (mobileMoreOpen) return 4;
    const idx = MAIN_TABS.findIndex((t) => t.id === activeView);
    return idx !== -1 ? idx : 4; // Default to 'More' slot for secondary views like skill-tree or profile
  }, [activeView, mobileMoreOpen]);

  const activeTabItem = useMemo(() => {
    if (activeIndex === 4) {
      return { id: "more" as const, label: "More", icon: Menu };
    }
    return MAIN_TABS[activeIndex];
  }, [activeIndex]);

  const ActiveIcon = activeTabItem.icon;

  // Calculate SVG curve paths for the morphing scooped notch background (viewBox 0 0 500 64)
  const notchPaths = useMemo(() => {
    const center = activeIndex * 100 + 50; // Center X for slot 0..4
    const x1 = center - 38;
    const x2 = center + 38;

    const fill = `M 0 10 
      L ${Math.max(0, x1 - 10)} 10 
      C ${x1} 10, ${center - 18} 36, ${center} 36 
      C ${center + 18} 36, ${x2} 10, ${Math.min(500, x2 + 10)} 10 
      L 500 10 
      L 500 64 
      L 0 64 Z`;

    const border = `M 0 10 
      L ${Math.max(0, x1 - 10)} 10 
      C ${x1} 10, ${center - 18} 36, ${center} 36 
      C ${center + 18} 36, ${x2} 10, ${Math.min(500, x2 + 10)} 10 
      L 500 10`;

    return { fill, border };
  }, [activeIndex]);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 select-none lg:hidden",
        className,
      )}
    >
      <div className="relative mx-auto max-w-lg pb-safe">
        {/* SVG background track with smooth morphing scooped notch */}
        <div className="absolute inset-x-0 bottom-0 top-0 h-16 pointer-events-none drop-shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <svg
            className="size-full"
            viewBox="0 0 500 64"
            preserveAspectRatio="none"
          >
            <motion.path
              animate={{ d: notchPaths.fill }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="fill-surface"
            />
            <motion.path
              animate={{ d: notchPaths.border }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="stroke-line fill-none"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        {/* Floating active circular button nestled inside the scooped notch */}
        <motion.div
          className="absolute top-0.5 z-20 flex -translate-x-1/2 items-center justify-center pointer-events-none"
          animate={{ left: `${activeIndex * 20 + 10}%` }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <div className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-surface">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTabItem.id}
                initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, rotate: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ActiveIcon className="size-5" />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 5 Navigation slots (4 main tabs + 1 More option) */}
        <div className="relative z-10 flex h-16 items-stretch px-1">
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
                aria-label={tab.label}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center min-h-11 touch-manipulation outline-none cursor-pointer transition-colors",
                  isActive ? "text-primary" : "text-ink-3 hover:text-ink-2 active:scale-95",
                )}
              >
                {!isActive ? (
                  <>
                    <Icon className="size-5 mb-0.5" />
                    <span className="text-[0.58rem] font-medium leading-none">
                      {tab.label}
                    </span>
                  </>
                ) : (
                  <span className="text-[0.62rem] font-bold leading-none mt-5">
                    {tab.label}
                  </span>
                )}
              </button>
            );
          })}

          {/* Slot 5: More options button */}
          <button
            type="button"
            onClick={(e) => {
              hapticTap();
              e.currentTarget.blur();
              onOpenMore?.();
            }}
            aria-label="More options"
            aria-current={activeIndex === 4 ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center min-h-11 touch-manipulation outline-none cursor-pointer transition-colors",
              activeIndex === 4
                ? "text-primary"
                : "text-ink-3 hover:text-ink-2 active:scale-95",
            )}
          >
            {activeIndex !== 4 ? (
              <>
                <Menu className="size-5 mb-0.5" />
                <span className="text-[0.58rem] font-medium leading-none">
                  More
                </span>
              </>
            ) : (
              <span className="text-[0.62rem] font-bold leading-none mt-5">
                More
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
