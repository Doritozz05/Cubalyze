"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Clipboard, ClipboardCheck, Trash2, FolderInput, MessageSquare, Check, Pencil, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/formatTime";
import {
  deriveTimeline,
  derivePairSegments,
  type TimelineData,
  type TimelineSegment,
  type PairSegment,
} from "@/utils/insights";
import { phaseColorHex, pauseColorHex, PAUSE_COLOR_BY_CATEGORY } from "@/utils/phaseColors";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { Penalty, Solve } from "@/types";
import type {
  SolveMetrics,
  RotationMetrics,
  EfficiencyMetrics,
} from "@cubeforge/types";
import {
  CaseMiniCube,
  LastLayerCaseCell,
  MovesSeq,
  CfopMiniBar,
  leadingU,
  orderPairColors,
  pairStickerColors,
  ROW,
  ROW_LINE,
} from "@/components/Cases";
import { getSeedData, type AlgorithmCase } from "@cubeforge/algorithm-db";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import {
  SectionHeader,
  EmptyState,
  MetricRing,
  SkippedBadge,
  FaceChip,
  FACE_HEX,
} from "./atoms";
import { ReplaySection, type ReplaySectionHandle } from "./ReplaySection";

export interface SolveAnalysisPanelProps {
  solve: Solve;
  /** Pending analysis from the just-completed live solve (not yet persisted). */
  liveMetrics: SolveMetrics | null;
  isLive: boolean;
  onUpdateSolve: (updates: { penalty?: Penalty; note?: string | null }) => void;
  /** Re-run the analysis pipeline on this solve (returns when finished). */
  onReanalyze?: () => Promise<void>;
  onDeleteSolve: () => void;
  /** Open the "Move to another session" dialog for this solve. */
  onMoveSolve?: () => void;
  onBackToOverview: () => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMELINE_HEIGHT = 92;
const TPS_AREA_TOP = 4;
const TPS_AREA_BOTTOM = 34; // TPS chart occupies the top band
const SEG_TOP = 44;        // unified segment blocks (phases + pauses) live here
const SEG_BOTTOM = 82;

const EMPTY_ROTATION: RotationMetrics = {
  totalCount: 0,
  byAxis: { x: 0, y: 0, z: 0 },
  estimatedRotationTimeMs: 0,
  consecutiveCount: 0,
  byPhase: {},
  rotationToMoveRatio: 0,
  redundantRotations: 0,
};

const EMPTY_EFFICIENCY: EfficiencyMetrics = {
  moveEfficiencyRatio: 0,
  optimalMoveCount: 0,
  redundancies: 0,
  cancellations: 0,
  overturns: 0,
  forwardDrift: 0,
};

// ─── Main component ────────────────────────────────────────────────────────

export function SolveAnalysisPanel({
  solve,
  liveMetrics,
  isLive,
  onUpdateSolve,
  onReanalyze,
  onDeleteSolve,
  onMoveSolve,
  onBackToOverview,
  className,
}: SolveAnalysisPanelProps) {
  const { t } = useTranslation("insights");
  const cyclePenalty = () => {
    const next: Penalty =
      solve.penalty === "none" ? "+2" : solve.penalty === "+2" ? "DNF" : "none";
    onUpdateSolve({ penalty: next });
  };

  const m = liveMetrics;
  const timeline = useMemo<TimelineData>(
    () => (m ? deriveTimeline({ ...solve, analysis: m }) : deriveTimeline(solve)),
    [solve, m],
  );

  // Lifted cross-highlight state: hovering a timeline block or a phase
  // breakdown row highlights the other. Null = nothing highlighted.
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  // ── Replay state ──────────────────────────────────────────────────────────
  const [replayPosMs, setReplayPosMs] = useState<number | null>(null);
  const [replayMoveIdx, setReplayMoveIdx] = useState<number | null>(null);
  const [, setReplaying] = useState(false);
  const replayRef = useRef<ReplaySectionHandle>(null);

  // F2L pairs as timeline sub-segments (the "pairs lane" under the phase
  // blocks) — same shared boundaries the case table uses, so what the
  // timeline paints and what the table lists are the same pairs.
  const pairSegments = useMemo<PairSegment[]>(
    () =>
      m?.cfop?.f2lPairs?.length ? derivePairSegments(m, solve.moves) : [],
    [m, solve.moves],
  );

  // Seek the 3D replay to a move index (pair/phase rows + timeline lane).
  // The playhead snaps to the move's tick immediately; the cube follows once
  // the engine applies the seek (async).
  const seekToMove = useCallback((moveIndex: number) => {
    setReplayPosMs(null);
    setReplayMoveIdx(moveIndex);
    setReplaying(true);
    void replayRef.current?.seekToMove(moveIndex);
  }, []);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(solve.note ?? "");
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Re-analysis is meaningful whenever per-move data exists and the initial
  // analysis is not still pending (a pending live job would race with it).
  // Deep analysis is 3×3-only: 2×2 solves keep moves for the replay but have
  // no analysis pipeline, so re-running would feed 3×3 detection on a 2×2
  // and persist meaningless metrics.
  const canReanalyze =
    (solve.moves?.length ?? 0) > 0 &&
    !isLive &&
    (solve.puzzleType ?? "333") === "333";
  const handleReanalyze = useCallback(async () => {
    if (!onReanalyze || isReanalyzing) return;
    setIsReanalyzing(true);
    try {
      await onReanalyze();
    } finally {
      setIsReanalyzing(false);
    }
  }, [onReanalyze, isReanalyzing]);

  // Stable solve object for the ReplaySection (avoids unnecessary re-creates).
  const replaySolve = useMemo(
    () => (solve.analysis ? solve : { ...solve, analysis: m ?? undefined }),
    [solve, m],
  );

  return (
    <div className={cn("flex flex-col gap-4 px-1 pb-4 bg-canvas", className)}>
      {/* Back to overview — desktop only; the touch overlay provides its
          own sticky header with a back button. */}
      <button
        onClick={onBackToOverview}
        className="flex items-center gap-1.5 self-start text-[0.72rem] text-ink-3 transition-colors hover:text-ink max-lg:hidden"
      >
        <ArrowLeft className="size-3.5" />
        {t("analysis.overview")}
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-lg border border-line bg-surface px-5 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="nums text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            {formatTimestampFull(solve.timestamp)}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={cyclePenalty}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide transition-colors hover:opacity-80 cursor-pointer",
                    solve.penalty === "DNF"
                      ? "border-dnf/30 bg-dnf-soft text-dnf"
                      : solve.penalty === "+2"
                        ? "border-plus2/30 bg-plus2-soft text-plus2"
                        : "border-ready/30 bg-ready-soft text-ready",
                  )}
                >
                  {solve.penalty === "none" ? t("common.clean") : solve.penalty}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("analysis.cyclePenalty")}</TooltipContent>
            </Tooltip>
            {solve.method ? (
              <span className="rounded border border-phase-indigo/30 bg-phase-indigo/10 px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-phase-indigo">
                {solve.method}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide",
                solve.source === "smart"
                  ? "border-phase-emerald/30 bg-phase-emerald/10 text-phase-emerald"
                  : solve.source === "virtual"
                    ? "border-phase-violet/30 bg-phase-violet/10 text-phase-violet"
                    : "border-line bg-surface-2 text-ink-2",
              )}
            >
              {solve.source === "smart"
                ? t("analysis.smartCube")
                : solve.source === "virtual"
                  ? t("analysis.virtualCube")
                  : t("analysis.manual")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {canReanalyze && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="h-7 max-lg:h-10 gap-1 px-2 text-xs text-ink-3 hover:text-ink disabled:opacity-50"
              title={t("analysis.reanalyzeTooltip")}
            >
              <RotateCcw className={cn("size-3", isReanalyzing && "animate-spin")} />
              {isReanalyzing ? t("analysis.reanalyzing") : t("analysis.reanalyze")}
            </Button>
          )}
          {onMoveSolve && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveSolve}
              className="h-7 max-lg:h-10 gap-1 px-2 text-xs text-ink-3 hover:text-ink"
            >
              <FolderInput className="size-3" />
              {t("analysis.moveToSession")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSolve}
            className="h-7 max-lg:h-10 gap-1 px-2 text-xs text-ink-3 hover:text-dnf"
          >
            <Trash2 className="size-3" />
            {t("analysis.delete")}
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.62rem] font-medium uppercase tracking-[0.2em] text-ink-3">
            {t("analysis.solve")}
          </span>
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-wide text-ink-2">
              <span className="size-1.5 animate-pulse rounded-full bg-ready/70" />
              {t("analysis.live")}
            </span>
          ) : null}
        </div>
        <p className="nums text-4xl text-ink">
          {solve.penalty === "DNF" ? "DNF" : formatTime(solve.time)}
        </p>
        {m ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[0.7rem] text-ink-3">
              {t("analysis.summary", {
                moves: m.totalMoves,
                phases: m.phases.length,
                tps: m.tps.global.toFixed(2),
                pauses: m.pauses.totalCount,
              })}
            </p>
          </div>
        ) : (
          <p className="text-[0.7rem] text-ink-3">{t("analysis.noAnalysisYet")}</p>
        )}
      </div>

      {/* ── Scramble block (up top, right under the solve time) ── */}
      <ScrambleBlock solve={solve} />

      {/* ── Note section ── */}
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-phase-indigo" />
            <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-3">
              {t("analysis.note")}
            </span>
          </div>
          {!isEditingNote && (
            <button
              onClick={() => {
                setNoteText(solve.note ?? "");
                setIsEditingNote(true);
              }}
              className="flex items-center gap-1 text-[0.68rem] text-ink-3 transition-colors hover:text-ink cursor-pointer"
            >
              <Pencil className="size-3" />
              {solve.note ? t("analysis.edit") : t("analysis.addNote")}
            </button>
          )}
        </div>

        {isEditingNote ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = noteText.trim();
              onUpdateSolve({ note: trimmed || null });
              setIsEditingNote(false);
            }}
            className="flex items-center gap-2 mt-1"
          >
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("analysis.notePlaceholder")}
              autoFocus
              className="flex-1 rounded-md border border-line bg-surface-2/60 px-3 py-1.5 text-[0.78rem] text-ink placeholder:text-ink-3/60 outline-none focus:border-ink/40"
            />
            <Button type="submit" size="sm" className="h-8 px-3 text-xs bg-ink text-surface hover:bg-ink/90 cursor-pointer">
              <Check className="size-3.5 mr-1" />
              {t("analysis.save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingNote(false)}
              className="h-8 px-2 text-xs text-ink-3 hover:text-ink cursor-pointer"
            >
              <X className="size-3.5" />
            </Button>
          </form>
        ) : solve.note ? (
          <p className="text-[0.78rem] text-ink leading-relaxed whitespace-pre-wrap">
            {solve.note}
          </p>
        ) : (
          <p className="text-[0.7rem] text-ink-3/60 italic">{t("analysis.noNotes")}</p>
        )}
      </div>

      {/* ── Replay (always visible, even without analysis, as long as there are moves) ── */}
      <ReplaySection
        ref={replayRef}
        solve={replaySolve}
        onReplayPosition={(ms, moveIndex) => {
          setReplayPosMs(ms);
          setReplayMoveIdx(moveIndex);
          setReplaying(true);
        }}
        onReplayComplete={() => {
          setReplayPosMs(null);
          setReplayMoveIdx(null);
          setReplaying(false);
        }}
      />

      {/* Analysis sections or empty banner */}
      {!m ? (
        <EmptyState
          title={t("analysis.noAnalysisTitle")}
          description={
            solve.source === "smart"
              ? t("analysis.noAnalysisSmart")
              : solve.source === "virtual"
                ? t("analysis.noAnalysisVirtual")
                : t("analysis.noAnalysisManual")
          }
          className="py-12"
        />
      ) : (
        <>
          {/* ── Interactive timeline ────────────────────────────────────── */}
          <TimelineSection
            timeline={timeline}
            meanTps={m.tps.global}
            hoveredPhase={hoveredPhase}
            onHoverPhase={setHoveredPhase}
            replayPositionMs={replayPosMs}
            replayMoveIdx={replayMoveIdx}
            pairSegments={pairSegments}
            onSeekToMove={seekToMove}
          />

          {/* ── Key metric rings ────────────────────────────────────────── */}
          <MetricRingsSection metrics={m} />

          {/* ── Phase breakdown ─────────────────────────────────────────── */}
          <PhaseBreakdownSection
            metrics={m}
            solveTimeMs={solve.time}
            hoveredPhase={hoveredPhase}
            onHoverPhase={setHoveredPhase}
          />

          {/* ── Pauses with probable causes ─────────────────────────────── */}
          {/* (removed — pauses are now integrated in the timeline above) */}

          {/* ── Method-specific details ─────────────────────────────────── */}
          {m.cfop && (
            <CfopDetailsSection
              metrics={m}
              solve={solve}
              onSeekToMove={seekToMove}
            />
          )}
          {m.roux && <RouxDetailsSection metrics={m} />}

          {/* ── Rotations & efficiency ──────────────────────────────────── */}
          <RotEfficiencySection metrics={m} />
        </>
      )}
    </div>
  );
}

