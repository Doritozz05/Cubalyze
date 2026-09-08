"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";

import {
  resolveThemeColors,
  getDerivedThemeTokens,
  getDerivedLiquidGlassTokens,
  THEME_PRESETS,
} from "@/theme/themePresets";

function ThemeSync() {
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? "dark");
  const customThemeColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const { theme: nextTheme, setTheme } = useTheme();

  React.useEffect(() => {
    if (storeTheme && storeTheme !== nextTheme) {
      setTheme(storeTheme);
    }
  }, [storeTheme, nextTheme, setTheme]);

  // Synchronize theme preset, derived tokens, and liquid glass to :root
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const presetObj = THEME_PRESETS.find((p) => p.id === themePreset);
    const isLightPreset = themePreset === "light" || (presetObj && !presetObj.isDark);

    // Synchronize .dark class on root
    if (isLightPreset) {
      root.classList.remove("dark");
      if (storeTheme !== "light") {
        preferencesStore.getState().setTheme("light");
      }
    } else {
      root.classList.add("dark");
      if (storeTheme !== "dark") {
        preferencesStore.getState().setTheme("dark");
      }
    }

    const resolved = resolveThemeColors(themePreset, storeTheme, customThemeColors);
    const derived = getDerivedThemeTokens(resolved);
    const allVars = { ...resolved, ...derived };

    for (const [key, value] of Object.entries(allVars)) {
      root.style.setProperty(key, value);
    }

    if (liquidGlass) {
      root.classList.add("liquid-glass");
      root.setAttribute("data-liquid-glass", "true");
      const glassTokens = getDerivedLiquidGlassTokens(resolved, liquidGlassOpacity);
      for (const [key, value] of Object.entries(glassTokens)) {
        root.style.setProperty(key, value);
      }
    } else {
      root.classList.remove("liquid-glass");
      root.removeAttribute("data-liquid-glass");
      root.style.removeProperty("--glass-opacity");
      root.style.removeProperty("--glass-bg");
      root.style.removeProperty("--glass-bg-subtle");
      root.style.removeProperty("--glass-btn-bg");
      root.style.removeProperty("--glass-btn-bg-hover");
      root.style.removeProperty("--glass-border");
    }
  }, [themePreset, customThemeColors, storeTheme, liquidGlass, liquidGlassOpacity]);

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
