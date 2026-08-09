"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useStore } from "zustand";
import { Settings, Bluetooth, Sun, Moon, User, FileSearch, Network } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { preferencesStore } from "@cubeforge/state";
import { hapticTap } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import type { ViewId } from "./sidebar.constants";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenCubeConnector: () => void;
  onOpenProfile: () => void;
  onNavigate?: (view: ViewId) => void;
}

interface MoreItem {
  key: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenCubeConnector,
  onOpenProfile,
  onNavigate,
}: MobileMoreSheetProps) {
  const { resolvedTheme } = useTheme();
  const setStoreTheme = useStore(preferencesStore, (s) => s.setTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const handleAction = (action: () => void) => {
    hapticTap();
    onOpenChange(false);
    // Small delay to allow sheet close animation to start smoothly
    setTimeout(() => {
      action();
    }, 150);
  };

  const handleToggleTheme = () => {
    hapticTap();
    setStoreTheme(isDark ? "light" : "dark");
  };

  // Actions are rendered as a 2×3 grid.
  const items: MoreItem[] = [
    {
      key: "settings",
      icon: Settings,
      title: "Settings",
      subtitle: "Preferences & inputs",
      onClick: () => handleAction(onOpenSettings),
    },
    {
      key: "profile",
      icon: User,
      title: "Profile",
      subtitle: "Your identity & progress",
      onClick: () => handleAction(onOpenProfile),
    },
    {
      key: "skill-tree",
      icon: Network,
      title: "Skill Tree",
      subtitle: "Interactive skill tree graph",
      onClick: () => handleAction(() => onNavigate?.("skill-tree")),
    },
    {
      key: "reconstructions",
      icon: FileSearch,
      title: "Reconstructions",
      subtitle: "Solve database & replays",
      onClick: () => handleAction(() => onNavigate?.("reconstructions")),
    },
    {
      key: "smart-cube",
      icon: Bluetooth,
      title: "Smart Cube",
      subtitle: "Connect bluetooth cube",
      onClick: () => handleAction(onOpenCubeConnector),
    },
    {
      key: "theme",
      icon: isDark ? Sun : Moon,
      title: isDark ? "Light Mode" : "Dark Mode",
      subtitle: "Switch color theme",
      onClick: handleToggleTheme,
    },
  ];

  const lastStretches = items.length % 2 === 1;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[80vh] p-0 pb-safe focus:outline-none">
        <DrawerHeader className="border-b border-line px-5 py-3.5 text-left">
          <DrawerTitle className="text-sm font-semibold text-ink">
            More options
          </DrawerTitle>
        </DrawerHeader>

        {/* Grid of secondary action cards */}
        <div className="grid grid-cols-2 gap-3 p-4">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === items.length - 1;
            const stretches = isLast && lastStretches;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer",
                  stretches && "col-span-2 flex-row items-center gap-3",
                )}
              >
                <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink shrink-0">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-ink">
                    {item.title}
                  </span>
                  <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                    {item.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
