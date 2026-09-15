"use client";

import { widgetStore } from "./widgetStore";

/**
 * Dev utility: prints a table of every widget instance with its status,
 * stored position, and — if mounted — its actual on-screen DOM rect.
 *
 * Call it from the browser console:
 *   __cubalyzeDebugWidgets()
 */
export function debugWidgetPositions(): void {
  const state = widgetStore.getState();
  const rows = Object.entries(state.instances).map(([id, inst]) => {
    const el = document.querySelector(`[data-widget-id="${id}"]`);
    const rect = el?.getBoundingClientRect();
    return {
      widget: id,
      status: inst?.status ?? "?",
      stored: inst?.position
        ? `(${Math.round(inst.position.x)}, ${Math.round(inst.position.y)})`
        : "—",
      mounted: !!el,
      screen: rect
        ? `(${Math.round(rect.left)}, ${Math.round(rect.top)}) ${Math.round(rect.width)}×${Math.round(rect.height)}`
        : "—",
      inViewport: rect
        ? rect.left < window.innerWidth &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.bottom > 0
        : false,
    };
  });
  console.groupCollapsed("%c[Cubalyze] widget positions", "color:#38bdf8");
  console.table(rows);
  console.log(
    "%cRaw store state:",
    "color:#38bdf8",
    state.instances,
  );
  console.groupEnd();
}

/**
 * Reset a widget's position back to its definition default.
 * Useful from the console to force a widget back on screen:
 *   __cubalyzeDebugWidgets.reset("cube-button")
 */
export function resetWidgetPosition(id: string): void {
  widgetStore.getState().resetWidgetPosition(id);
}

/** Expose the debug helpers on `window` for console use. */
export function installWidgetDebug(): void {
  // Only called from App's useEffect (client-side), so `window` is safe.
  const w = window as unknown as Record<string, unknown>;
  w["__cubalyzeDebugWidgets"] = Object.assign(debugWidgetPositions, {
    reset: resetWidgetPosition,
  });
}
