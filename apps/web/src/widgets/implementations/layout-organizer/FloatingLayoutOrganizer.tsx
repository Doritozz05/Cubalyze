"use client";

import { useMemo, useState } from "react";
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

// ── Widget size registry ─────────────────────────────────────────────────
const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
  "times-log":         { w: 340, h: 340 },
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

function getSize(id: WidgetId) {
  return WIDGET_SIZES[id] ?? DEFAULT_SIZE;
}

// ── Layout algorithms ────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

const HEADER_H = 60;
const SIDEBAR_W = 56;
const GAP = 16;

function getArea() {
  if (typeof window === "undefined") return { x: SIDEBAR_W + GAP, y: HEADER_H + GAP, w: 1280, h: 768 };
  return {
    x: SIDEBAR_W + GAP,
    y: HEADER_H + GAP,
    w: Math.max(400, window.innerWidth - SIDEBAR_W - GAP * 2),
    h: Math.max(300, window.innerHeight - HEADER_H - GAP * 2),
  };
}

type LayoutFn = (ids: WidgetId[]) => Record<WidgetId, Rect>;

const cascade: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const maxShiftX = Math.max(0, a.w - DEFAULT_SIZE.w);
  const maxShiftY = Math.max(0, a.h - DEFAULT_SIZE.h);
  const stepX = ids.length > 1 ? Math.min(30, maxShiftX / (ids.length - 1)) : 0;
  const stepY = ids.length > 1 ? Math.min(30, maxShiftY / (ids.length - 1)) : 0;
  ids.forEach((id, i) => {
    const s = getSize(id);
    out[id] = {
      x: Math.round(a.x + i * stepX),
      y: Math.round(a.y + i * stepY),
      w: s.w,
      h: s.h,
    };
  });
  return out;
};

const grid: LayoutFn = (ids) => {
  const a = getArea();
  const cols = Math.max(1, Math.min(ids.length, Math.floor(a.w / (DEFAULT_SIZE.w + GAP))));
  const rows = Math.ceil(ids.length / cols);
  const cellW = Math.floor((a.w - GAP * (cols - 1)) / cols);
  const out: Record<WidgetId, Rect> = {};
  ids.forEach((id, i) => {
    const s = getSize(id);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const stepY = rows > 1 ? Math.min(DEFAULT_SIZE.h + GAP, (a.h - s.h) / (rows - 1)) : 0;
    out[id] = {
      x: a.x + col * (cellW + GAP),
      y: Math.round(a.y + (rows > 1 ? row * stepY : 0)),
      w: Math.min(s.w, cellW),
      h: s.h,
    };
  });
  return out;
};

const colLeft: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const totalH = ids.reduce((acc, id) => acc + getSize(id).h, 0) + GAP * (ids.length - 1);
  const fits = totalH <= a.h;
  let y = a.y;
  ids.forEach((id, i) => {
    const s = getSize(id);
    if (fits) {
      out[id] = { x: a.x, y, w: s.w, h: s.h };
      y += s.h + GAP;
    } else {
      const stepY = ids.length > 1 ? Math.max(0, (a.h - s.h) / (ids.length - 1)) : 0;
      out[id] = { x: a.x, y: Math.round(a.y + i * stepY), w: s.w, h: s.h };
    }
  });
  return out;
};

const colRight: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const totalH = ids.reduce((acc, id) => acc + getSize(id).h, 0) + GAP * (ids.length - 1);
  const fits = totalH <= a.h;
  let y = a.y;
  ids.forEach((id, i) => {
    const s = getSize(id);
    if (fits) {
      out[id] = { x: a.x + a.w - s.w, y, w: s.w, h: s.h };
      y += s.h + GAP;
    } else {
      const stepY = ids.length > 1 ? Math.max(0, (a.h - s.h) / (ids.length - 1)) : 0;
      out[id] = { x: a.x + a.w - s.w, y: Math.round(a.y + i * stepY), w: s.w, h: s.h };
    }
  });
  return out;
};

const focus: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;
  const [primary, ...rest] = ids;
  const ps = getSize(primary);
  out[primary] = { x: a.x + Math.floor((a.w - ps.w) / 2), y: a.y, w: ps.w, h: ps.h };
  rest.forEach((id, i) => {
    const pillW = 200;
    out[id] = { x: a.x + i * (pillW + GAP), y: a.y + a.h - 48, w: pillW, h: 36 };
  });
  return out;
};

const spread: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const totalW = ids.reduce((s, id) => s + getSize(id).w, 0) + GAP * (ids.length - 1);
  const fits = totalW <= a.w;
  let x = a.x + Math.max(0, Math.floor((a.w - totalW) / 2));
  ids.forEach((id, i) => {
    const s = getSize(id);
    if (fits) {
      out[id] = { x, y: a.y + (i % 2 === 0 ? 0 : Math.min(80, a.h * 0.15)), w: s.w, h: s.h };
      x += s.w + GAP;
    } else {
      const stepX = ids.length > 1 ? (a.w - s.w) / (ids.length - 1) : 0;
      out[id] = { x: Math.round(a.x + i * stepX), y: a.y + (i % 2 === 0 ? 0 : Math.min(80, a.h * 0.15)), w: s.w, h: s.h };
    }
  });
  return out;
};

