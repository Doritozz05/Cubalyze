"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Timer, Grid3x3, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
  HOVER_DELAY,
  UNHOVER_DELAY,
  SIDEBAR_MOTION,
} from "./sidebar.constants";

export interface LeftSidebarProps {
  timerActive?: boolean;
  onNavigateTimer?: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function LeftSidebar({
  timerActive,
  onNavigateTimer,
  mobileOpen,
  onMobileOpenChange,
}: LeftSidebarProps) {
  const isMobile = useIsMobile();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const handleMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(true), HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setIsHovered(false), UNHOVER_DELAY);
  }, []);

  const handleTimerClick = useCallback(() => {
    onNavigateTimer?.();
    onMobileOpenChange?.(false);
  }, [onNavigateTimer, onMobileOpenChange]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
        <div className="flex items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-surface">
            <Grid3x3 className="size-4" />
          </div>
          <motion.span
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={SIDEBAR_MOTION.brand}
            className="nums overflow-hidden text-sm font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap"
          >
            cubeforge
          </motion.span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SidebarGroupTitle label="Main" isHovered={isHovered} />
        <div className="space-y-1">
          <SidebarNavItem
            icon={Timer}
            label="Timer"
            isHovered={isHovered}
            isActive={!!timerActive}
            onClick={handleTimerClick}
            badge={
              timerActive ? (
                <span className="size-1.5 rounded-full bg-ready animate-pulse" />
              ) : undefined
            }
          />
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <SidebarFooterItem
          icon={mounted && isDark ? Sun : Moon}
          label={mounted && isDark ? "Light mode" : "Dark mode"}
          isHovered={isHovered}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        />
      </div>
    </>
  );

  // Mobile: render as Sheet (trigger rendered in header)
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-56 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed, hover-to-expand
  return (
    <motion.aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{ width: isHovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={SIDEBAR_MOTION.container}
      className="fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar select-none overflow-hidden"
    >
      {sidebarContent}
    </motion.aside>
  );
}

/* ── Subcomponents ─────────────────────────────────────────────────────── */

function SidebarGroupTitle({
  label,
  isHovered,
}: {
  label: string;
  isHovered: boolean;
}) {
  return (
    <motion.span
      animate={{ opacity: isHovered ? 1 : 0 }}
      transition={SIDEBAR_MOTION.label}
      className="block overflow-hidden px-3 pb-1 text-[0.62rem] uppercase tracking-[0.15em] text-sidebar-foreground/40 whitespace-nowrap"
    >
      {label}
    </motion.span>
  );
}

function SidebarNavItem({
  icon: Icon,
  label,
  isHovered,
  isActive,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isHovered: boolean;
  isActive?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md text-sm px-2 py-2 transition-colors group",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
      title={!isHovered ? label : undefined}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ready"
          transition={SIDEBAR_MOTION.indicator}
        />
      )}
      <span className="relative inline-flex shrink-0 ml-1">
        <Icon className="size-4" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5">{badge}</span>
        )}
      </span>
      <motion.span
        animate={{ width: isHovered ? "auto" : 0, opacity: isHovered ? 1 : 0 }}
        transition={SIDEBAR_MOTION.label}
        className="overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </button>
  );
}

function SidebarFooterItem({
  icon: Icon,
  label,
  isHovered,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isHovered: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={!isHovered ? label : undefined}
      className="flex w-full items-center gap-3 rounded-md text-sm px-2 py-2 transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <Icon className="size-4 shrink-0 ml-1" />
      <motion.span
        animate={{ width: isHovered ? "auto" : 0, opacity: isHovered ? 1 : 0 }}
        transition={SIDEBAR_MOTION.label}
        className="overflow-hidden whitespace-nowrap"
      >
        {label}
      </motion.span>
    </button>
  );
}
