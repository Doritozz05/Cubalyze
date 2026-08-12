"use client";

import { create } from "zustand";

interface VirtualScrambleState {
  /**
   * The scramble currently shown by the Cube tab (virtual cube simulator).
   *
   * The simulator owns its own scramble lifecycle (regenerate / scramble
   * button) — independent from the real timer's — so the floating widgets
   * (e.g. scramble-2d) read THIS value while the Cube view is active
   * instead of the timer's `currentScramble`. Written by
   * CubeSimulatorView on every scramble change; read by StageOverlays
   * (WidgetHost) when `activeView === "cube"`.
   */
  scramble: string;
  setScramble: (scramble: string) => void;
}

/**
 * Cross-component channel between the Cube tab (virtual cube simulator) and
 * the floating widget host. Same pattern as useStorageStatusStore: a plain
 * vanilla zustand store consumed via the hook/selector in components.
 */
export const useVirtualScrambleStore = create<VirtualScrambleState>((set) => ({
  scramble: "",
  setScramble: (scramble) => set({ scramble }),
}));
