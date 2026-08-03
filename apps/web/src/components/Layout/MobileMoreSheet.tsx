"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useStore } from "zustand";
import { Settings, Bluetooth, Sun, Moon, User } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { preferencesStore } from "@cubeforge/state";
import { hapticTap } from "@/utils/haptics";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenCubeConnector: () => void;
  onOpenProfile: () => void;
}

export function MobileMoreSheet({
  open,
  onOpenChange,
  onOpenSettings,
  onOpenCubeConnector,
  onOpenProfile,
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
          {/* Settings */}
          <button
            type="button"
            onClick={() => handleAction(onOpenSettings)}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer"
          >
            <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink">
              <Settings className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-ink">Settings</span>
              <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                Preferences & inputs
              </span>
            </div>
          </button>

          {/* Profile — identity center */}
          <button
            type="button"
            onClick={() => handleAction(onOpenProfile)}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer"
          >
            <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink">
              <User className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-ink">Profile</span>
              <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                Your identity & progress
              </span>
            </div>
          </button>

          {/* Smart Cube */}
          <button
            type="button"
            onClick={() => handleAction(onOpenCubeConnector)}
            className="flex flex-col items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer"
          >
            <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink">
              <Bluetooth className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-ink">Smart Cube</span>
              <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                Connect bluetooth cube
              </span>
            </div>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={handleToggleTheme}
            className="col-span-2 flex items-center justify-between rounded-xl border border-line bg-surface-2/60 p-4 text-left transition-all active:scale-[0.98] active:bg-surface-2 hover:border-line-2 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-surface border border-line text-ink">
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </div>
              <div>
                <span className="block text-xs font-semibold text-ink">
                  {isDark ? "Light Mode" : "Dark Mode"}
                </span>
                <span className="block text-[0.65rem] text-ink-3 mt-0.5 leading-tight">
                  Switch color theme
                </span>
              </div>
            </div>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
