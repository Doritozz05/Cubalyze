"use client";

import { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METHODS, getSubsetsForMethod, getChildSubsets, getSeedData } from "@cubeforge/algorithm-db";
import type { AlgorithmMethod, AlgorithmSubset } from "@cubeforge/algorithm-db";
import type { PhaseStatsRecord, PhaseDefinition, PhaseModeDefinition, PhasePracticeType } from "@cubeforge/training";
import { buildMethodPhases, findSubsetId, getPhaseModes, getPhasePracticeType, masteryLevel } from "@cubeforge/training";
import { SectionHeader } from "@/components/Insights/atoms/SectionHeader";
import {
  Box,
  Layers,
  Pyramid,
  Zap,
  Target,
  Sparkles,
  Crosshair,
  Grid3x3,
  Palette,
  Shuffle,
  Blocks,
  ArrowRightLeft,
  Gauge,
  MoveHorizontal,
  Grid2x2,
  Clock,
  EyeOff,
  Eye,
  ArrowUp,
  MoveVertical,
  BarChart3,
  Timer,
} from "lucide-react";

/**
 * Localized descriptions for the training catalog (tanda 13 sweep).
 * The catalog data in packages (methodRegistry / training catalog) stays EN
 * as the canonical source; these maps localize it at the render point.
 * Keys are "<puzzleType>:<name-or-id>" for phases/subsets (ids/names repeat
 * across 3x3 and 2x2) and the method name for methods. Unknown entries fall
 * back to the catalog description.
 */
const METHOD_DESC_KEY: Partial<Record<string, ParseKeys<"training">>> = {
  CFOP: "catalog.method.CFOP",
  Roux: "catalog.method.Roux",
  ZZ: "catalog.method.ZZ",
  Petrus: "catalog.method.Petrus",
  "Advanced 3x3": "catalog.method.Advanced 3x3",
  Ortega: "catalog.method.Ortega",
  CLL: "catalog.method.CLL",
  EG: "catalog.method.EG",
};

const PHASE_DESC_KEY: Partial<Record<string, ParseKeys<"training">>> = {
  "333:cross": "catalog.phase.333.cross",
  "333:f2l": "catalog.phase.333.f2l",
  "333:af2l": "catalog.phase.333.af2l",
  "333:oll": "catalog.phase.333.oll",
  "333:pll": "catalog.phase.333.pll",
  "333:first-block": "catalog.phase.333.first-block",
  "333:second-block": "catalog.phase.333.second-block",
  "333:cmll": "catalog.phase.333.cmll",
  "333:lse": "catalog.phase.333.lse",
  "333:eoline": "catalog.phase.333.eoline",
  "333:f2l-zz": "catalog.phase.333.f2l-zz",
  "333:ll-zz": "catalog.phase.333.ll-zz",
  "333:block-222": "catalog.phase.333.block-222",
  "333:block-223": "catalog.phase.333.block-223",
  "333:eo-petrus": "catalog.phase.333.eo-petrus",
  "333:f2l-petrus": "catalog.phase.333.f2l-petrus",
  "333:ll-petrus": "catalog.phase.333.ll-petrus",
  "222:oll": "catalog.phase.222.oll",
  "222:pbl": "catalog.phase.222.pbl",
  "222:cll": "catalog.phase.222.cll",
  "222:eg1": "catalog.phase.222.eg1",
  "222:eg2": "catalog.phase.222.eg2",
};

