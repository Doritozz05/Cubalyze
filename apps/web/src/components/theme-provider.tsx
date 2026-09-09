"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";

import {
  resolveThemeColors,
  getDerivedThemeTokens,
  getDerivedLiquidGlassTokens,
} from "@/theme/themePresets";
import { fontStack, MONO_FONTS, SANS_FONTS, slashedZeroFeature, type FontOption } from "@/theme/fonts";
import { customFontFamily } from "@/theme/customFonts";
import type { CustomFontMeta } from "@cubeforge/state";
import { findPreset } from "@/theme/customThemes";

/** Resolve a stored id across built-ins + customs (custom family first). */
function resolveFontStack(
  builtins: FontOption[],
  customs: CustomFontMeta[],
  id: string | undefined,
): string {
  const custom = id ? customs.find((f) => f.id === id) : undefined;
  if (custom) return `'${customFontFamily(custom.id)}', ${fontStack(builtins, builtins[0].id)}`;
  return fontStack(builtins, id);
}

function ThemeSync() {
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? "default");
  const customThemeColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const customThemes = useStore(preferencesStore, (s) => s.customThemes);
  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const liquidGlassOpacity = useStore(preferencesStore, (s) => s.liquidGlassOpacity ?? 65);
  const liquidGlassBlur = useStore(preferencesStore, (s) => s.liquidGlassBlur ?? null);
  const fontSans = useStore(preferencesStore, (s) => s.fontSans ?? 'open-sans');
  const fontMono = useStore(preferencesStore, (s) => s.fontMono ?? 'cascadia-code');
  const zeroStyle = useStore(preferencesStore, (s) => s.zeroStyle ?? 'slashed');
  const customFonts = useStore(preferencesStore, (s) => s.customFonts);
  const { theme: nextTheme, setTheme } = useTheme();

  // Live OS scheme snapshot so `system` mode reacts to OS changes.
  const [osDark, setOsDark] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setOsDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Single resolution rule:
  // - system  -> OS scheme mapped to the classic light/dark presets
  // - default preset -> follows the explicit base theme (light/dark)
  // - explicit preset -> its own isDark flag wins
  const presetObj = findPreset(themePreset, customThemes);
  const resolvedBase: "light" | "dark" =
    storeTheme === "system"
      ? osDark
        ? "dark"
        : "light"
      : presetObj
        ? presetObj.isDark
          ? "dark"
          : "light"
        : storeTheme;

  React.useEffect(() => {
    if (resolvedBase !== nextTheme) {
      setTheme(resolvedBase);
    }
  }, [resolvedBase, nextTheme, setTheme]);

  // Synchronize theme preset, derived tokens, and liquid glass to :root
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    // Synchronize .dark class on root
    root.classList.toggle("dark", resolvedBase === "dark");
    // Keep an explicit (non-system) base theme coherent with the preset.
    if (storeTheme !== "system" && presetObj && storeTheme !== resolvedBase) {
      preferencesStore.getState().setTheme(resolvedBase);
    }

    const resolved = resolveThemeColors(themePreset, resolvedBase, customThemeColors, customThemes);
    const derived = getDerivedThemeTokens(resolved);
    const allVars = { ...resolved, ...derived };

    // Classic presets (light / dark / default) keep exact main parity: their
    // values already match the static :root / .dark palettes, so under liquid
    // glass NO inline variable is written — the static CSS plus the liquid
    // engine own every token. Writing them inline would beat the engine's
    // remaps (inline > stylesheet) and turn frosted surfaces (sidebar,
    // selected pill, hairlines) opaque. Fancy presets keep dynamic tokens.
    const isClassicPreset =
      themePreset === "default" || themePreset === "light" || themePreset === "dark";
    // Explicit user color overrides always win — they are written inline even
    // under liquid glass (same as fancy presets).
    const hasCustomOverrides =
      !!customThemeColors && Object.keys(customThemeColors).length > 0;
    const useStaticCascade = liquidGlass && isClassicPreset && !hasCustomOverrides;

    if (useStaticCascade) {
      for (const key of Object.keys(allVars)) {
        root.style.removeProperty(key);
      }
    } else {
      for (const [key, value] of Object.entries(allVars)) {
        root.style.setProperty(key, value);
      }
    }

    if (liquidGlass) {
      root.classList.add("liquid-glass");
      root.setAttribute("data-liquid-glass", "true");
      if (useStaticCascade) {
        // Main wrote only --glass-opacity; the rest stays static.
        root.style.setProperty("--glass-opacity", `${liquidGlassOpacity / 100}`);
        root.style.removeProperty("--glass-bg");
        root.style.removeProperty("--glass-bg-subtle");
        root.style.removeProperty("--glass-btn-bg");
        root.style.removeProperty("--glass-btn-bg-hover");
        root.style.removeProperty("--glass-nested-bg");
        root.style.removeProperty("--glass-nested-blur");
        root.style.removeProperty("--glass-border");
      } else {
        const glassTokens = getDerivedLiquidGlassTokens(
          resolved,
          liquidGlassOpacity,
          resolvedBase === "dark",
          isClassicPreset,
        );
        for (const [key, value] of Object.entries(glassTokens)) {
          root.style.setProperty(key, value);
        }
      }
    } else {
      root.classList.remove("liquid-glass");
      root.removeAttribute("data-liquid-glass");
      root.style.removeProperty("--glass-opacity");
      root.style.removeProperty("--glass-bg");
      root.style.removeProperty("--glass-bg-subtle");
      root.style.removeProperty("--glass-btn-bg");
      root.style.removeProperty("--glass-btn-bg-hover");
      root.style.removeProperty("--glass-nested-bg");
      root.style.removeProperty("--glass-nested-blur");
      root.style.removeProperty("--glass-border");
    }

    // Custom blur radius overrides the built-in opacity-tied formula.
    // Null removes the inline value so the stylesheet default wins.
    if (liquidGlass && liquidGlassBlur != null) {
      root.style.setProperty("--glass-blur", `${liquidGlassBlur}px`);
    } else {
      root.style.removeProperty("--glass-blur");
    }

    // Theme Studio typography: registry stacks win over the stylesheet
    // defaults so the selected pair applies everywhere instantly.
    root.style.setProperty('--app-font-sans', resolveFontStack(SANS_FONTS, customFonts, fontSans));
    root.style.setProperty('--app-font-mono', resolveFontStack(MONO_FONTS, customFonts, fontMono));

    // Tabular zero style for digits (per-family slashed-zero feature).
    if (zeroStyle === 'slashed') {
      root.setAttribute('data-zero', 'slashed');
      if (slashedZeroFeature(fontMono) !== '"zero" 1') {
        root.setAttribute('data-zero-feature', 'ss03');
      } else {
        root.removeAttribute('data-zero-feature');
      }
    } else {
      root.removeAttribute('data-zero');
      root.removeAttribute('data-zero-feature');
    }
  }, [themePreset, customThemeColors, customThemes, storeTheme, resolvedBase, presetObj, liquidGlass, liquidGlassOpacity, liquidGlassBlur, fontSans, fontMono, zeroStyle, customFonts]);

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
