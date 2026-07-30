"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Save, Trash2, Check, Lock, Plus } from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { useWidgetStore, widgetStore } from "@/widgets/widgetStore";
import { getWidget } from "@/widgets/registry";
import type { WidgetId } from "@/widgets/types";
import type { CustomLayout } from "@/widgets/widgetStore";
import { cn } from "@/lib/utils";

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
  ids.forEach((id, i) => { const s = getSize(id); out[id] = { x: a.x + i * 30, y: a.y + i * 30, w: s.w, h: s.h }; });
  return out;
};

const grid: LayoutFn = (ids) => {
  const a = getArea();
  const cols = Math.max(1, Math.min(ids.length, Math.floor(a.w / (DEFAULT_SIZE.w + GAP))));
  const cellW = Math.floor((a.w - GAP * (cols - 1)) / cols);
  const out: Record<WidgetId, Rect> = {};
  ids.forEach((id, i) => {
    const s = getSize(id);
    out[id] = { x: a.x + (i % cols) * (cellW + GAP), y: a.y + Math.floor(i / cols) * (DEFAULT_SIZE.h + GAP), w: Math.min(s.w, cellW), h: s.h };
  });
  return out;
};

const colLeft: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  let y = a.y;
  ids.forEach((id) => { const s = getSize(id); out[id] = { x: a.x, y, w: s.w, h: s.h }; y += s.h + GAP; });
  return out;
};

const colRight: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  let y = a.y;
  ids.forEach((id) => { const s = getSize(id); out[id] = { x: a.x + a.w - s.w, y, w: s.w, h: s.h }; y += s.h + GAP; });
  return out;
};

const focus: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  if (!ids.length) return out;
  const [primary, ...rest] = ids;
  const ps = getSize(primary);
  out[primary] = { x: a.x + Math.floor((a.w - ps.w) / 2), y: a.y, w: ps.w, h: ps.h };
  rest.forEach((id, i) => { const s = getSize(id); out[id] = { x: a.x + i * (s.w + GAP), y: a.y + a.h - 48, w: s.w, h: 36 }; });
  return out;
};

const spread: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const totalW = ids.reduce((s, id) => s + getSize(id).w, 0) + GAP * (ids.length - 1);
  let x = a.x + Math.max(0, Math.floor((a.w - totalW) / 2));
  ids.forEach((id, i) => {
    const s = getSize(id);
    out[id] = { x, y: a.y + (i % 2 === 0 ? 0 : Math.min(80, a.h * 0.15)), w: s.w, h: s.h };
    x += s.w + GAP;
  });
  return out;
};

const splitColumns: LayoutFn = (ids) => {
  const a = getArea();
  const out: Record<WidgetId, Rect> = {};
  const half = Math.ceil(ids.length / 2);
  const colW = Math.floor((a.w - GAP) / 2);
  let yL = a.y, yR = a.y;
  ids.forEach((id, i) => {
    const s = getSize(id);
    if (i < half) { out[id] = { x: a.x, y: yL, w: Math.min(s.w, colW), h: s.h }; yL += s.h + GAP; }
    else { out[id] = { x: a.x + colW + GAP, y: yR, w: Math.min(s.w, colW), h: s.h }; yR += s.h + GAP; }
  });
  return out;
};

const LAYOUTS: Array<{ id: string; label: string; description: string; fn: LayoutFn }> = [
  { id: "cascade", label: "Cascade",     description: "Diagonal waterfall",          fn: cascade },
  { id: "grid",    label: "Grid",         description: "Columns & rows",              fn: grid },
  { id: "split",   label: "Split",        description: "Two equal columns",           fn: splitColumns },
  { id: "left",    label: "Left Column",  description: "Stacked on the left",         fn: colLeft },
  { id: "right",   label: "Right Column", description: "Stacked on the right",        fn: colRight },
  { id: "focus",   label: "Focus",        description: "One prominent, rest aside",   fn: focus },
  { id: "spread",  label: "Spread",       description: "Distributed with stagger",    fn: spread },
];