const SUBSET_DESC_KEY: Partial<Record<string, ParseKeys<"training">>> = {
  "333:F2L": "catalog.subset.333.F2L",
  "333:Basic F2L": "catalog.subset.333.Basic F2L",
  "333:Advanced F2L": "catalog.subset.333.Advanced F2L",
  "333:OLL": "catalog.subset.333.OLL",
  "333:PLL": "catalog.subset.333.PLL",
  "333:COLL": "catalog.subset.333.COLL",
  "333:Winter Variation": "catalog.subset.333.Winter Variation",
  "333:VLS": "catalog.subset.333.VLS",
  "333:ZBLL": "catalog.subset.333.ZBLL",
  "333:CLS": "catalog.subset.333.CLS",
  "333:Summer Variation": "catalog.subset.333.Summer Variation",
  "333:ELL": "catalog.subset.333.ELL",
  "333:Anti PLL": "catalog.subset.333.Anti PLL",
  "333:CMLL": "catalog.subset.333.CMLL",
  "333:LSE": "catalog.subset.333.LSE",
  "333:First Block": "catalog.subset.333.First Block",
  "333:Second Block": "catalog.subset.333.Second Block",
  "333:OCLL": "catalog.subset.333.OCLL",
  "333:EOLine": "catalog.subset.333.EOLine",
  "333:ZZLL": "catalog.subset.333.ZZLL",
  "333:2x2x2 Block": "catalog.subset.333.2x2x2 Block",
  "333:2x2x3 Block": "catalog.subset.333.2x2x3 Block",
  "333:EO": "catalog.subset.333.EO",
  "222:OLL": "catalog.subset.222.OLL",
  "222:PBL": "catalog.subset.222.PBL",
  "222:CLL": "catalog.subset.222.CLL",
  "222:EG": "catalog.subset.222.EG",
  "222:EG-1": "catalog.subset.222.EG-1",
  "222:EG-2": "catalog.subset.222.EG-2",
};

/* ──────────────────────────────────────────────────────────────────────────
   Phase presentation
   Phase identities, practice modes, subset resolution and mastery labels
   come from the @cubeforge/training catalog (single source of truth).
   This file only adds ICONS — pure presentation.
   ─────────────────────────────────────────────────────────────────────── */

/** phase id → icon (UI-only). */
const PHASE_ICONS: Record<string, React.ElementType> = {
  cross: Crosshair, f2l: Grid3x3, af2l: Layers, oll: Palette, pll: Shuffle, pbl: Shuffle,
  cll: Layers, eg1: Grid2x2, eg2: Grid2x2,
  "first-block": Box, "second-block": Blocks, cmll: Palette, lse: ArrowRightLeft,
  eoline: Zap, "f2l-zz": Grid3x3, "ll-zz": Target,
  "block-222": Grid2x2, "block-223": Grid3x3, "eo-petrus": Gauge,
  "f2l-petrus": MoveHorizontal, "ll-petrus": Target,
};

export type PhaseDef = PhaseDefinition & { icon: React.ElementType };

/** Phases for a method (identity from the catalog) with presentation icons. */
export function getPhasesForMethod(methodName: string): PhaseDef[] {
  return buildMethodPhases(methodName).map((phase) => ({
    ...phase,
    icon: PHASE_ICONS[phase.id] ?? Sparkles,
  }));
}

export type PhaseModeDef = PhaseModeDefinition & { icon: React.ElementType };

/** mode id → icon (UI-only). */
const PHASE_MODE_ICONS: Record<string, React.ElementType> = {
  plain: Clock, blind: EyeOff, optimal: MoveHorizontal, cn: Palette,
  "speed-vs-eff": Gauge, eo: ArrowRightLeft, ulur: ArrowUp, mslice: MoveVertical,
  detect: Eye, efficiency: Gauge,
};

/** Modes for a phase type (identity from the catalog) with presentation icons. */
export function getPhaseModesWithIcons(phaseType: PhasePracticeType): PhaseModeDef[] {
  return getPhaseModes(phaseType).map((mode) => ({
    ...mode,
    icon: PHASE_MODE_ICONS[mode.id] ?? Clock,
  }));
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  CFOP: Layers, Roux: Box, ZZ: Zap, Petrus: Pyramid,
  "Advanced 3x3": Sparkles,
  Ortega: Grid2x2, CLL: Layers, EG: Grid2x2,
};