// ─── Timeline section ──────────────────────────────────────────────────────

function TimelineSection({
  timeline,
  meanTps,
  hoveredPhase,
  onHoverPhase,
  replayPositionMs,
  replayMoveIdx,
  pairSegments,
  onSeekToMove,
}: {
  timeline: TimelineData;
  meanTps: number;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
  /** Animated replay playhead position (ms), null when not replaying. */
  replayPositionMs?: number | null;
  /** Replay move index (aligned with moveTicks) for the playhead. */
  replayMoveIdx?: number | null;
  /** F2L pairs as timeline sub-segments, painted as a lane under the blocks. */
  pairSegments?: PairSegment[];
  /** Clicking a pair seeks the 3D replay to its first move. */
  onSeekToMove?: (moveIndex: number) => void;
}) {
  const { t } = useTranslation("insights");
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const { totalMs, moveTicks, moveVisualMs, tpsSamples, segments, pauseMarks } = timeline;
  const width = 600; // viewBox width; scales to container via preserveAspectRatio

  // ── F2L pairs sub-divide the F2L phase bar ITSELF ───────────────────────
  // No separate lane: when pair data exists, the green F2L block renders as
  // one colored slice per pair (light → dark green), each with its own hover
  // card above the bar and click-to-seek.
  const hasPairs = (pairSegments?.length ?? 0) > 0;
  const PAIR_COLORS = ["#86EFAC", "#4ADE80", "#22C55E", "#15803D"];
  const pairColor = (pairNumber: number) =>
    PAIR_COLORS[(pairNumber - 1) % PAIR_COLORS.length];

  // TPS scale: data-driven ceiling rounded up to a sensible tick.
  const maxTps = useMemo(() => {
    const max = Math.max(...tpsSamples.map((s) => s.tps), 0);
    if (max <= 0) return 5;
    // Round up to the next whole number with a little headroom (no arbitrary +1 floor).
    return Math.max(Math.ceil(max + 0.5), 3);
  }, [tpsSamples]);

  const xForMs = useCallback(
    (ms: number) => (totalMs > 0 ? (ms / totalMs) * width : 0),
    [totalMs, width],
  );

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || totalMs <= 0) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const ms = Math.max(0, Math.min(totalMs, ratio * totalMs));
      setHoverMs(ms);
    },
    [totalMs],
  );

  const handleLeave = useCallback(() => {
    setHoverMs(null);
  }, []);

  // Replay playhead x-position. The replay clock is MOVE-DRIVEN (its ms are
  // virtual, independent of solve.time), so anchor the playhead to the
  // CURRENT MOVE's visual tick instead — that keeps it perfectly aligned
  // with the phase/pause segments while every move plays back.
  const replayX = useMemo(() => {
    if (replayPositionMs == null) return null;
    // Only anchor to move ticks when the timeline actually has segments
    // (phaseRuns existed) — otherwise moveVisualMs is all zeros and the
    // playhead would be pinned to x=0.
    if (
      segments.length > 0 &&
      replayMoveIdx != null &&
      replayMoveIdx >= 0 &&
      replayMoveIdx < moveVisualMs.length
    ) {
      return xForMs(moveVisualMs[replayMoveIdx]);
    }
    return xForMs(replayPositionMs);
  }, [replayPositionMs, replayMoveIdx, moveVisualMs, segments, xForMs]);

  // TPS area path — always closes at the right edge (totalMs).
  const tpsPath = useMemo(() => {
    if (tpsSamples.length < 2) return "";
    return tpsSamples
      .map((s, i) => {
        const x = xForMs(s.offsetMs);
        const y = TPS_AREA_BOTTOM - (s.tps / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [tpsSamples, xForMs, maxTps]);

  const tpsAreaPath = useMemo(() => {
    if (tpsPath === "") return "";
    const lastX = xForMs(tpsSamples[tpsSamples.length - 1]?.offsetMs ?? totalMs);
    return `${tpsPath} L${lastX.toFixed(1)},${TPS_AREA_BOTTOM} L0,${TPS_AREA_BOTTOM} Z`;
  }, [tpsPath, tpsSamples, xForMs, totalMs]);

  // Total pause time for the eyebrow.
  const totalPauseMs = useMemo(
    () => pauseMarks.reduce((s, p) => s + p.durationMs, 0),
    [pauseMarks],
  );
  const meanPauseMs = pauseMarks.length > 0 ? totalPauseMs / pauseMarks.length : 0;

  // P1.c — Y-axis TPS ticks (0 … maxTps)
  const yTickCount = 4;
  const yTicks = useMemo(
    () => Array.from({ length: yTickCount }, (_, i) => (i / (yTickCount - 1)) * maxTps),
    [maxTps],
  );
  // P1.a — X-axis tick fractions (0/25/50/75/100%)
  const xTickFracs = [0, 0.25, 0.5, 0.75, 1];
  // P1.c — Mean TPS reference line y-position (clamped to the TPS band)
  const meanTpsY =
    TPS_AREA_BOTTOM - (Math.min(meanTps, maxTps) / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
  // Y-axis label column width (px). Just needs to fit "tps" and the tick
  // numbers (avg is only shown in the legend below). The X-axis label row uses
  // the same constant for its left margin, so changing it keeps axes aligned.
  const Y_LABEL_W = 36;

  // P1.d — Segment highlight state for cross-highlight
  const segHighlight = (seg: TimelineSegment): "active" | "dim" | "normal" => {
    if (hoveredPhase === null) return "normal";
    return seg.phaseName === hoveredPhase ? "active" : "dim";
  };

  // The pipeline emits English display strings for pause categories and
  // probable causes — map them to the active language here.
  const categoryLabel = (cat: string): string => {
    switch (cat) {
      case "transition":
        return t("analysis.pauseCatTransition");
      case "pre-algorithm":
        return t("analysis.pauseCatPreAlgorithm");
      case "mid-phase":
        return t("analysis.pauseCatMidPhase");
      default:
        return cat;
    }
  };

  const pauseCauseLabel = (seg: TimelineSegment): string => {
    const cause = seg.probableCause ?? seg.label ?? "";
    switch (cause) {
      case "OLL recognition":
        return t("analysis.pauseCauseOllRecog");
      case "PLL recognition":
        return t("analysis.pauseCausePllRecog");
      case "CMLL recognition":
        return t("analysis.pauseCauseCmllRecog");
      case "LSE recognition":
        return t("analysis.pauseCauseLseRecog");
      case "F2L pair recognition":
        return t("analysis.pauseCauseF2lPair");
      case "Cross piece search":
        return t("analysis.pauseCauseCrossSearch");
      case "Block building search":
        return t("analysis.pauseCauseBlockSearch");
      case "Edge orientation":
        return t("analysis.pauseCauseEdgeOrientation");
      default: {
        const transition = cause.match(/^(.*) → (.*) transition$/);
        if (transition) {
          return t("analysis.pauseCauseTransition", {
            from: transition[1],
            to: transition[2],
          });
        }
        if (cause.endsWith(" transition")) {
          return t("analysis.pauseCauseTransitionSingle", {
            phase: cause.slice(0, -" transition".length),
          });
        }
        if (cause.endsWith(" algorithm recognition")) {
          return t("analysis.pauseCauseAlgRecog", {
            phase: cause.slice(0, -" algorithm recognition".length),
          });
        }
        if (cause.endsWith(" hesitation")) {
          return t("analysis.pauseCauseHesitation", {
            phase: cause.slice(0, -" hesitation".length),
          });
        }
        return cause;
      }
    }
  };

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader
        title={t("analysis.timeline")}
        eyebrow={
          totalPauseMs > 0
            ? t("analysis.timelineEyebrowPaused", {
              moves: moveTicks.length,
              total: formatTime(totalMs),
              paused: formatTime(totalPauseMs),
            })
            : t("analysis.timelineEyebrow", {
              moves: moveTicks.length,
              total: formatTime(totalMs),
            })
        }
      />

      <div className="mt-3">
        {/* Chart row: Y-labels column + SVG + pause overlays */}
        <div className="flex items-stretch gap-1">
          {/* P1.c — Y-axis TPS labels (HTML, not stretched by SVG) */}
          <div className="relative shrink-0" style={{ width: Y_LABEL_W, height: TIMELINE_HEIGHT }}>
            {yTicks.map((t, i) => {
              const y = TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP);
              return (
                <span
                  key={`yt-${i}`}
                  className="absolute right-0 nums text-[0.6rem] leading-none text-ink-3"
                  style={{ top: y, transform: "translateY(-50%)" }}
                >
                  {t.toFixed(0)}
                </span>
              );
            })}
            <span className="absolute left-0 whitespace-nowrap text-[0.6rem] uppercase tracking-wider text-ink-3/50 leading-none"
              style={{ top: 0, lineHeight: 1 }}
            >
              tps
            </span>
          </div>

          {/* SVG + pause popover overlays */}
          <div
            ref={containerRef}
            className="relative flex-1"
            style={{ height: TIMELINE_HEIGHT }}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
          >
            <svg
              width="100%"
              height={TIMELINE_HEIGHT}
              viewBox={`0 0 ${width} ${TIMELINE_HEIGHT}`}
              preserveAspectRatio="none"
              className="overflow-visible pointer-events-none"
              role="img"
              aria-label={t("analysis.timelineAria", {
                count: segments.length,
                time: formatTime(totalMs),
              })}
            >
              <defs>
                <linearGradient id="timeline-tps-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ink-2)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--ink-2)" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* P1.a — Vertical gridlines at 0/25/50/75/100% */}
              {xTickFracs.map((f, i) => (
                <line
                  key={`gx-${i}`}
                  x1={f * width}
                  y1={TPS_AREA_TOP}
                  x2={f * width}
                  y2={SEG_BOTTOM}
                  stroke="var(--ink-3)"
                  strokeWidth={0.5}
                  strokeOpacity={0.15}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* P1.c — Horizontal TPS gridlines */}
              {yTicks.map((t, i) => (
                <line
                  key={`gy-${i}`}
                  x1={0}
                  y1={TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP)}
                  x2={width}
                  y2={TPS_AREA_BOTTOM - (t / maxTps) * (TPS_AREA_BOTTOM - TPS_AREA_TOP)}
                  stroke="var(--ink-3)"
                  strokeWidth={0.5}
                  strokeOpacity={0.1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* TPS area fill */}
              {tpsAreaPath && <path d={tpsAreaPath} fill="url(#timeline-tps-fill)" />}
              {/* TPS line */}
              {tpsPath && (
                <path
                  d={tpsPath}
                  fill="none"
                  stroke="var(--ink-2)"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* P1.c — Mean TPS dashed reference line */}
              {meanTps > 0 && (
                <line
                  x1={0}
                  y1={meanTpsY}
                  x2={width}
                  y2={meanTpsY}
                  stroke="var(--ready)"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Unified segment blocks — sharp rectangles, no rounded corners,
                  no colored borders, clean cross-highlight via opacity only.
                  The F2L block itself is sub-divided into its pairs (one
                  light→dark green slice per pair) when pair data exists. */}
              {segments.map((seg, i) => {
                const x = xForMs(seg.startMs);
                const w = Math.max(0.5, xForMs(seg.endMs) - x);
                const isPause = seg.kind === "pause";
                const color = isPause
                  ? pauseColorHex(seg.pauseCategory ?? "mid-phase")
                  : phaseColorHex(seg.phaseName ?? "", i);
                const hl = segHighlight(seg);
                const fillOpacity = isPause
                  ? hl === "dim" ? 0.18 : hl === "active" ? 0.65 : 0.40
                  : hl === "dim" ? 0.12 : hl === "active" ? 0.55 : 0.30;
                const isF2L =
                  !isPause && seg.phaseName === "F2L" && hasPairs;

                if (isF2L) {
                  const pairCount = pairSegments!.length;
                  return pairSegments!.map((pseg) => {
                    // Clip each pair to the F2L bar's own range.
                    const px = Math.max(x, xForMs(pseg.startMs));
                    const pend = Math.min(x + w, xForMs(pseg.endMs));
                    const pw = Math.max(1, pend - px);
                    // Solid slices + a real gap + outline so the four greens
                    // read as a CLEAR division (phase blocks stay translucent).
                    const gap = pairCount > 1 ? 2 : 0;
                    const sliceW = Math.max(1, pw - gap);
                    const sliceOpacity =
                      hl === "dim" ? 0.3 : hl === "active" ? 0.95 : 0.85;
                    const labelVisible = sliceW > 26;
                    return (
                      <g key={`f2l-pair-${pseg.pairNumber}`}>
                        <rect
                          x={px}
                          y={SEG_TOP}
                          width={sliceW}
                          height={SEG_BOTTOM - SEG_TOP}
                          fill={pairColor(pseg.pairNumber)}
                          fillOpacity={sliceOpacity}
                          stroke="var(--ink)"
                          strokeOpacity={0.18}
                          strokeWidth={0.6}
                          vectorEffect="non-scaling-stroke"
                        />
                        {labelVisible && (
                          <text
                            x={px + sliceW / 2}
                            y={(SEG_TOP + SEG_BOTTOM) / 2 + 3}
                            textAnchor="middle"
                            fontSize={8.5}
                            fontWeight={700}
                            fill="#fff"
                            stroke="rgba(0,0,0,0.4)"
                            strokeWidth={2.5}
                            paintOrder="stroke"
                            pointerEvents="none"
                            className="select-none"
                          >
                            {pseg.slot ?? `P${pseg.pairNumber}`}
                          </text>
                        )}
                      </g>
                    );
                  });
                }

                return (
                  <rect
                    key={`${seg.kind}-${i}`}
                    x={x}
                    y={SEG_TOP}
                    width={w}
                    height={SEG_BOTTOM - SEG_TOP}
                    fill={color}
                    fillOpacity={fillOpacity}
                  />
                );
              })}

              {/* Move ticks — positioned using visual coords (aligned with segments) */}
              {moveVisualMs.map((visMs, i) => (
                <line
                  key={moveTicks[i].index}
                  x1={xForMs(visMs)}
                  y1={TPS_AREA_BOTTOM + 1}
                  x2={xForMs(visMs)}
                  y2={SEG_TOP - 2}
                  stroke="var(--ink-3)"
                  strokeWidth={0.6}
                  strokeOpacity={0.3}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Hover playhead */}
              {hoverMs !== null && (
                <line
                  x1={xForMs(hoverMs)}
                  y1={TPS_AREA_TOP}
                  x2={xForMs(hoverMs)}
                  y2={SEG_BOTTOM}
                  stroke="var(--ink)"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Replay playhead — centered on segment blocks (does not extend into TPS area) */}
              {replayX !== null && (
                <>
                  {/* Tail: subtle fill behind the playhead */}
                  <rect
                    x={0}
                    y={SEG_TOP}
                    width={replayX}
                    height={SEG_BOTTOM - SEG_TOP}
                    fill="#4F8CF7"
                    fillOpacity={0.08}
                  />
                  <line
                    x1={replayX}
                    y1={SEG_TOP}
                    x2={replayX}
                    y2={SEG_BOTTOM}
                    stroke="#4F8CF7"
                    strokeWidth={1.5}
                    strokeOpacity={0.85}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>



            {/* P1.b — Pause popover triggers: invisible divs over each pause block */}
            {totalMs > 0 &&
              segments
                .filter((s) => s.kind === "pause")
                .map((seg, i) => {
                  const leftPct = (seg.startMs / totalMs) * 100;
                  const widthPct = (seg.durationMs / totalMs) * 100;
                  const topPct = (SEG_TOP / TIMELINE_HEIGHT) * 100;
                  const heightPct = ((SEG_BOTTOM - SEG_TOP) / TIMELINE_HEIGHT) * 100;
                  // Adjacent moves for the popover
                  const startIdx = seg.moveStartIndex ?? 0;
                  const endIdx = seg.moveEndIndex ?? 0;
                  const before = [-2, -1]
                    .map((d) => startIdx + d)
                    .filter((j) => j >= 0)
                    .map((j) => moveTicks[j])
                    .filter(Boolean);
                  const after = [1, 2]
                    .map((d) => endIdx + d)
                    .filter((j) => j < moveTicks.length)
                    .map((j) => moveTicks[j])
                    .filter(Boolean);
                  const category = seg.pauseCategory ?? "mid-phase";
                  const catColor = pauseColorHex(category);
                  const vsMean =
                    meanPauseMs > 0 ? ((seg.durationMs - meanPauseMs) / meanPauseMs) * 100 : 0;

                  return (
                    <HoverCard key={`pause-${i}`} openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div
                          className="absolute cursor-help"
                          style={{
                            left: `${leftPct}%`,
                            width: `max(${widthPct}%, 6px)`,
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            minHeight: 10,
                          }}
                          onMouseEnter={() => onHoverPhase(seg.phaseName ?? null)}
                          onMouseLeave={() => onHoverPhase(null)}
                        />
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="w-72 p-3 text-xs"
                      >
                        {/* Cause */}
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-sm"
                            style={{ background: catColor }}
                          />
                          <span className="font-medium text-ink">{pauseCauseLabel(seg)}</span>
                        </div>
                        {/* Category badge + phase */}
                        <div className="mt-1.5 flex items-center gap-2 text-[0.6rem] text-ink-3">
                          <span
                            className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
                            style={{ background: `${catColor}22`, color: catColor }}
                          >
                            {categoryLabel(category)}
                          </span>
                          <span className="uppercase tracking-wide">{seg.phaseName}</span>
                        </div>
                        {/* Duration + comparison vs avg */}
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="nums text-base font-medium text-ink">
                            {formatTime(seg.durationMs)}
                          </span>
                          {meanPauseMs > 0 && (
                            <span
                              className={cn(
                                "nums text-[0.6rem] font-medium",
                                vsMean > 20
                                  ? "text-dnf"
                                  : vsMean < -20
                                    ? "text-ready"
                                    : "text-ink-3",
                              )}
                            >
                              {vsMean > 0 ? "+" : ""}
                              {t("analysis.vsAvg", { pct: Math.round(vsMean) })}
                            </span>
                          )}
                        </div>
                        {/* Adjacent moves */}
                        {(before.length > 0 || after.length > 0) && (
                          <div className="mt-2 border-t border-line/40 pt-2">
                            <span className="text-[0.6rem] uppercase tracking-wide text-ink-3">
                              {t("analysis.adjacentMoves")}
                            </span>
                            <div className="mt-1 flex items-center gap-1 font-mono text-[0.65rem]">
                              {before.map((m, j) => (
                                <span key={`b-${j}`} className="text-ink-3">
                                  {m.label}
                                </span>
                              ))}
                              <span className="text-dnf">‖</span>
                              {after.map((m, j) => (
                                <span key={`a-${j}`} className="font-medium text-ink-2">
                                  {m.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
            {/* Phase hover popover triggers: invisible divs over each phase block.
                The F2L block gets per-pair triggers instead (below). */}
            {totalMs > 0 &&
              segments
                .filter(
                  (s) =>
                    s.kind === "phase" &&
                    !(s.phaseName === "F2L" && hasPairs),
                )
                .map((seg, i) => {
                  const leftPct = (seg.startMs / totalMs) * 100;
                  const widthPct = (seg.durationMs / totalMs) * 100;
                  const topPct = (SEG_TOP / TIMELINE_HEIGHT) * 100;
                  const heightPct = ((SEG_BOTTOM - SEG_TOP) / TIMELINE_HEIGHT) * 100;
                  const color = phaseColorHex(seg.phaseName ?? "", i);
                  // Compute TPS and move count for this phase segment
                  const moveCount = moveTicks.filter(
                    (t) => t.phaseName === seg.phaseName &&
                      t.offsetMs >= seg.startMs &&
                      t.offsetMs <= seg.endMs
                  ).length;
                  const phaseTps = moveCount > 0 && seg.durationMs > 0
                    ? (moveCount / seg.durationMs) * 1000
                    : 0;

                  return (
                    <HoverCard key={`phase-${i}`} openDelay={200} closeDelay={150}>
                      <HoverCardTrigger asChild>
                        <div
                          className="absolute cursor-pointer"
                          style={{
                            left: `${leftPct}%`,
                            width: `max(${widthPct}%, 4px)`,
                            top: `${topPct}%`,
                            height: `${heightPct}%`,
                            minHeight: 10,
                          }}
                          onMouseEnter={() => onHoverPhase(seg.phaseName ?? null)}
                          onMouseLeave={() => onHoverPhase(null)}
                        />
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="w-56 p-3 text-xs"
                      >
                        {/* Phase name */}
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-sm"
                            style={{ background: color }}
                          />
                          <span className="font-medium text-ink">{seg.phaseName}</span>
                        </div>
                        {/* Stats */}
                        <div className="mt-2 flex items-baseline gap-3">
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              {t("analysis.phaseTime")}
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {formatTime(seg.durationMs)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              {t("analysis.phaseMoves")}
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {moveCount}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              TPS
                            </span>
                            <span className="nums text-base font-medium text-ink">
                              {phaseTps.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Duration fraction */}
                        <div className="mt-1.5 text-[0.6rem] text-ink-3">
                          {t("analysis.pctOfSolve", {
                            pct: Math.round((seg.durationMs / totalMs) * 100),
                          })}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}

            {/* F2L pair overlays — one invisible trigger per pair over the
                divided F2L bar: hover card ABOVE the bar + click-to-seek */}
            {hasPairs &&
              totalMs > 0 &&
              pairSegments!.map((seg) => {
                const leftPct = (seg.startMs / totalMs) * 100;
                const widthPct = (seg.durationMs / totalMs) * 100;
                const topPct = (SEG_TOP / TIMELINE_HEIGHT) * 100;
                const heightPct = ((SEG_BOTTOM - SEG_TOP) / TIMELINE_HEIGHT) * 100;
                const color = pairColor(seg.pairNumber);
                const seekable = !!onSeekToMove && seg.moveStartIndex >= 0;

                return (
                  <HoverCard key={`pair-${seg.pairNumber}`} openDelay={200} closeDelay={150}>
                    <HoverCardTrigger asChild>
                      <div
                        className={cn("absolute", seekable && "cursor-pointer")}
                        style={{
                          left: `${leftPct}%`,
                          width: `max(${widthPct}%, 8px)`,
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          minHeight: 10,
                        }}
                        role={seekable ? "button" : undefined}
                        tabIndex={seekable ? 0 : undefined}
                        onClick={
                          seekable
                            ? () => onSeekToMove!(seg.moveStartIndex)
                            : undefined
                        }
                        onKeyDown={
                          seekable
                            ? (e: React.KeyboardEvent<HTMLDivElement>) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSeekToMove!(seg.moveStartIndex);
                                }
                              }
                            : undefined
                        }
                        title={seekable ? t("analysis.pairSeekHint") : undefined}
                      />
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="top"
                      align="start"
                      sideOffset={4}
                      className="w-64 p-3 text-xs"
                    >
                      {/* Pair identity */}
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-sm"
                          style={{ background: color }}
                        />
                        <span className="font-medium text-ink">
                          {t("analysis.pair", { number: seg.pairNumber })}
                        </span>
                        {seg.slot && (
                          <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.58rem] font-medium text-ink-2">
                            {seg.slot}
                          </span>
                        )}
                      </div>
                      {/* Detected case */}
                      {seg.caseName && (
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="text-[0.74rem] font-medium text-ink-2">
                            {seg.caseName}
                          </span>
                          {seg.caseNumber && (
                            <span className="font-mono text-[0.58rem] text-ink-3">
                              {seg.caseNumber}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Stats */}
                      <div className="mt-2 flex items-baseline gap-3">
                        <div className="flex flex-col">
                          <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                            {t("analysis.phaseTime")}
                          </span>
                          <span className="nums text-base font-medium text-ink">
                            {formatTime(seg.durationMs)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                            {t("analysis.phaseMoves")}
                          </span>
                          <span className="nums text-base font-medium text-ink">
                            {seg.moves}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                            TPS
                          </span>
                          <span className="nums text-base font-medium text-ink">
                            {seg.tps.toFixed(1)}
                          </span>
                        </div>
                        {seg.pauseBeforeMs > 50 && (
                          <div className="flex flex-col">
                            <span className="text-[0.6rem] uppercase tracking-wider text-ink-3">
                              {t("analysis.pauseBefore")}
                            </span>
                            <span className="nums text-base font-medium text-caution">
                              {formatTime(seg.pauseBeforeMs)}
                            </span>
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
          </div>
        </div>

        {/* P1.a — X-axis time labels */}
        <div className="relative" style={{ height: 14, marginLeft: Y_LABEL_W + 4 }}>
          {xTickFracs.map((f, i) => (
            <span
              key={`xt-${i}`}
              className="absolute nums text-[0.6rem] leading-none text-ink-3/70"
              style={{
                left: `${f * 100}%`,
                transform:
                  i === 0
                    ? "translateX(0)"
                    : i === xTickFracs.length - 1
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {formatTime(f * totalMs)}
            </span>
          ))}
        </div>


      </div>

      {/* Legend — real labels, grouped: phases / pauses / TPS / avg */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.58rem] text-ink-3">
        {timeline.stageSegments.map((seg, i) => {
          // The F2L legend chip becomes a 4-color strip when the bar is
          // divided into its pairs.
          const isF2LDivided = seg.phaseName === "F2L" && hasPairs;
          return (
            <span key={seg.phaseName} className="flex items-center gap-1.5">
              {isF2LDivided ? (
                <span className="flex gap-0.5">
                  {pairSegments!.map((pseg) => (
                    <span
                      key={pseg.pairNumber}
                      className="inline-block size-2 rounded-[2px]"
                      style={{
                        background: pairColor(pseg.pairNumber),
                        opacity: 0.8,
                      }}
                    />
                  ))}
                </span>
              ) : (
                <span
                  className="inline-block size-2 rounded-sm"
                  style={{
                    background: phaseColorHex(seg.phaseName, i),
                    opacity: 0.7,
                  }}
                />
              )}
              {seg.phaseName}
            </span>
          );
        })}
        {pauseMarks.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-sm"
              style={{
                background: PAUSE_COLOR_BY_CATEGORY["mid-phase"],
                opacity: 0.7,
              }}
            />
            {t("analysis.pausesLegend", {
              count: pauseMarks.length,
              time: formatTime(totalPauseMs),
            })}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ink-2" />
          TPS
        </span>
        {meanTps > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-4 border-t border-dashed"
              style={{ borderColor: "var(--ready)", opacity: 0.6 }}
            />
            {t("analysis.avgLegend", { tps: meanTps.toFixed(1) })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Metric rings section ──────────────────────────────────────────────────

/**
 * Quality score: 0 (worst) → 1 (best).
 *
 * For **lower-is-better** metrics we scale from the optimal value to the max
 * so that optimal = 1.0, max = 0:
 *   quality = (max − value) / (max − optimal)
 *
 * For eff the optimal is 1.0 (moves = optimal); for pauses/pause% it is 0.
 *
 * For **higher-is-better** metrics quality is simply value / max.
 */
function quality(
  value: number,
  max: number,
  lowerIsBetter: boolean,
  optimal = 0,
): number {
  if (max <= 0) return 0;
  const clamped = Math.max(optimal, Math.min(value, max));
  if (lowerIsBetter && max !== optimal) {
    return (max - clamped) / (max - optimal);
  }
  return clamped / max;
}

/**
 * Colour gradient: gray → amber → green.
 * Bad values (q≈0) render as neutral gray so they don't demotivate.
 * Good values (q≈1) render as green.
 *
 *   q=0.00  ◻ gray       hsl(0, 0%, 48%)
 *   q=0.25  ◇ muted amber hsl(40, 27%, 45%)
 *   q=0.50  ◈ amber       hsl(40, 55%, 42%)
 *   q=0.75  ◆ yellow-green hsl(90, 55%, 38%)
 *   q=1.00  ◆ green       hsl(140, 55%, 35%)
 */
function qualityColorHex(q: number): string {
  const clamped = Math.max(0, Math.min(1, q));
  // Saturation ramps up quickly: 0 at q=0 → 55 at q=0.5, stays at 55.
  const sat = Math.round(Math.min(clamped / 0.5, 1) * 55);
  // Lightness: 48% at q=0 → 35% at q=1.0 (denser = more vivid).
  const light = Math.round(48 - clamped * 13);
  // Hue: gray at q=0 (sat=0, hue irrelevant), amber at q≤0.5, green at q=1.
  const hue = clamped <= 0.5
    ? 40   // amber
    : Math.round(40 + (clamped - 0.5) * 2 * 100); // 40 (amber) → 140 (green)
  if (sat === 0) return `hsl(0, 0%, ${light}%)`;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/**
 * Benchmark caps — real-world data from competitive speedcubing.
 *
 *   TPS:       /12 —  12+ = world-class (sub-6)     6+ = good (sub-15)
 *                     3+ = learning                   1–2 = just started
 *   Pauses:    /8  —  0   = world-class (seamless)   1–2 = sub-10 (near seamless)
 *                     3–4 = advanced (brief pauses)  5–6 = intermediate (stop-and-go)
 *                     7+  = beginner (many pauses)
 *   Efficiency /1  —  1.0 = optimal (theoretical shortest solve ~42–52 moves)
 *                     0.8 = very efficient (15 % over optimal)
 *                     0.5 = average efficient (2× optimal, typical intermediate)
 *
 * Efficiency is shown as a 0–1 score just like in engineering (1 = perfect).
 * Internally we store actual÷optimal (always ≥1); we convert to 1÷(actual÷optimal)
 * so the ring and colour behave intuitively.
 */
interface MetricDef {
  /** Value to feed into quality(). */
  value: number;
  max: number;
  label: string;
  sub: string;
  lowerIsBetter: boolean;
  optimal?: number;
}

function MetricRingsSection({ metrics }: { metrics: SolveMetrics }) {
  const { t } = useTranslation("insights");
  const rings: MetricDef[] = [
    {
      value: metrics.tps.global,
      max: 12,
      label: metrics.tps.global.toFixed(1),
      sub: "TPS",
      lowerIsBetter: false,
    },
    {
      value: metrics.pauses.totalCount,
      max: 8,
      label: `${metrics.pauses.totalCount}`,
      sub: t("analysis.pauses"),
      lowerIsBetter: true,
    },
  ];

  // Efficiency on a 0-1 scale where 1 = optimal (moveEfficiencyRatio = 1.0).
  // The ring fills to the efficiency value directly, higher = better.
  const efficiency = metrics.efficiency ?? EMPTY_EFFICIENCY;
  if (efficiency.moveEfficiencyRatio > 0) {
    const effScore = Math.min(1, 1 / efficiency.moveEfficiencyRatio);
    rings.push({
      value: effScore,
      max: 1,
      label: `${Math.round(effScore * 100)}%`,
      sub: t("analysis.efficiency"),
      lowerIsBetter: false,
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title={t("analysis.keyMetrics")} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-6">
        {rings.map((r) => {
          const q = quality(r.value, r.max, r.lowerIsBetter, r.optimal);
          return (
            <MetricRing
              key={r.sub}
              value={q * r.max}
              max={r.max}
              label={r.label}
              sub={r.sub}
              size={80}
              strokeWidth={4}
              strokeColor={qualityColorHex(q)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Phase breakdown ───────────────────────────────────────────────────────

function PhaseBreakdownSection({
  metrics,
  solveTimeMs,
  hoveredPhase,
  onHoverPhase,
}: {
  metrics: SolveMetrics;
  solveTimeMs: number;
  hoveredPhase: string | null;
  onHoverPhase: (phase: string | null) => void;
}) {
  const { t } = useTranslation("insights");
  // Sum of all phase durations (should equal metrics.totalTimeMs minus transition gaps).
  const phaseSumMs = metrics.phases.reduce((s, p) => s + p.durationMs, 0);
  // Transition gaps: time between the last move of one phase and first move of the next.
  const totalGapMs = Math.max(0, solveTimeMs - phaseSumMs);
  const showGap = totalGapMs > 200;

  const colorLabel = (face: string): string => {
    switch (face) {
      case "U":
        return t("analysis.colorWhite");
      case "R":
        return t("analysis.colorRed");
      case "F":
        return t("analysis.colorGreen");
      case "D":
        return t("analysis.colorYellow");
      case "L":
        return t("analysis.colorOrange");
      case "B":
        return t("analysis.colorBlue");
      default:
        return face;
    }
  };

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader
        title={t("analysis.phaseBreakdown")}
        eyebrow={
          showGap
            ? t("analysis.phaseEyebrowGap", {
              count: metrics.phases.length,
              active: formatTime(phaseSumMs),
              gap: formatTime(totalGapMs),
            })
            : t("analysis.phaseEyebrow", {
              count: metrics.phases.length,
              active: formatTime(phaseSumMs),
            })
        }
      />
      <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
        {metrics.phases.map((p, i) => {
          const isHighlighted = hoveredPhase === p.phaseName;
          const isDimmed = hoveredPhase !== null && hoveredPhase !== p.phaseName;
          const color = phaseColorHex(p.phaseName, i);
          const phasePct = phaseSumMs > 0 ? Math.round((p.durationMs / phaseSumMs) * 100) : 0;
          return (
            <div
              key={p.phaseName}
              className="flex items-center justify-between px-3 py-2 text-sm border-b border-line/40 last:border-0 transition-opacity duration-150"
              style={{
                boxShadow: isHighlighted ? `inset 2px 0 0 ${color}` : undefined,
                opacity: isDimmed ? 0.4 : 1,
              }}
              onMouseEnter={() => onHoverPhase(p.phaseName)}
              onMouseLeave={() => onHoverPhase(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-sm"
                  style={{ background: color }}
                />
                <span className="text-xs font-medium uppercase tracking-wide text-ink-2">
                  {p.phaseName}
                </span>
                {/* OLL/PLL skips — same badge the reconstruction panel uses;
                    a skipped phase owns 0 moves and 0 tps, so make it explicit. */}
                {p.skipped && <SkippedBadge className="ml-1" />}
                {p.phaseName === "Cross" &&
                  metrics.detectionReport?.crossColor && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-block size-2.5 rounded-sm ring-1 ring-black/30 cursor-help"
                          style={{ background: FACE_HEX[metrics.detectionReport.crossColor] }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t("analysis.crossTooltip", {
                          color: colorLabel(metrics.detectionReport.crossColor),
                        })}
                      </TooltipContent>
                    </Tooltip>
                  )}
                {p.phaseName === "Cross" &&
                  metrics.detectionReport?.crossType &&
                  metrics.detectionReport.crossType !== "plain" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide cursor-help",
                            metrics.detectionReport.crossType !== "xcross"
                              ? "border border-caution/40 bg-caution/10 text-caution"
                              : "border border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
                          )}
                        >
                          {metrics.detectionReport.crossType === "xxxcross"
                            ? "XXXCross"
                            : metrics.detectionReport.crossType === "xxcross"
                              ? "XXCross"
                              : metrics.detectionReport.crossType === "pseudo xcross"
                                ? "Pseudo XCross"
                                : "XCross"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {metrics.detectionReport.xcrossPairs
                          ?.map((pair) => pair.slot)
                          .join(", ") || t("analysis.xcrossPairSolved")}{" "}
                        {t("analysis.atCrossCompletion")}
                      </TooltipContent>
                    </Tooltip>
                  )}
              </div>
              <div className="flex items-center gap-3 nums text-xs text-ink-3">
                <span>{p.moveCount}m</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{formatTime(p.durationMs)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("analysis.phasePctTooltip", { pct: phasePct })}</TooltipContent>
                </Tooltip>
                <span className="font-medium text-ink">{p.tps.toFixed(1)} tps</span>
                {p.pauseCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-caution/70">{p.pauseCount}p</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t("analysis.pauseInPhase", { count: p.pauseCount })}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Gap explanation: phases only measure within-phase execution time. */}
      {showGap && (
        <p className="mt-2 text-[0.6rem] text-ink-3/60">
          {t("analysis.gapExplanation", {
            total: formatTime(solveTimeMs),
            active: formatTime(phaseSumMs),
            idle: formatTime(totalGapMs),
          })}
        </p>
      )}
    </div>
  );
}

// ─── CFOP details ──────────────────────────────────────────────────────────

function CfopDetailsSection({
  metrics,
  solve,
  onSeekToMove,
}: {
  metrics: SolveMetrics;
  solve: Solve;
  onSeekToMove?: (moveIndex: number) => void;
}) {
  const { t } = useTranslation("insights");
  const cfop = metrics.cfop!;
  const crossType = metrics.detectionReport?.crossType;
  const crossValue =
    crossType === "xcross"
      ? "XCross"
      : crossType === "xxcross"
        ? "XXCross"
        : crossType === "xxxcross"
          ? "XXXCross"
          : crossType === "pseudo xcross"
            ? "Pseudo XCross"
            : crossType === "plain"
              ? t("analysis.crossPlain")
              : "—";
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title={t("analysis.cfopDetails")} />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile
          label="Cross"
          value={crossValue}
          accent={
            crossType === "xxcross" || crossType === "xxxcross"
              ? "amber"
              : crossType === "xcross"
                ? "ready"
                : undefined
          }
        />
        <DetailTile label={t("analysis.crossEff")} value={cfop.crossEfficiency.toFixed(2)} />
        <DetailTile label={t("analysis.crossToF2L")} value={formatTime(cfop.crossToF2LTransitionMs)} />
        <DetailTile label={t("analysis.ollRecog")} value={formatTime(cfop.ollRecognitionMs)} />
        <DetailTile label={t("analysis.ollTps")} value={cfop.ollTPS.toFixed(2)} />
        <DetailTile label={t("analysis.pllRecog")} value={formatTime(cfop.pllRecognitionMs)} />
        <DetailTile label={t("analysis.pllTps")} value={cfop.pllTPS.toFixed(2)} />
        <DetailTile
          label={t("analysis.lookahead")}
          value={cfop.f2lLookaheadScore.toFixed(2)}
          accent={cfop.f2lLookaheadScore > 0.7 ? "ready" : undefined}
        />
        <DetailTile label={t("analysis.f2lPairs")} value={`${cfop.f2lPairs.length}`} />
      </div>

      {/* Professional case table — same shared components as reconstructions */}
      {cfop.f2lPairs.length > 0 && (
        <CaseTable
          metrics={metrics}
          solve={solve}
          onSeekToMove={onSeekToMove}
        />
      )}
    </div>
  );
}

// ─── Professional CFOP case table ──────────────────────────────────────────

/**
 * The same case table as reconstructions (shared `@/components/Cases` cells),
 * adapted to the smart/virtual metric payload: 5 columns (Phase | Case |
 * Moves | Time | TPS) with the real recorded move stream as notation, OLL/PLL
 * diagrams rotated to the solver's AUF, and click-to-seek on every row.
 */
const CASE_GRID_CONTAINER =
  "grid min-w-[34rem] grid-cols-[5.5rem_minmax(6.5rem,max-content)_minmax(0,1fr)_4.25rem_3.25rem] sm:grid-cols-[6.5rem_minmax(7.5rem,max-content)_minmax(0,1fr)_4.75rem_3.5rem]";
const CASE_ROW_GRID = "grid grid-cols-subgrid col-span-5";

function CaseTable({
  metrics,
  solve,
  onSeekToMove,
}: {
  metrics: SolveMetrics;
  solve: Solve;
  onSeekToMove?: (moveIndex: number) => void;
}) {
  const { t } = useTranslation("insights");
  const cfop = metrics.cfop!;
  const report = metrics.detectionReport;
  const crossColor = report?.crossColor;
  const crossType = report?.crossType;
  const skips = report?.skips ?? [];
  const crossPhase = metrics.phases.find((p) => p.phaseName === "Cross");
  const ollPhase = metrics.phases.find((p) => p.phaseName === "OLL");
  const pllPhase = metrics.phases.find((p) => p.phaseName === "PLL");

  const casesByNumber = useMemo(() => {
    const m = new Map<string, AlgorithmCase>();
    for (const c of getSeedData().cases) {
      if (!m.has(c.caseNumber)) m.set(c.caseNumber, c);
      if (c.name && !m.has(c.name)) m.set(c.name, c);
    }
    return m;
  }, []);

  // ── Notation from the recorded move stream ────────────────────────────
  // Smart/virtual pairs don't persist per-pair notation; rebuild it from
  // solve.moves using the pair's shared timeline boundaries (completionIndex
  // − moves + 1). Face turns map 1:1 to timeline entries; wide moves expand
  // to two state entries, so those slices fall back to "—" when off-range.
  const notationOf = useCallback(
    (from: number, to: number): string[] | null => {
      const src = solve.moves ?? [];
      if (from < 0 || to < from || to >= src.length) return null;
      return src.slice(from, to + 1).map((mv) => {
        const suffix = mv.direction === 2 ? "2" : mv.direction === -1 ? "'" : "";
        return `${mv.face}${suffix}`;
      });
    },
    [solve.moves],
  );

  // Cumulative move windows (entry indices) across the solve.
  const crossTo = cfop.crossMoves - 1;
  const crossNotation = notationOf(0, crossTo);
  const pairs = cfop.f2lPairs.map((p) => {
    const completion = p.completionIndex ?? -1;
    const from =
      completion >= 0 ? completion - Math.max(0, p.moves) + 1 : -1;
    return { pair: p, from, notation: notationOf(from, completion) };
  });
  const lastPairEnd =
    pairs.length > 0
      ? Math.max(...pairs.map((x) => x.pair.completionIndex ?? -1))
      : crossTo;
  const ollStart = lastPairEnd + 1;
  const ollTo = ollStart + (ollPhase?.moveCount ?? 0) - 1;
  const ollNotation = notationOf(ollStart, ollTo);
  const pllStart = ollTo + 1;
  const pllTo = pllStart + (pllPhase?.moveCount ?? 0) - 1;
  const pllNotation = notationOf(pllStart, pllTo);

  const f2lMoves = pairs.reduce((n, x) => n + x.pair.moves, 0);
  const f2lAvg = pairs.length > 0 ? (f2lMoves / pairs.length).toFixed(1) : null;
  const slowest = Math.max(...cfop.f2lPairs.map((p) => p.timeMs));

  // Clicking a row seeks the 3D replay to the state right BEFORE that
  // phase's first move (same convention as the reconstruction table).
  const seekRowProps = (moveIndex: number) =>
    onSeekToMove
      ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => onSeekToMove(moveIndex),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSeekToMove(moveIndex);
          }
        },
      }
      : {};
  const seekCls = onSeekToMove ? "cursor-pointer" : "";

  return (
    <div className="mt-3">
      <div className="overflow-x-auto overflow-y-hidden min-w-0 scrollbar-thin">
        <div className={CASE_GRID_CONTAINER}>
          {/* Column headers */}
          <div
            className={cn(
              CASE_ROW_GRID,
              "items-center gap-2 border-b border-line bg-surface-2/60 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[0.56rem] sm:text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3",
            )}
          >
            <span className="whitespace-nowrap">{t("analysis.colPhase")}</span>
            <span className="whitespace-nowrap">{t("analysis.colCase")}</span>
            <span className="whitespace-nowrap">{t("analysis.colMoves")}</span>
            <span className="text-right whitespace-nowrap">{t("analysis.colTime")}</span>
            <span className="text-right whitespace-nowrap">TPS</span>
          </div>

          {/* ── Cross row ── */}
          <div className={cn(CASE_ROW_GRID, ROW, ROW_LINE, seekCls)} {...seekRowProps(-1)}>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.74rem] font-medium text-ink">Cross</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {crossType && crossType !== "plain" && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide",
                      crossType !== "xcross"
                        ? "border border-caution/40 bg-caution/10 text-caution"
                        : "border border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
                    )}
                  >
                    {crossType}
                  </span>
                )}
                {crossColor && <FaceChip face={crossColor} />}
              </span>
            </span>
            <span className="text-[0.64rem] text-ink-3/50">—</span>
            <MovesSeq tokens={crossNotation} />
            <span className="nums text-right text-xs text-ink-3">
              {crossPhase ? formatTime(crossPhase.durationMs) : "—"}
            </span>
            <span className="nums text-right text-xs font-medium text-ink">
              {cfop.crossTPS.toFixed(1)}
            </span>
          </div>

          {/* ── F2L pair rows ── */}
          {pairs.map(({ pair, from, notation }) => {
            const isSlowest = pair.timeMs === slowest;
            const [leftColor, rightColor] =
              pair.colors && pair.colors.length === 2
                ? orderPairColors(pair.colors[0], pair.colors[1], crossColor ?? undefined)
                : [undefined, undefined];
            const stickerColors =
              crossColor && leftColor && rightColor
                ? pairStickerColors(crossColor, leftColor, rightColor)
                : null;
            const auf =
              pair.auf && pair.auf.length > 0
                ? pair.auf
                : leadingU(notation ?? []);
            const seekIdx = from > 0 ? from - 1 : -1;

            return (
              <div
                key={pair.pairNumber}
                className={cn(
                  CASE_ROW_GRID,
                  ROW,
                  ROW_LINE,
                  seekCls,
                  isSlowest && "bg-caution/5",
                )}
                {...seekRowProps(seekIdx)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[0.74rem] font-medium text-ink">
                      {t("analysis.pair", { number: pair.pairNumber })}
                    </span>
                    {isSlowest && (
                      <span className="text-[0.56rem] uppercase tracking-wider text-caution font-medium">
                        {t("analysis.slowest")}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {pair.slotId ? (
                      <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.56rem] font-medium text-ink-2">
                        {pair.slotId}
                      </span>
                    ) : (
                      <span className="text-[0.64rem] text-ink-3">
                        {t("analysis.noPairSegmentation")}
                      </span>
                    )}
                    {leftColor && <FaceChip face={leftColor} />}
                    {rightColor && <FaceChip face={rightColor} />}
                  </span>
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  {pair.detectedCase &&
                    (() => {
                      const caseData =
                        casesByNumber.get(pair.detectedCase!.caseNumber) ??
                        casesByNumber.get(pair.detectedCase!.caseName);
                      if (!caseData) return null;
                      return (
                        <>
                          <CaseMiniCube
                            caseData={caseData}
                            slotIndex={0}
                            stickerColors={stickerColors}
                            alt={pair.detectedCase!.caseName}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[0.74rem] font-medium text-ink truncate">
                              {pair.detectedCase!.caseName}
                            </span>
                            <span className="mt-0.5 text-[0.56rem] text-ink-3 font-mono">
                              {pair.detectedCase!.caseNumber}
                            </span>
                          </span>
                        </>
                      );
                    })()}
                  {!pair.detectedCase && (
                    <span className="text-[0.64rem] text-ink-3/50">—</span>
                  )}
                </span>

                <MovesSeq
                  tokens={notation}
                  aufMoves={auf.length > 0 ? auf : undefined}
                />
                <span className="nums text-right text-xs text-ink-3">
                  {formatTime(pair.timeMs)}
                  {pair.pauseBeforeMs > 50 && (
                    <span className="ml-1 text-caution/70">
                      +{formatTime(pair.pauseBeforeMs)}
                    </span>
                  )}
                </span>
                <span className="nums text-right text-xs font-medium text-ink">
                  {pair.tps.toFixed(1)}
                </span>
              </div>
            );
          })}

          {/* ── OLL row ── */}
          {(ollPhase || cfop.ollCase) && (
            <div
              className={cn(CASE_ROW_GRID, ROW, ROW_LINE, seekCls)}
              {...seekRowProps(lastPairEnd)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.74rem] font-medium text-ink">OLL</span>
                {skips.includes("oll") && <SkippedBadge className="mt-0.5 w-fit" />}
              </span>
              {cfop.ollCase ? (
                <LastLayerCaseCell
                  detectedCase={cfop.ollCase}
                  casesByNumber={casesByNumber}
                />
              ) : (
                <span className="text-[0.64rem] text-ink-3/50">—</span>
              )}
              <MovesSeq tokens={ollNotation} />
              <span className="nums text-right text-xs text-ink-3">
                {ollPhase ? formatTime(ollPhase.durationMs) : "—"}
              </span>
              <span className="nums text-right text-xs font-medium text-ink">
                {cfop.ollTPS.toFixed(1)}
              </span>
            </div>
          )}

          {/* ── PLL row ── */}
          {(pllPhase || cfop.pllCase) && (
            <div
              className={cn(CASE_ROW_GRID, ROW, seekCls)}
              {...seekRowProps(ollTo)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.74rem] font-medium text-ink">PLL</span>
                {skips.includes("pll") && <SkippedBadge className="mt-0.5 w-fit" />}
              </span>
              {cfop.pllCase ? (
                <LastLayerCaseCell
                  detectedCase={cfop.pllCase}
                  casesByNumber={casesByNumber}
                />
              ) : (
                <span className="text-[0.64rem] text-ink-3/50">—</span>
              )}
              <MovesSeq tokens={pllNotation} />
              <span className="nums text-right text-xs text-ink-3">
                {pllPhase ? formatTime(pllPhase.durationMs) : "—"}
              </span>
              <span className="nums text-right text-xs font-medium text-ink">
                {cfop.pllTPS.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-surface-2/60 px-3 py-1.5 text-[0.58rem] sm:text-[0.6rem] text-ink-3 border-t border-line/60">
        <span className="flex items-center gap-2.5">
          <CfopMiniBar
            crossMoves={cfop.crossMoves}
            f2lMoves={f2lMoves}
            ollMoves={ollPhase?.moveCount ?? 0}
            pllMoves={pllPhase?.moveCount ?? 0}
            totalMoves={metrics.totalMoves}
          />
          {f2lAvg && (
            <span className="nums text-ink-2 font-mono">
              {t("analysis.f2lAvg", { avg: f2lAvg })}
            </span>
          )}
        </span>
        {onSeekToMove && (
          <span className="text-[0.56rem] text-ink-3/70">
            {t("analysis.seekHint")}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Roux details ──────────────────────────────────────────────────────────

function RouxDetailsSection({ metrics }: { metrics: SolveMetrics }) {
  const { t } = useTranslation("insights");
  const roux = metrics.roux!;
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title={t("analysis.rouxDetails")} />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile label={t("analysis.fbEff")} value={roux.firstBlockEfficiency.toFixed(2)} />
        <DetailTile label="FB TPS" value={roux.firstBlockTPS.toFixed(2)} />
        <DetailTile label="SB TPS" value={roux.secondBlockTPS.toFixed(2)} />
        <DetailTile label={t("analysis.cmllRecog")} value={formatTime(roux.cmllRecognitionMs)} />
        <DetailTile label="CMLL TPS" value={roux.cmllTPS.toFixed(2)} />
        <DetailTile label="LSE-EO" value={formatTime(roux.lseEOTimeMs)} />
        <DetailTile label="LSE-UL/UR" value={formatTime(roux.lseULURTimeMs)} />
        <DetailTile label="LSE M-slice" value={formatTime(roux.lseMsliceTimeMs)} />
      </div>
    </div>
  );
}

// ─── Rotations & efficiency ────────────────────────────────────────────────

function RotEfficiencySection({ metrics }: { metrics: SolveMetrics }) {
  const { t } = useTranslation("insights");
  const rotation = metrics.rotation ?? EMPTY_ROTATION;
  const efficiency = metrics.efficiency ?? EMPTY_EFFICIENCY;
  const hasRot = rotation.totalCount > 0;
  const hasEff = efficiency.moveEfficiencyRatio > 0;

  if (!hasRot && !hasEff) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <SectionHeader title={t("analysis.rotEfficiency")} />
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <DetailTile
          label={t("analysis.rotations")}
          value={`${rotation.totalCount}`}
          sub={`x:${rotation.byAxis.x} y:${rotation.byAxis.y} z:${rotation.byAxis.z}`}
        />
        <DetailTile
          label={t("analysis.rotTime")}
          value={formatTime(rotation.estimatedRotationTimeMs)}
        />
        <DetailTile
          label={t("analysis.efficiency")}
          value={efficiency.moveEfficiencyRatio.toFixed(2)}
          sub={`opt=${efficiency.optimalMoveCount}m`}
          accent={efficiency.moveEfficiencyRatio > 1.3 ? "amber" : "ready"}
        />
        <DetailTile
          label={t("analysis.drift")}
          value={`${Math.round(efficiency.forwardDrift * 100)}%`}
        />
        {metrics.redundancy && (
          <>
            <DetailTile
              label={t("analysis.redundancies")}
              value={`${metrics.redundancy.totalRedundancies}`}
              sub={t("analysis.rate", {
                pct: Math.round(metrics.redundancy.redundancyRate * 100),
              })}
              accent={metrics.redundancy.totalRedundancies > 0 ? "amber" : undefined}
            />
            <DetailTile
              label={t("analysis.cancellations")}
              value={`${metrics.redundancy.cancellations}`}
              sub={t("analysis.reps", { count: metrics.redundancy.repetitions })}
            />
          </>
        )}
      </div>

      {/* Rotations by phase */}
      {Object.keys(rotation.byPhase).length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line/60">
          <div className="px-3 py-2 border-b border-line/50">
            <span className="text-[0.58rem] uppercase tracking-[0.15em] text-ink-3 font-medium">
              {t("analysis.rotationsByPhase")}
            </span>
          </div>
          {Object.entries(rotation.byPhase).map(([phase, count]) => (
            <div
              key={phase}
              className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-line/30 last:border-0"
            >
              <span className="font-medium text-ink-2 text-xs uppercase tracking-wide">
                {phase}
              </span>
              <span
                className={cn(
                  "nums font-medium",
                  count > 3 ? "text-caution" : count > 0 ? "text-ink" : "text-ink-3/50",
                )}
              >
                {count} rot
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

function DetailTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "ready" | "amber" | "dnf";
}) {
  const accentClass =
    accent === "ready"
      ? "text-ready"
      : accent === "amber"
        ? "text-caution"
        : accent === "dnf"
          ? "text-dnf"
          : "text-ink";
  return (
    <div className="flex flex-col gap-1 bg-surface px-3.5 py-3">
      <span className="text-[0.6rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </span>
      <span className={cn("nums text-lg", accentClass)}>{value}</span>
      {sub && <span className="nums text-[0.65rem] text-ink-3">{sub}</span>}
    </div>
  );
}

function ScrambleBlock({ solve }: { solve: Solve }) {
  const { t } = useTranslation("insights");
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText(solve.scramble);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success(i18n.t("timer:scrambleCopied"));
  };
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface px-5 py-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-ink-3">
          Scramble
        </span>
        {/* Plain mono text, same style as the algorithm text in Our
            detection — no boxes around each move. */}
        <p
          className="min-w-0 font-mono text-[0.78rem] font-medium text-ink leading-relaxed wrap-break-word"
          translate="no"
        >
          {solve.scramble}
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onCopy}
            className="grid size-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label={t("analysis.copyScramble")}
          >
            {copied ? <ClipboardCheck className="size-3.5" /> : <Clipboard className="size-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{t("analysis.copyScramble")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function formatTimestampFull(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
