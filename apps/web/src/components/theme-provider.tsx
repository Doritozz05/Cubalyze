"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";

function ThemeSync() {
  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const liquidGlass = useStore(preferencesStore, (s) => s.liquidGlass);
  const { theme: nextTheme, setTheme } = useTheme();

  React.useEffect(() => {
    if (storeTheme && storeTheme !== nextTheme) {
      setTheme(storeTheme);
    }
  }, [storeTheme, nextTheme, setTheme]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (liquidGlass) {
      root.classList.add("liquid-glass");
      root.setAttribute("data-liquid-glass", "true");
    } else {
      root.classList.remove("liquid-glass");
      root.removeAttribute("data-liquid-glass");
    }
  }, [liquidGlass]);

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