const PHASE_DOT: Record<string, string> = {
  cross: "bg-phase-blue", f2l: "bg-phase-emerald", af2l: "bg-phase-teal", oll: "bg-phase-amber", pll: "bg-phase-violet", pbl: "bg-phase-purple",
  cll: "bg-phase-indigo", eg1: "bg-phase-rose", eg2: "bg-phase-cyan",
  "first-block": "bg-phase-rose", "second-block": "bg-phase-orange", cmll: "bg-phase-violet", lse: "bg-phase-cyan",
  eoline: "bg-phase-sky", "f2l-zz": "bg-phase-emerald", "ll-zz": "bg-phase-amber",
  "block-222": "bg-phase-rose", "block-223": "bg-phase-orange", "eo-petrus": "bg-phase-cyan",
  "f2l-petrus": "bg-phase-emerald", "ll-petrus": "bg-phase-amber",
};

/* ──────────────────────────────────────────────────────────────────────────
   Practice workspace (the Training landing screen)
   Method rail (selection) + method banner with a mastery ring + exercises
   and algorithm sets as full-width rows with VISIBLE action chips. The
   primary action per row is ink-filled, the rest are quiet outlines —
   every option stays in view (no hidden menus).
   ─────────────────────────────────────────────────────────────────────── */

export function TrainingPractice({
  puzzleMethods,
  activeMethodId,
  onSelectMethod,
  methodMasteries,
  phaseStatsMap,
  onDrill,
  onRecognize,
  onPracticeMode,
  onStats,
  onFullSolve,
  embedded = false,
}: {
  puzzleMethods: AlgorithmMethod[];
  activeMethodId: string;
  onSelectMethod: (methodId: string) => void;
  methodMasteries: Record<string, number>;
  /** Real per-phase accuracy (0-100) keyed by phaseId — shown inline on rows. */
  phaseStatsMap: Record<string, PhaseStatsRecord | null>;
  onDrill: (methodId: string, phaseId: string, subsetId: string) => void;
  onRecognize: (methodId: string, phaseId: string, subsetId: string) => void;
  onPracticeMode: (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => void;
  onStats: (methodId: string, phaseId: string, phaseName: string) => void;
  onFullSolve: (methodId: string) => void;
  /** True when a parent panel owns scroll + padding (desktop dashboard). */
  embedded?: boolean;
}) {
  const { t } = useTranslation("training");
  const method = METHODS.find((m) => m.id === activeMethodId);
  const methodDescKey = method ? METHOD_DESC_KEY[method.name] : undefined;
  const phases = method ? getPhasesForMethod(method.name) : [];
  const mastery = method ? (methodMasteries[method.name] ?? 0) : 0;

  // ── Mobile method chips: edge fades when the row overflows ────────────
  // Mirrors WidgetDock's horizontal-scroll affordance: the scrollbar is
  // hidden, so a gradient fade at the visible edge hints there is more
  // content in that direction instead of looking like chips are cut off.
  const methodChipsRef = useRef<HTMLDivElement>(null);
  const [methodChipsEdges, setMethodChipsEdges] = useState({ left: false, right: false });

  const updateMethodChipsEdges = useCallback(() => {
    const el = methodChipsRef.current;
    if (!el) return;
    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    setMethodChipsEdges((prev) =>
      prev.left === !atLeft && prev.right === !atRight
        ? prev
        : { left: !atLeft, right: !atRight },
    );
  }, []);

  const methodChipsMask =
    methodChipsEdges.left || methodChipsEdges.right
      ? `linear-gradient(to right, ${methodChipsEdges.left ? "transparent" : "black"} 0, black 12px, black calc(100% - 12px), ${methodChipsEdges.right ? "transparent" : "black"} 100%)`
      : undefined;

  // Keep fades in sync with chip changes and window resizes.
  useLayoutEffect(() => {
    updateMethodChipsEdges();
    const el = methodChipsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateMethodChipsEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateMethodChipsEdges, puzzleMethods.length, activeMethodId]);

  // Mouse-wheel horizontal scroll when the row overflows (desktop trackpads
  // at <lg widths, where the rail is hidden but the scrollbar is too).
  useEffect(() => {
    const el = methodChipsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      if (!overflow) return;
      e.preventDefault();
      // Normalize line-mode deltas to pixels so it scrolls comfortably.
      const factor = e.deltaMode === 1 ? 16 : 1;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX * factor
        : e.deltaY * factor;
      el.scrollLeft += dx;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [puzzleMethods.length, activeMethodId]);

  // ── Subset drill/recognize rows ("Algorithm Sets") ─────────────
  // Subsets of the active method that are NOT already surfaced by a phase
  // row (e.g. COLL, Winter Variation, or every subset of "Advanced 3x3", a
  // method that has no phases). Zero-case subsets (VLS, ZBLL, CMLL…) are
  // disabled as "coming soon". Case counts include child subsets.
  const phaseSubsetIds = useMemo(() => {
    const ids = new Set<string>();
    if (!method) return ids;
    for (const phase of phases) {
      const sid = findSubsetId(method.id, phase.id);
      if (sid) ids.add(sid);
    }
    return ids;
    // phases is recreated on every render; depend on a stable key so the
    // memo actually caches instead of recomputing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method?.id, phases.map((p) => p.id).join(",")]);

  const subsetRows = useMemo(() => {
    if (!method) return [];
    const { cases } = getSeedData();
    const countBySubset = new Map<string, number>();
    for (const c of cases) {
      countBySubset.set(c.subsetId, (countBySubset.get(c.subsetId) ?? 0) + 1);
    }
    const coversPhaseSubset = (subset: AlgorithmSubset): boolean => {
      if (phaseSubsetIds.has(subset.id)) return true;
      return getChildSubsets(subset.id).some((c) => phaseSubsetIds.has(c.id));
    };
    const rows: { subset: AlgorithmSubset; caseCount: number }[] = [];
    for (const subset of getSubsetsForMethod(method.id)) {
      if (coversPhaseSubset(subset)) continue;
      const direct = countBySubset.get(subset.id) ?? 0;
      const childCount = getChildSubsets(subset.id).reduce(
        (s, c) => s + (countBySubset.get(c.id) ?? 0),
        0,
      );
      rows.push({ subset, caseCount: direct + childCount });
    }
    return rows.sort((a, b) => a.subset.sortOrder - b.subset.sortOrder);
  }, [method, phaseSubsetIds]);

  // Desktop method selection lives in the shell's left panel (TrainingDashboard
  // renders MethodRailItem there); this component only carries the workspace.
  // `embedded` drops the scroll wrapper + padding: the desktop dashboard's
  // content panel owns scrolling, so practice shares one page with the
  // review queue and calendar below it.
  const workspace = (
    <>
      {/* Mobile method chips */}
      <div
        ref={methodChipsRef}
        onScroll={updateMethodChipsEdges}
        className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none lg:hidden"
        style={{ maskImage: methodChipsMask, WebkitMaskImage: methodChipsMask }}
      >
        {puzzleMethods.map((m) => {
          const isActive = m.id === activeMethodId;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMethod(m.id)}
              className={cn(
                "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[0.68rem] font-medium transition-colors",
                isActive ? "bg-ink text-surface" : "bg-surface-2 text-ink-3 hover:text-ink",
              )}
            >
              {m.name}
              <span className="nums text-[0.55rem] opacity-70">{methodMasteries[m.name] ?? 0}%</span>
            </button>
          );
        })}
      </div>

      {!method ? (
        <p className="py-10 text-center text-[0.72rem] text-ink-3">{t("selectMethodHint")}</p>
      ) : (
            <>
              {/* Method banner */}
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5">
                <div className="flex min-w-0 items-center gap-4">
                  {/* Mastery ring — the method's progress at a glance */}
                  <div className="relative size-14 shrink-0">
                    <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-line" />
                      <motion.circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "0 100" }}
                        animate={{ strokeDasharray: `${Math.max(mastery, 0.5)} 100` }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                        className={cn(
                          "stroke-ink/70",
                          mastery >= 80 && "stroke-ready",
                          mastery >= 50 && mastery < 80 && "stroke-caution",
                        )}
                      />
                    </svg>
                    <span className="nums absolute inset-0 grid place-items-center text-[0.68rem] font-semibold text-ink">
                      {mastery}%
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[0.95rem] font-semibold tracking-tight text-ink">{method.name}</h3>
                    <p className="mt-0.5 max-w-md text-[0.68rem] leading-relaxed text-ink-3">
                      {methodDescKey ? t(methodDescKey) : method.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[0.62rem] font-medium text-ink-3">{t(`mastery.${masteryLevel(mastery)}`)}</span>
                  {phases.length > 0 && (
                    <button
                      onClick={() => onFullSolve(method.id)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-ink px-3.5 text-[0.68rem] font-semibold text-surface transition-colors hover:bg-ink/90"
                    >
                      <Timer className="size-3.5" />
                      {t("fullSolve.title")}
                    </button>
                  )}
                </div>
              </section>

              {/* Exercises — phases as rows */}
              {phases.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <SectionHeader title={t("exercises")} eyebrow={`${phases.length}`} />
                  <div className="flex flex-col gap-2">
                    {phases.map((phase) => (
                      <PhaseRow
                        key={phase.id}
                        phase={phase}
                        puzzleType={method.puzzleType}
                        stats={phaseStatsMap[phase.id] ?? null}
                        onDrill={() => {
                          const sid = findSubsetId(method.id, phase.id);
                          if (sid) onDrill(method.id, phase.id, sid);
                        }}
                        onRecognize={() => {
                          const sid = findSubsetId(method.id, phase.id);
                          if (sid) onRecognize(method.id, phase.id, sid);
                        }}
                        onPracticeMode={(modeId) => {
                          const pt = getPhasePracticeType(phase.id);
                          if (pt) onPracticeMode(method.id, phase.id, phase.name, pt, modeId);
                        }}
                        onStats={() => onStats(method.id, phase.id, phase.name)}
                        phaseModes={
                          !phase.hasAlgorithms
                            ? (() => {
                                const pt = getPhasePracticeType(phase.id);
                                return pt ? getPhaseModesWithIcons(pt) : [];
                              })()
                            : null
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Algorithm Sets — subsets as rows */}
              {subsetRows.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <SectionHeader title={t("algorithmSets")} eyebrow={t("drillOrRecognizeEachSet")} />
                  <div className="flex flex-col gap-2">
                    {subsetRows.map(({ subset, caseCount }) => (
                      <SubsetRow
                        key={subset.id}
                        subset={subset}
                        caseCount={caseCount}
                        puzzleType={method.puzzleType}
                        onDrill={() => onDrill(method.id, "", subset.id)}
                        onRecognize={() => onRecognize(method.id, "", subset.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-6 p-6">{workspace}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Main workspace */}
      <div className="min-w-0 flex-1 overflow-y-auto pb-safe">
        {/* p-1 on touch offsets the shell's px-3 gutter so cards keep the
            same 16px phone margin as before; sm:p-6 keeps desktop spacing. */}
        <div className="flex flex-col gap-6 p-1 sm:p-6">{workspace}</div>
      </div>
    </div>
  );
}

/* ── Method rail item (practice tab, desktop) ──────────────────────────── */

/** Exported for the Training shell's left panel (desktop method list). */
export function MethodRailItem({
  method,
  mastery,
  active,
  onClick,
}: {
  method: AlgorithmMethod;
  mastery: number;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = METHOD_ICONS[method.name] ?? Layers;
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        active ? "text-ink" : "text-ink-3 hover:bg-surface-2/60 hover:text-ink",
      )}
    >
      {active && (
        <motion.div
          layoutId="training-method-pill"
          className="absolute inset-0 rounded-md bg-surface-2"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={cn("relative z-10 size-3.5", active ? "text-ink" : "text-ink-3/70")} />
      <span className="relative z-10 min-w-0 flex-1 truncate text-[0.7rem] font-medium">{method.name}</span>
      <span className="nums relative z-10 text-[0.58rem] text-ink-3">{mastery}%</span>
    </button>
  );
}

/* ── Action chip — visible, hierarchical (primary = ink fill) ──────────── */

/* ── Action chip — uniformly quiet so every mode reads equal; the only
   filled control in the workspace is Full Solve in the method banner. ── */

function ActionChip({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 max-lg:h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface-2/70 px-3 text-[0.65rem] font-medium text-ink-2 transition-all hover:border-ink/20 hover:bg-surface-2 hover:text-ink",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/* ── Phase row (exercise) — info left, visible actions right ──────────── */

function PhaseRow({
  phase,
  puzzleType,
  stats,
  onDrill,
  onRecognize,
  onPracticeMode,
  onStats,
  phaseModes,
}: {
  phase: PhaseDef;
  puzzleType: string;
  stats: PhaseStatsRecord | null;
  onDrill: () => void;
  onRecognize: () => void;
  onPracticeMode: (modeId: string) => void;
  onStats: () => void;
  phaseModes: PhaseModeDef[] | null;
}) {
  const { t } = useTranslation("training");
  const Icon = phase.icon;
  const descKey = PHASE_DESC_KEY[`${puzzleType}:${phase.id}`];
  const hasData = stats != null && stats.totalAttempts > 0;
  const isAlgo = phase.hasAlgorithms;
  const modes = phaseModes ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2/30 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
          <Icon className="size-4 text-ink-2" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[0.78rem] font-semibold text-ink">{phase.name}</p>
            <span className={cn("size-1.5 shrink-0 rounded-full", PHASE_DOT[phase.id] ?? "bg-ink-3")} />
            <span className="shrink-0 text-[0.58rem] font-medium uppercase tracking-[0.12em] text-ink-3">
              {isAlgo ? t("algorithmic") : t("intuitive")}
            </span>
          </div>
          <p className="truncate text-[0.62rem] text-ink-3">{descKey ? t(descKey) : phase.description}</p>
        </div>
        {hasData && (
          <span
            className={cn(
              "nums hidden shrink-0 text-[0.68rem] font-medium sm:inline",
              stats.accuracy >= 80 ? "text-ready" : stats.accuracy >= 50 ? "text-caution" : "text-hold",
            )}
            title={t("stats")}
          >
            {stats.accuracy}%
          </span>
        )}
      </div>

      {/* Visible actions — all quiet outlines; Full Solve in the banner is
          the single filled control in the workspace */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {isAlgo ? (
          <>
            <ActionChip onClick={onDrill}>
              <Gauge className="size-3" /> {t("drill.title")}
            </ActionChip>
            <ActionChip onClick={onRecognize}>
              <Eye className="size-3" /> {t("recognize.title")}
            </ActionChip>
            <ActionChip onClick={onStats}>
              <BarChart3 className="size-3" /> {t("stats")}
            </ActionChip>
          </>
        ) : modes.length > 0 ? (
          <>
            {modes.map((m) => (
              <ActionChip key={m.id} onClick={() => onPracticeMode(m.id)}>
                <m.icon className="size-3" /> {m.label}
              </ActionChip>
            ))}
            <ActionChip onClick={onStats}>
              <BarChart3 className="size-3" /> {t("stats")}
            </ActionChip>
          </>
        ) : (
          <ActionChip onClick={onStats}>
            <BarChart3 className="size-3" /> {t("stats")}
          </ActionChip>
        )}
      </div>
    </div>
  );
}

/* ── Subset row (algorithm set) — same pattern ────────────────────────── */

function SubsetRow({
  subset,
  caseCount,
  puzzleType,
  onDrill,
  onRecognize,
}: {
  subset: AlgorithmSubset;
  caseCount: number;
  puzzleType: string;
  onDrill: () => void;
  onRecognize: () => void;
}) {
  const { t } = useTranslation("training");
  const disabled = caseCount <= 0;
  const descKey = SUBSET_DESC_KEY[`${puzzleType}:${subset.name}`];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2/30 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
          <Sparkles className="size-4 text-ink-2" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.78rem] font-semibold text-ink">{subset.name}</p>
          <p className="truncate text-[0.62rem] text-ink-3">{descKey ? t(descKey) : subset.description}</p>
        </div>
        <span className="nums shrink-0 text-[0.6rem] text-ink-3">
          {disabled ? t("comingSoon") : t("caseCount", { count: caseCount })}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <ActionChip onClick={onDrill} disabled={disabled}>
          <Gauge className="size-3" /> {t("drill.title")}
        </ActionChip>
        <ActionChip onClick={onRecognize} disabled={disabled}>
          <Eye className="size-3" /> {t("recognize.title")}
        </ActionChip>
      </div>
    </div>
  );
}