// ── SVG miniature preview ────────────────────────────────────────────────

const SVG_W = 140;
const SVG_H = 80;

function LayoutPreviewSvg({ rects, ids }: { rects: Record<string, Rect>; ids: string[] }) {
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
        const def = getWidget(id);
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
                {def?.name?.split(" ")[0] ?? id}
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
  const instances = useWidgetStore((s) => s.instances);
  const customLayouts = useWidgetStore((s) => s.customLayouts);
  const [saveInputOpen, setSaveInputOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  // All active widgets (docked, floating, or minimized) except self
  const activeIds = useMemo(() =>
    Object.entries(instances)
      .filter(([, inst]) => inst?.status !== "inactive")
      .filter(([id]) => id !== SELF_ID)
      .map(([id]) => id as WidgetId),
  [instances]);

  // Floating widgets currently on screen
  const floatingIds = useMemo(() =>
    Object.entries(instances)
      .filter(([, inst]) => inst?.status === "floating" || inst?.status === "minimized")
      .filter(([id]) => id !== SELF_ID)
      .map(([id]) => id as WidgetId),
  [instances]);

  const activeCount = activeIds.length;

  const layoutData = useMemo(() =>
    LAYOUTS.map((l) => ({ ...l, rects: activeIds.length ? l.fn(activeIds) : {} })),
  [activeIds]);

  const applyBuiltInLayout = (rects: Record<WidgetId, Rect>, layoutId: string) => {
    const store = widgetStore.getState();
    activeIds.forEach((id, i) => {
      const r = rects[id];
      if (!r) return;
      store.setPosition(id, { x: r.x, y: r.y });
      if (layoutId === "focus" && i > 0) {
        store.setStatus(id, "minimized");
      } else {
        // Auto undock / expand all layout widgets to floating
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

  const handleDeleteCustom = (layoutId: string) => {
    widgetStore.getState().deleteCustomLayout(layoutId);
  };

  return (
    <FloatingWidgetWrapper widgetId={SELF_ID} icon={LayoutGrid} label="Layouts" panelWidth={300}>
      {activeCount === 0 && customLayouts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <LayoutGrid className="size-8 text-ink-3/40" />
          <p className="text-[0.78rem] font-medium text-ink-2">No active widgets</p>
          <p className="text-[0.7rem] leading-relaxed text-ink-3">
            Open widgets from the header dock or explorer to see layout presets here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Scrollable content */}
          <div className="flex flex-col gap-0 max-h-[380px] overflow-y-auto">
            {/* Header bar + save layout button */}
            <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-line bg-surface-2/90 backdrop-blur-xs px-3 py-1.5">
              <p className="text-[0.65rem] text-ink-3">
                <span className="font-semibold text-ink">{activeCount}</span> active widget{activeCount !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setSaveInputOpen((v) => !v)}
                className="flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                title="Save current layout positions"
              >
                <Save className="size-2.5" />
                Save Layout
              </button>
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
                  placeholder="Layout name..."
                  className="h-7 flex-1 rounded border border-line bg-surface px-2 text-[0.7rem] text-ink outline-none placeholder:text-ink-3/50 focus:border-ink/40"
                  autoFocus
                />
                <button
                  onClick={handleSaveCustom}
                  disabled={!saveName.trim() || floatingIds.length === 0}
                  className="flex items-center gap-1 rounded bg-ink px-2.5 py-1 text-[0.65rem] font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Check className="size-3" />
                  Save
                </button>
              </div>
            )}

            {/* Saved notification feedback */}
            {savedId && (
              <div className="flex items-center gap-1.5 border-b border-ready/20 bg-ready-soft/30 px-3 py-1.5">
                <Check className="size-3 text-ready" />
                <span className="text-[0.65rem] text-ready font-medium">Layout saved!</span>
              </div>
            )}

            {/* ── Custom layouts section ──────────────────────────────────────── */}
            {customLayouts.length > 0 && (
              <div className="px-2.5 pt-2 pb-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[0.55rem] uppercase tracking-[0.1em] text-ink-3/70 font-semibold">Custom Layouts</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {customLayouts.map((layout) => {
                    const requiredIds = Object.keys(layout.positions) as WidgetId[];
                    // Find widgets that are inactive
                    const missingIds = requiredIds.filter(
                      (id) => !instances[id] || instances[id].status === "inactive"
                    );
                    const isFullyActive = missingIds.length === 0;
                    const rects = customLayoutRects(layout);

                    // Descriptive label when widgets are missing
                    let missingText = "";
                    if (missingIds.length === 1) {
                      const def = getWidget(missingIds[0]);
                      missingText = `${def?.name ?? missingIds[0]} needed`;
                    } else if (missingIds.length > 1) {
                      missingText = `${missingIds.length} needed`;
                    }

                    return (
                      <div
                        key={layout.id}
                        className={cn(
                          "group relative flex flex-col rounded-lg border transition-all duration-150 overflow-hidden",
                          isFullyActive
                            ? "border-line bg-surface hover:shadow-md hover:scale-[1.02] hover:border-accent/40"
                            : "border-line/40 bg-surface-2/40 opacity-55"
                        )}
                      >
                        <button
                          onClick={() => isFullyActive && applyCustomLayout(layout)}
                          disabled={!isFullyActive}
                          className={cn(
                            "flex flex-col gap-1 p-2 text-left w-full",
                            !isFullyActive && "cursor-not-allowed"
                          )}
                        >
                          <div className="relative overflow-hidden rounded border border-line/50 bg-surface-2/50">
                            <LayoutPreviewSvg rects={rects} ids={requiredIds} />
                            {!isFullyActive && (
                              <div className="absolute inset-0 bg-surface/70 backdrop-blur-[1px] flex items-center justify-center gap-1 text-ink-3">
                                <Lock className="size-3 text-ink-3/80" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold text-ink leading-tight truncate">
                              {layout.name}
                            </p>
                            <p className="text-[0.58rem] text-ink-3 leading-tight mt-0.5">
                              {isFullyActive ? (
                                <span>{requiredIds.length} widget{requiredIds.length !== 1 ? "s" : ""}</span>
                              ) : (
                                <span className="text-caution font-medium flex items-center gap-0.5">
                                  {missingText}
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustom(layout.id);
                          }}
                          className="absolute right-1 top-1 grid size-5 place-items-center rounded text-ink-3/50 opacity-0 transition-all hover:bg-surface-2 hover:text-dnf group-hover:opacity-100 z-10"
                          aria-label={`Delete layout ${layout.name}`}
                          title="Delete layout"
                        >
                          <Trash2 className="size-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Built-in presets section ─────────────────────────────────── */}
            {activeCount > 0 && (
              <div className="px-2.5 pt-2 pb-1">
                <p className="text-[0.55rem] uppercase tracking-[0.1em] text-ink-3/70 font-semibold mb-1.5">Presets</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {layoutData.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => applyBuiltInLayout(layout.rects, layout.id)}
                      className="group flex flex-col gap-1 rounded-lg border border-line bg-surface p-2 text-left transition-all duration-150 hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <div className="overflow-hidden rounded border border-line/50 bg-surface-2/50">
                        <LayoutPreviewSvg rects={layout.rects} ids={activeIds} />
                      </div>
                      <div>
                        <p className="text-[0.68rem] font-semibold text-ink leading-tight">{layout.label}</p>
                        <p className="text-[0.58rem] text-ink-3 leading-tight">{layout.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer: active widget chips ───────────────────── */}
          {activeCount > 0 && (
            <div className="shrink-0 border-t border-line px-2.5 py-2">
              <div className="flex flex-wrap gap-1">
                {activeIds.map((id) => {
                  const def = getWidget(id);
                  const Icon = def?.icon;
                  return (
                    <span key={id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.62rem] text-ink-2">
                      {Icon && <Icon className="size-2.5 shrink-0 text-ink-3" />}
                      {def?.name ?? id}
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

