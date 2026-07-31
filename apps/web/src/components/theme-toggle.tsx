"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle. Renders a stable placeholder until mounted to avoid the
 * next-themes hydration mismatch, then swaps between sun/moon icons.
 */
export function ThemeToggle() {
  const { resolvedTheme } = useTheme();
  const setStoreTheme = useStore(preferencesStore, (s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  // next-themes reads localStorage in an effect; we need a paint after mount
  // to know the resolved theme. This is the canonical pattern.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-md border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setStoreTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )
      ) : (
        <Moon className="size-4 opacity-0" />
      )}
    </Button>
  );
}
