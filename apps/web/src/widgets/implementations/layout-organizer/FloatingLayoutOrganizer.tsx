"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Save, Trash2, Check, ArrowDownToLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { useWidgetStore, widgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import { WIDGET_LABEL_KEY } from "@/widgets/i18n";
import type { WidgetId } from "@/widgets/types";
import type { CustomLayout } from "@/widgets/widgetStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── Widget size registry & DOM measurement ────────────────────────────────
const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
  "times-log":         { w: 340, h: 360 },
  "time-distribution": { w: 340, h: 280 },
  "pb-progression":    { w: 300, h: 320 },
  "solve-timeline":    { w: 340, h: 360 },
  "scramble-2d":       { w: 340, h: 300 },
  "cube-button":       { w: 200, h: 160 },
  "metronome":         { w: 280, h: 240 },
  "notes":             { w: 340, h: 300 },
  "algorithm-db":      { w: 320, h: 360 },
};
const DEFAULT_SIZE = { w: 340, h: 300 };

/** Get real rendered DOM dimensions if mounted, falling back to registered sizes. */
function getSize(id: WidgetId): { w: number; h: number } {
  if (typeof document !== "undefined") {
    const el = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`);
    if (el && el.offsetWidth > 60 && el.offsetHeight > 40) {
      return { w: el.offsetWidth, h: el.offsetHeight };
    }
  }
  return WIDGET_SIZES[id] ?? DEFAULT_SIZE;
}

/**
 * Accurately determines the bottom Y coordinate of the scramble display.
 * The scramble display contains the header ('SCRAMBLE #1', 'Copy', 'New')
 * and the wrap-around scramble tokens. Automatic layout presets MUST start
 * strictly BELOW this boundary so the scramble is 100% visible and unobstructed.
 */
function getScrambleBottom(): number {
  if (typeof document === "undefined") return 175;
  const el = document.querySelector<HTMLElement>('[data-onboarding-target="timer"]');
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > 60) {
      return Math.round(rect.bottom);
    }
  }
  // Fallback: header (60) + stage padding (32) + scramble header & 2 lines of tokens (80)
  return 175;
}

// ── Viewport geometry & safe exclusion corridor ───────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

const HEADER_H = 60;
const SIDEBAR_W = 56;
const GAP = 16;

interface ViewportInfo {
  isMobile: boolean;
  vw: number;
  vh: number;
  area: Rect;
  centerCorridor: { x1: number; x2: number; y1: number; y2: number };
}

function getViewportInfo(): ViewportInfo {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      vw: 1280,
      vh: 768,
      area: { x: 72, y: 180, w: 1192, h: 572 },
      centerCorridor: { x1: 440, x2: 840, y1: 180, y2: 480 },
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 768;
  const scrambleBottom = getScrambleBottom();

  if (isMobile) {
    const margin = 12;
    const topY = Math.max(72, scrambleBottom + 12);
    const bottomY = vh - 64;
    return {
      isMobile: true,
      vw,
      vh,
      area: {
        x: margin,
        y: topY,
        w: Math.max(280, vw - margin * 2),
        h: Math.max(200, bottomY - topY),
      },
      centerCorridor: { x1: margin, x2: vw - margin, y1: topY, y2: 320 },
    };
  }

  const x = SIDEBAR_W + GAP;
  // All desktop layouts MUST start strictly below the scramble display with a comfortable gap
  const topY = Math.max(HEADER_H + GAP, scrambleBottom + 16);
  const bottomMargin = 16;
  const rawW = Math.max(400, vw - SIDEBAR_W - GAP * 2);
  const h = Math.max(200, vh - bottomMargin - topY);

  // If the 3D cube simulator panel is open on the right, respect its width
  let rightReserved = 0;
  const cubeAside = document.querySelector('aside[aria-hidden="false"]');
  if (cubeAside && cubeAside.clientWidth > 0) {
    rightReserved = cubeAside.clientWidth;
  }

  const effectiveW = Math.max(400, rawW - rightReserved);
  const stageCenterX = x + effectiveW / 2;

  // Center corridor (protect timer display from auto-layout encroachment)
  const corridorHalfW = Math.min(320, effectiveW * 0.26);

  return {
    isMobile: false,
    vw,
    vh,
    area: { x, y: topY, w: effectiveW, h },
    centerCorridor: {
      x1: stageCenterX - corridorHalfW,
      x2: stageCenterX + corridorHalfW,
      y1: topY,
      y2: Math.min(topY + 440, topY + h * 0.65),
    },
  };
}

type LayoutFn = (ids: WidgetId[]) => Record<WidgetId, Rect>;

// ── Desktop Layout Algorithms (Zero-Overlap, Scramble-Safe) ───────────────

/**
 * Sides (Laterales):
 * Distributes open widgets cleanly into left and right columns, framing
 * the timer and keeping the central corridor clear, strictly below the scramble.
 */
const sides: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  const leftIds: WidgetId[] = [];
  const rightIds: WidgetId[] = [];

  ids.forEach((id, i) => {
    if (i % 2 === 0) leftIds.push(id);
    else rightIds.push(id);
  });

  const packColumn = (colIds: WidgetId[], startX: (w: number) => number) => {
    if (!colIds.length) return;
    const totalH = colIds.reduce((sum, id) => sum + getSize(id).h, 0);
    const neededGap = GAP * (colIds.length - 1);
    const fits = totalH + neededGap <= a.h;
    let currentY = a.y;

    colIds.forEach((id, idx) => {
      const s = getSize(id);
      const x = startX(s.w);
      if (fits) {
        out[id] = { x, y: currentY, w: s.w, h: s.h };
        currentY += s.h + GAP;
      } else {
        const stepY = colIds.length > 1 ? Math.max(0, (a.h - s.h) / (colIds.length - 1)) : 0;
        out[id] = { x, y: Math.round(a.y + idx * Math.min(stepY, s.h + 8)), w: s.w, h: s.h };
      }
    });
  };

  packColumn(leftIds, () => a.x);
  packColumn(rightIds, (w) => Math.round(a.x + a.w - w));

  return out;
};

/**
 * Corners (Cuatro esquinas):
 * Positions widgets in the cardinal corners strictly below the scramble,
 * leaving timer completely open in the middle.
 */
const corners: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  ids.forEach((id, i) => {
    const s = getSize(id);
    if (i === 0) {
      // Top Left (below scramble)
      out[id] = { x: a.x, y: a.y, w: s.w, h: s.h };
    } else if (i === 1) {
      // Top Right (below scramble)
      out[id] = { x: Math.round(a.x + a.w - s.w), y: a.y, w: s.w, h: s.h };
    } else if (i === 2) {
      // Bottom Left
      out[id] = { x: a.x, y: Math.round(a.y + a.h - s.h), w: s.w, h: s.h };
    } else if (i === 3) {
      // Bottom Right
      out[id] = { x: Math.round(a.x + a.w - s.w), y: Math.round(a.y + a.h - s.h), w: s.w, h: s.h };
    } else {
      // 5th+ widgets: distribute along bottom shelf between bottom corners
      const extraIdx = i - 4;
      const extraCount = ids.length - 4;
      const step = extraCount > 1 ? (a.w - s.w) / (extraCount + 1) : a.w / 2 - s.w / 2;
      out[id] = {
        x: Math.round(a.x + (extraIdx + 1) * step),
        y: Math.round(a.y + a.h - s.h),
        w: s.w,
        h: s.h,
      };
    }
  });

  return out;
};

/**
 * Bottom row (Fila inferior):
 * Aligns all widgets along the bottom edge of the screen, keeping
 * the entire upper portion completely open for Scramble and Timer.
 */
const bottom: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  const totalW = ids.reduce((acc, id) => acc + getSize(id).w, 0) + GAP * (ids.length - 1);
  const fits = totalW <= a.w;
  let currentX = a.x + (fits ? Math.max(0, Math.floor((a.w - totalW) / 2)) : 0);

  ids.forEach((id, i) => {
    const s = getSize(id);
    const targetY = Math.round(a.y + a.h - s.h);
    if (fits) {
      out[id] = { x: currentX, y: targetY, w: s.w, h: s.h };
      currentX += s.w + GAP;
    } else {
      const stepX = ids.length > 1 ? (a.w - s.w) / (ids.length - 1) : 0;
      out[id] = { x: Math.round(a.x + i * stepX), y: targetY, w: s.w, h: s.h };
    }
  });

  return out;
};

/**
 * Left column (Columna izquierda):
 * Stacks all widgets on the left flank strictly below the scramble,
 * leaving 75% of the screen totally unobstructed.
 */
const left: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  const totalH = ids.reduce((acc, id) => acc + getSize(id).h, 0) + GAP * (ids.length - 1);
  const fits = totalH <= a.h;
  let currentY = a.y;

  ids.forEach((id, i) => {
    const s = getSize(id);
    if (fits) {
      out[id] = { x: a.x, y: currentY, w: s.w, h: s.h };
      currentY += s.h + GAP;
    } else {
      const stepY = ids.length > 1 ? Math.max(0, (a.h - s.h) / (ids.length - 1)) : 0;
      out[id] = { x: a.x, y: Math.round(a.y + i * stepY), w: s.w, h: s.h };
    }
  });

  return out;
};

/**
 * Right column (Columna derecha):
 * Stacks all widgets on the right flank strictly below the scramble,
 * leaving the left and center completely unobstructed.
 */
const right: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  const totalH = ids.reduce((acc, id) => acc + getSize(id).h, 0) + GAP * (ids.length - 1);
  const fits = totalH <= a.h;
  let currentY = a.y;

  ids.forEach((id, i) => {
    const s = getSize(id);
    const x = Math.round(a.x + a.w - s.w);
    if (fits) {
      out[id] = { x, y: currentY, w: s.w, h: s.h };
      currentY += s.h + GAP;
    } else {
      const stepY = ids.length > 1 ? Math.max(0, (a.h - s.h) / (ids.length - 1)) : 0;
      out[id] = { x, y: Math.round(a.y + i * stepY), w: s.w, h: s.h };
    }
  });

  return out;
};

// ── Mobile Layout Algorithms (< 768px) ───────────────────────────────────

/**
 * Mobile Focus: Centers primary widget in lower viewport, secondary widgets tucked.
 */
const mobileFocus: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  const [primary, ...rest] = ids;
  const ps = getSize(primary);
  const targetW = Math.min(ps.w, a.w);
  const targetX = Math.round(a.x + (a.w - targetW) / 2);
  const targetY = Math.max(a.y + 120, Math.round(a.y + a.h - ps.h));

  out[primary] = { x: targetX, y: targetY, w: targetW, h: ps.h };
  rest.forEach((id) => {
    out[id] = { x: a.x, y: a.y + a.h - 40, w: a.w, h: 36 };
  });

  return out;
};

/**
 * Mobile Stack: Arranges widgets in a vertical stack below the mobile timer.
 */
const mobileStack: LayoutFn = (ids) => {
  const info = getViewportInfo();
  const a = info.area;
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;

  let currentY = a.y + 140;
  ids.forEach((id) => {
    const s = getSize(id);
    const targetW = Math.min(s.w, a.w);
    const targetX = Math.round(a.x + (a.w - targetW) / 2);
    out[id] = { x: targetX, y: currentY, w: targetW, h: s.h };
    currentY += s.h + 12;
  });

  return out;
};

export interface LayoutDef {
  id: string;
  label: string;
  description: string;
  fn: LayoutFn;
}

const DESKTOP_LAYOUTS: LayoutDef[] = [
  { id: "sides",   label: "Sides",        description: "Left & right of timer", fn: sides },
  { id: "corners", label: "Four corners", description: "One in each corner",    fn: corners },
  { id: "bottom",  label: "Bottom row",   description: "Aligned at the bottom", fn: bottom },
  { id: "left",    label: "Left column",  description: "All on the left side",  fn: left },
  { id: "right",   label: "Right column", description: "All on the right side", fn: right },
];

const MOBILE_LAYOUTS: LayoutDef[] = [
  { id: "mobileFocus", label: "Main widget",   description: "One open, rest in dock",  fn: mobileFocus },
  { id: "mobileStack", label: "Vertical list", description: "Stacked one below another", fn: mobileStack },
];

// ── Layout i18n key maps ──────────────────────────────────────────────────
const LAYOUT_LABEL_KEY: Record<string, ParseKeys<"widgets">> = {
  sides: "panel.layoutOrganizer.sides",
  corners: "panel.layoutOrganizer.corners",
  bottom: "panel.layoutOrganizer.bottom",
  left: "panel.layoutOrganizer.left",
  right: "panel.layoutOrganizer.right",
  mobileFocus: "panel.layoutOrganizer.mobileFocus",
  mobileStack: "panel.layoutOrganizer.mobileStack",
  // Legacy keys
  wings: "panel.layoutOrganizer.sides",
  bento: "panel.layoutOrganizer.corners",
  bottomShelf: "panel.layoutOrganizer.bottom",
  streamer: "panel.layoutOrganizer.left",
  grid: "panel.layoutOrganizer.grid",
  split: "panel.layoutOrganizer.split",
};

const LAYOUT_DESC_KEY: Record<string, ParseKeys<"widgets">> = {
  sides: "panel.layoutOrganizer.sidesDesc",
  corners: "panel.layoutOrganizer.cornersDesc",
  bottom: "panel.layoutOrganizer.bottomDesc",
  left: "panel.layoutOrganizer.leftDesc",
  right: "panel.layoutOrganizer.rightDesc",
  mobileFocus: "panel.layoutOrganizer.mobileFocusDesc",
  mobileStack: "panel.layoutOrganizer.mobileStackDesc",
  // Legacy keys
  wings: "panel.layoutOrganizer.sidesDesc",
  bento: "panel.layoutOrganizer.cornersDesc",
  bottomShelf: "panel.layoutOrganizer.bottomDesc",
  streamer: "panel.layoutOrganizer.leftDesc",
  grid: "panel.layoutOrganizer.gridDesc",
  split: "panel.layoutOrganizer.splitDesc",
};

// ── SVG miniature preview with central stage safe corridor ────────────────

const SVG_W = 140;
const SVG_H = 80;

function LayoutPreviewSvg({
  rects,
  ids,
  isMobile = false,
}: {
  rects: Record<string, Rect>;
  ids: WidgetId[];
  isMobile?: boolean;
}) {
  const { t } = useTranslation("widgets");
  const info = getViewportInfo();
  const area = info.area;

  // Dedicated height for the scramble strip at the top of the preview
  const scrambleStripH = 14;
  const widgetAreaH = SVG_H - scrambleStripH - 4;
  const scaleX = SVG_W / area.w;
  const scaleY = widgetAreaH / area.h;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block w-full h-auto">
      {/* Top Scramble strip (always 100% unobstructed) */}
      <rect
        x={8}
        y={4}
        width={SVG_W - 16}
        height={6}
        rx={2}
        className="fill-ink/15"
      />

      {/* Central Timer digits indicator */}
      {!isMobile && (
        <rect
          x={SVG_W * 0.35}
          y={scrambleStripH + widgetAreaH * 0.35}
          width={SVG_W * 0.3}
          height={10}
          rx={2}
          className="fill-ink/8"
        />
      )}

      {/* Widget Rectangles */}
      {ids.map((id, i) => {
        const r = rects[id];
        if (!r) return null;
        const sx = Math.max(0, Math.min((r.x - area.x) * scaleX, SVG_W - 4));
        const sy = Math.max(scrambleStripH, Math.min(scrambleStripH + (r.y - area.y) * scaleY, SVG_H - 4));
        const sw = Math.max(4, Math.min(r.w * scaleX, SVG_W - sx));
        const sh = Math.max(4, Math.min(r.h * scaleY, SVG_H - sy));
        const hue = (i * 53) % 360;
        return (
          <g key={id}>
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              rx={2}
              fill={`hsl(${hue} 50% 55% / 0.25)`}
              stroke={`hsl(${hue} 50% 60% / 0.7)`}
              strokeWidth={0.8}
            />
            {sw > 20 && sh > 10 && (
              <text
                x={sx + sw / 2}
                y={sy + sh / 2 + 2.5}
                textAnchor="middle"
                fontSize={5}
                fill={`hsl(${hue} 50% 80%)`}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {t(WIDGET_LABEL_KEY[id]).split(" ")[0] ?? id}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Build preview rects from a CustomLayout for the SVG. */
function customLayoutRects(layout: CustomLayout): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const [id, pos] of Object.entries(layout.positions)) {
    const s = getSize(id);
    out[id] = { x: pos.x, y: pos.y, w: s.w, h: s.h };
  }
  return out;
}

// ── Main panel ───────────────────────────────────────────────────────────

const SELF_ID = "layout-organizer";

export function FloatingLayoutOrganizer() {
  const { t } = useTranslation("widgets");
  const instances = useWidgetStore((s) => s.instances);
  const customLayouts = useWidgetStore((s) => s.customLayouts);
  const [saveInputOpen, setSaveInputOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  // Open floating widgets currently on screen (floating or minimized) except self
  const openIds = useMemo(() =>
    Object.entries(instances)
      .filter(([, inst]) => inst?.status === "floating" || inst?.status === "minimized")
      .filter(([id]) => id !== SELF_ID)
      .map(([id]) => id as WidgetId),
  [instances]);

  const openCount = openIds.length;

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const activePresets = isMobile ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS;

  const layoutData = useMemo(() =>
    activePresets.map((l) => ({ ...l, rects: openIds.length ? l.fn(openIds) : {} })),
  [openIds, activePresets]);

  const applyBuiltInLayout = (rects: Record<WidgetId, Rect>, layoutId: string) => {
    const store = widgetStore.getState();
    openIds.forEach((id, i) => {
      const r = rects[id];
      if (!r) return;
      store.setPosition(id, { x: r.x, y: r.y });
      if (layoutId === "mobileFocus" && i > 0) {
        // On mobile focus layout, secondary widgets are tucked into the dock
        store.setStatus(id, "docked");
      } else {
        // Auto undock / expand layout widgets to floating
        store.setStatus(id, "floating");
      }
    });
  };

  const applyCustomLayout = (layout: CustomLayout) => {
    const store = widgetStore.getState();
    for (const [id, pos] of Object.entries(layout.positions)) {
      store.setPosition(id as WidgetId, pos);
      // Auto undock / expand layout widgets to floating in their saved positions
      store.setStatus(id as WidgetId, "floating");
    }
  };

  const handleSaveCustom = () => {
    if (!saveName.trim()) return;
    widgetStore.getState().saveCustomLayout(saveName.trim());
    setSavedId("saved");
    setSaveName("");
    setSaveInputOpen(false);
    setTimeout(() => setSavedId(null), 1500);
  };

  const handleDockAll = () => {
    const store = widgetStore.getState();
    for (const id of openIds) {
      store.setStatus(id, "docked");
    }
  };

  const handleDeleteCustom = (layoutId: string) => {
    widgetStore.getState().deleteCustomLayout(layoutId);
  };

  return (
    <FloatingWidgetWrapper widgetId={SELF_ID} icon={LayoutGrid} label={t("def.layoutOrganizer")} panelWidth={300}>
      {openCount === 0 && customLayouts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <LayoutGrid className="size-8 text-ink-3/40" />
          <p className="text-[0.78rem] font-medium text-ink-2">
            {t("panel.layoutOrganizer.noActive")}
          </p>
          <p className="text-[0.7rem] leading-relaxed text-ink-3">
            {t("panel.layoutOrganizer.noActiveHint")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Scrollable content */}
          <div className="flex flex-col gap-0 max-h-95 overflow-y-auto">
            {/* Header bar + save layout button */}
            <div className="sticky top-0 z-1 flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
              <p className="text-[0.65rem] text-ink-3">
                <span className="font-semibold text-ink">{openCount}</span>{" "}
                {t("panel.layoutOrganizer.activeCount", { count: openCount })}
              </p>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        onClick={handleDockAll}
                        disabled={openCount === 0}
                        className="flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                      >
                        <ArrowDownToLine className="size-2.5" />
                        {t("panel.layoutOrganizer.dockAll")}
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {openCount === 0
                      ? t("panel.layoutOrganizer.noFloating")
                      : t("panel.layoutOrganizer.dockAll", { count: openCount })}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSaveInputOpen((v) => !v)}
                      disabled={openCount === 0}
                      className="flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                    >
                      <Save className="size-2.5" />
                      {t("panel.layoutOrganizer.saveLayout")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t("panel.layoutOrganizer.savePositions")}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Save input form */}
            {saveInputOpen && (
              <div className="flex items-center gap-1.5 border-b border-line bg-surface-2/40 px-3 py-1.5">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCustom();
                    if (e.key === "Escape") setSaveInputOpen(false);
                  }}
                  placeholder={t("panel.layoutOrganizer.layoutNamePlaceholder")}
                  className="h-7 flex-1 rounded border border-line bg-surface px-2 text-[0.7rem] text-ink outline-none placeholder:text-ink-3/50 focus:border-ink/40"
                  autoFocus
                />
                <button
                  onClick={handleSaveCustom}
                  disabled={!saveName.trim() || openCount === 0}
                  className="flex items-center gap-1 rounded bg-ink px-2.5 py-1 text-[0.65rem] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Check className="size-3" />
                  {t("panel.layoutOrganizer.saveLayoutButton")}
                </button>
              </div>
            )}

            {/* Saved notification feedback */}
            {savedId && (
              <div className="flex items-center gap-1.5 border-b border-ready/20 bg-ready-soft/30 px-3 py-1.5">
                <Check className="size-3 text-ready" />
                <span className="text-[0.65rem] text-ready font-medium">{t("panel.layoutOrganizer.layoutSaved")}</span>
              </div>
            )}

            {/* ── Custom layouts section ──────────────────────────────────────── */}
            {customLayouts.length > 0 && (
              <div className="px-2.5 pt-2 pb-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[0.55rem] uppercase tracking-widest text-ink-3/70 font-semibold">
                    {t("panel.layoutOrganizer.customLayouts")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {customLayouts.map((layout) => {
                    const requiredIds = Object.keys(layout.positions) as WidgetId[];
                    const rects = customLayoutRects(layout);

                    return (
                      <div
                        key={layout.id}
                        className="group relative flex flex-col rounded-lg border border-line bg-surface transition-all duration-150 overflow-hidden hover:shadow-md hover:scale-[1.02] hover:border-accent/40"
                      >
                        <button
                          onClick={() => applyCustomLayout(layout)}
                          className="flex flex-col gap-1 p-2 text-left w-full cursor-pointer"
                        >
                          <div className="relative overflow-hidden rounded border border-line/50 bg-surface-2/50">
                            <LayoutPreviewSvg rects={rects} ids={requiredIds} isMobile={isMobile} />
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold text-ink leading-tight truncate">
                              {layout.name}
                            </p>
                            <p className="text-[0.58rem] text-ink-3 leading-tight mt-0.5">
                              <span>{t("panel.layoutOrganizer.widgetsCount", { count: requiredIds.length })}</span>
                            </p>
                          </div>
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustom(layout.id);
                              }}
                              className="absolute right-1 top-1 grid size-5 place-items-center rounded text-ink-3/50 opacity-0 transition-all hover:bg-surface-2 hover:text-dnf group-hover:opacity-100 z-10"
                              aria-label={t("panel.layoutOrganizer.deleteLayoutNamed", {
                                name: layout.name,
                              })}
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left">{t("panel.layoutOrganizer.deleteLayout")}</TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Built-in presets section ─────────────────────────────────── */}
            <div className="px-2.5 pt-2 pb-1">
              <p className="text-[0.55rem] uppercase tracking-widest text-ink-3/70 font-semibold mb-1.5">
                {t("panel.layoutOrganizer.presets")}
              </p>
              {openCount > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {layoutData.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => applyBuiltInLayout(layout.rects, layout.id)}
                      className="group flex flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-left transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <div className="overflow-hidden rounded border border-line/50 bg-surface-2/50">
                        <LayoutPreviewSvg rects={layout.rects} ids={openIds} isMobile={isMobile} />
                      </div>
                      <div>
                        <p className="text-[0.68rem] font-semibold text-ink leading-tight">
                          {t(LAYOUT_LABEL_KEY[layout.id])}
                        </p>
                        <p className="text-[0.58rem] text-ink-3 leading-tight">
                          {t(LAYOUT_DESC_KEY[layout.id])}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line/60 bg-surface-2/30 px-3 py-4 text-center">
                  <p className="text-[0.72rem] font-medium text-ink-2">
                    {t("panel.layoutOrganizer.noActive")}
                  </p>
                  <p className="text-[0.65rem] leading-relaxed text-ink-3">
                    {t("panel.layoutOrganizer.noActiveHint")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer: active widget chips ───────────────────── */}
          {openCount > 0 && (
            <div className="shrink-0 border-t border-line px-2.5 py-2">
              <div className="flex flex-wrap gap-1">
                {openIds.map((id) => {
                  const def = getWidget(id);
                  const Icon = def?.icon;
                  return (
                    <span key={id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.62rem] text-ink-2">
                      {Icon && <Icon className="size-2.5 shrink-0 text-ink-3" />}
                      {t(WIDGET_LABEL_KEY[id])}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </FloatingWidgetWrapper>
  );
}