const splitColumns: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const half = Math.ceil(ids.length / 2);
  const colW = Math.floor((a.w - GAP) / 2);
  const leftCount = half;
  const rightCount = ids.length - half;

  ids.forEach((id, i) => {
    const s = getSize(id);
    const w = Math.min(s.w, colW);
    if (i < half) {
      const stepY = leftCount > 1 ? Math.max(0, (a.h - s.h) / (leftCount - 1)) : 0;
      out[id] = { x: a.x, y: Math.round(a.y + i * stepY), w, h: s.h };
    } else {
      const rIdx = i - half;
      const stepY = rightCount > 1 ? Math.max(0, (a.h - s.h) / (rightCount - 1)) : 0;
      out[id] = { x: a.x + a.w - w, y: Math.round(a.y + rIdx * stepY), w, h: s.h };
    }
  });
  return out;
};

const LAYOUTS: Array<{ id: string; label: string; description: string; fn: LayoutFn }> = [
  { id: "cascade", label: "Cascade",     description: "Diagonal waterfall",          fn: cascade },
  { id: "grid",    label: "Grid",         description: "Columns & rows",              fn: grid },
  { id: "split",   label: "Split",        description: "Two equal columns",           fn: splitColumns },
  { id: "left",    label: "Left column",  description: "Stacked on the left",         fn: colLeft },
  { id: "right",   label: "Right column", description: "Stacked on the right",        fn: colRight },
  { id: "focus",   label: "Focus",        description: "One prominent, rest aside",   fn: focus },
  { id: "spread",  label: "Spread",       description: "Distributed with stagger",    fn: spread },
];

// ── Layout i18n key maps (labels are UI; the LAYOUTS data stays English) ──
const LAYOUT_LABEL_KEY: Record<string, ParseKeys<"widgets">> = {
  cascade: "panel.layoutOrganizer.cascade",
  grid: "panel.layoutOrganizer.grid",
  split: "panel.layoutOrganizer.split",
  left: "panel.layoutOrganizer.left",
  right: "panel.layoutOrganizer.right",
  focus: "panel.layoutOrganizer.focus",
  spread: "panel.layoutOrganizer.spread",
};

const LAYOUT_DESC_KEY: Record<string, ParseKeys<"widgets">> = {
  cascade: "panel.layoutOrganizer.cascadeDesc",
  grid: "panel.layoutOrganizer.gridDesc",
  split: "panel.layoutOrganizer.splitDesc",
  left: "panel.layoutOrganizer.leftDesc",
  right: "panel.layoutOrganizer.rightDesc",
  focus: "panel.layoutOrganizer.focusDesc",
  spread: "panel.layoutOrganizer.spreadDesc",
};

// ── SVG miniature preview ────────────────────────────────────────────────

const SVG_W = 140;
const SVG_H = 80;

function LayoutPreviewSvg({ rects, ids }: { rects: Record<string, Rect>; ids: WidgetId[] }) {
  const { t } = useTranslation("widgets");
  const area = getArea();
  const scaleX = SVG_W / area.w;
  const scaleY = SVG_H / area.h;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block w-full h-auto">
      {ids.map((id, i) => {
        const r = rects[id];
        if (!r) return null;
        const sx = Math.max(0, Math.min((r.x - area.x) * scaleX, SVG_W - 4));
        const sy = Math.max(0, Math.min((r.y - area.y) * scaleY, SVG_H - 4));
        const sw = Math.max(4, Math.min(r.w * scaleX, SVG_W - sx));
        const sh = Math.max(4, Math.min(r.h * scaleY, SVG_H - sy));
        const hue = (i * 53) % 360;
        return (
          <g key={id}>
            <rect x={sx} y={sy} width={sw} height={sh} rx={2}
              fill={`hsl(${hue} 50% 55% / 0.2)`}
              stroke={`hsl(${hue} 50% 60% / 0.6)`}
              strokeWidth={0.8}
            />
            {sw > 20 && sh > 10 && (
              <text x={sx + sw / 2} y={sy + sh / 2 + 2.5} textAnchor="middle"
                fontSize={5} fill={`hsl(${hue} 50% 80%)`}
                style={{ pointerEvents: "none", userSelect: "none" }}>
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

  const layoutData = useMemo(() =>
    LAYOUTS.map((l) => ({ ...l, rects: openIds.length ? l.fn(openIds) : {} })),
  [openIds]);

  const applyBuiltInLayout = (rects: Record<WidgetId, Rect>, layoutId: string) => {
    const store = widgetStore.getState();
    openIds.forEach((id, i) => {
      const r = rects[id];
      if (!r) return;
      store.setPosition(id, { x: r.x, y: r.y });
      if (layoutId === "focus" && i > 0) {
        store.setStatus(id, "minimized");
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
                            <LayoutPreviewSvg rects={rects} ids={requiredIds} />
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
                        <LayoutPreviewSvg rects={layout.rects} ids={openIds} />
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

