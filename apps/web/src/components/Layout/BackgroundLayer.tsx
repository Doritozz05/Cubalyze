"use client";

import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import type { ViewId } from "./sidebar.constants";

interface BackgroundLayerProps {
  /** Currently active view/tab id. */
  activeView?: ViewId;
}

export function BackgroundLayer({ activeView }: BackgroundLayerProps) {
  const timerBackgroundImage = useStore(preferencesStore, (s) => s.timerBackgroundImage);
  const timerBackgroundOpacity = useStore(preferencesStore, (s) => s.timerBackgroundOpacity);
  const timerBackgroundBlur = useStore(preferencesStore, (s) => s.timerBackgroundBlur);
  const timerBackgroundFit = useStore(preferencesStore, (s) => s.timerBackgroundFit);
  const timerBackgroundOverlay = useStore(preferencesStore, (s) => s.timerBackgroundOverlay);

  const isVisible = !!timerBackgroundImage && (activeView === "timer" || activeView === "cube");

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-300"
      style={{ opacity: (timerBackgroundOpacity ?? 100) / 100 }}
    >
      <div
        className="absolute inset-0 bg-center"
        style={{
          backgroundImage: `url("${timerBackgroundImage}")`,
          backgroundSize: timerBackgroundFit === "tile" ? "auto" : (timerBackgroundFit || "cover"),
          backgroundRepeat: timerBackgroundFit === "tile" ? "repeat" : "no-repeat",
          filter: timerBackgroundBlur ? `blur(${timerBackgroundBlur}px)` : undefined,
          transform: timerBackgroundBlur ? "scale(1.05)" : undefined,
        }}
      />
      {timerBackgroundOverlay > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: timerBackgroundOverlay / 100 }}
        />
    </div>
  );
}
