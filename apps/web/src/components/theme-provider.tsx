"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";

import { resolveThemeColors, type ThemeColors } from "@/theme/themePresets";

function ThemeSync() {
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? "default");
  const customThemeColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const { theme: nextTheme, setTheme } = useTheme();

  React.useEffect(() => {
    if (storeTheme && storeTheme !== nextTheme) {
      setTheme(storeTheme);
    }
  }, [storeTheme, nextTheme, setTheme]);

  // Synchronize theme preset and custom color tokens to :root
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (themePreset !== "default" || (customThemeColors && Object.keys(customThemeColors).length > 0)) {
      const resolved = resolveThemeColors(themePreset, storeTheme, customThemeColors);
      for (const [key, value] of Object.entries(resolved)) {
        root.style.setProperty(key, value);
      }
      // Non-default presets are dark-mode oriented; ensure .dark class if preset is dark
      if (themePreset !== "default") {
        root.classList.add("dark");
      }
    } else {
      // Clear inline overrides so index.css defaults take over
      const allTokens: (keyof ThemeColors)[] = [
        "--canvas", "--surface", "--surface-2", "--line", "--line-2",
        "--ink", "--ink-2", "--ink-3",
        "--ready", "--ready-soft", "--hold", "--hold-soft",
        "--dnf", "--dnf-soft", "--plus2", "--plus2-soft",
        "--caution", "--caution-soft", "--accent-emerald"
      ];
      for (const token of allTokens) {
        root.style.removeProperty(token);
      }
    }
  }, [themePreset, customThemeColors, storeTheme]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (liquidGlass) {
      root.classList.add("liquid-glass");
      root.setAttribute("data-liquid-glass", "true");
      root.style.setProperty("--glass-opacity", `${liquidGlassOpacity / 100}`);
    } else {
      root.classList.remove("liquid-glass");
      root.removeAttribute("data-liquid-glass");
      root.style.removeProperty("--glass-opacity");
    }
  }, [liquidGlass, liquidGlassOpacity]);

  return null;
}

/**
 * Wraps next-themes so the app supports light/dark via the `.dark` class
 * (configured in globals.css). `attribute="class"` toggles the `.dark` class
 * on <html>; `defaultTheme="system"` respects system preference or store theme.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
