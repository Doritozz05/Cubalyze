"use client";

import { Fragment, useState, useMemo, useRef, useCallback, type ReactNode } from "react";
import { ArrowLeft, Bluetooth, Box, Clipboard, ClipboardCheck, Keyboard, MessageSquare, Check, Pencil, X, RefreshCw, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime, yearWhenNeeded } from "@/utils/formatTime";
import {
  deriveTimeline,
  derivePairSegments,
  type TimelineData,
  type PairSegment,
} from "@/utils/insights";
import { phaseColorHex } from "@/utils/phaseColors";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import type { Penalty, Solve } from "@/types";
import type {
  SolveMetrics,
  RotationMetrics,
  EfficiencyMetrics,
} from "@cubalyze/types";
import {
  CaseMiniCube,
  LastLayerCaseCell,
  MovesSeq,
  CfopMiniBar,
  CountCell,
  leadingU,
  orderPairColors,
  pairStickerColors,
  ROW,
  ROW_LINE,
} from "@/components/Cases";
import { getSeedData, type AlgorithmCase } from "@cubalyze/algorithm-db";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsTouch } from "@/hooks/use-mobile";
import { hapticTap } from "@/utils/haptics";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import {
  SectionHeader,
  EmptyState,
  MetricRing,
  SkippedBadge,
  FaceChip,
  CoherenceBadge,
  WarningsBadge,
  CubeBadge,
  FACE_HEX,
} from "./atoms";
import { ReplaySection, type ReplaySectionHandle } from "./ReplaySection";
import {
  actionsForSurface,
  buildSolveActionGroups,
  canRetryScramble,
  type SolveActionItem,
} from "./solveActions";

export interface SolveAnalysisPanelProps {
  solve: Solve;
  /** Pending analysis from the just-completed live solve (not yet persisted). */
  liveMetrics: SolveMetrics | null;
  isLive: boolean;
  onUpdateSolve: (updates: { penalty?: Penalty; note?: string | null }) => void;
  /** Re-run the analysis pipeline on this solve (returns when finished). */
  onReanalyze?: () => Promise<void>;
  /** Delete this solve (opens the confirmation first). */
  onDeleteSolve: (id: string) => void;
  /** Open the "Move to another session" dialog for this solve. */
  onMoveSolve?: (id: string) => void;
  /** Open the "Assign cube" dialog for this solve. */
  onAssignSolve?: (id: string) => void;
  /**
   * Re-solve this solve's exact scramble in the timer. Omitted when there is
   * nowhere to send it; disabled (with the reason in the tooltip) when the
   * event has no scramble provider or the solve carries no scramble text.
   */
  onRetryScramble?: () => void;
  onBackToOverview: () => void;
  /** Reconstruction-style detail layout: replay pinned large on the left,
      content in a scrollable right column. */
  detailMode?: boolean;
  /** Toggle detail mode (renders the toggle button when provided). */
  onToggleDetailMode?: () => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

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

// Emerald gradient used to sub-divide the F2L phase bar into per-pair slices
// (P1 lightest → P4 darkest). Stable at module scope so timeline memos keep
// stable identities.
const PAIR_COLORS = ["#10B981", "#059669", "#047857", "#065F46"];
function pairColor(pairNumber: number): string {
  return PAIR_COLORS[(pairNumber - 1) % PAIR_COLORS.length];
}

// ─── Main component ────────────────────────────────────────────────────────

export function SolveAnalysisPanel({
  solve,
  liveMetrics,
  isLive,
  onUpdateSolve,
  onReanalyze,
  onDeleteSolve,
  onMoveSolve,
  onAssignSolve,
  onRetryScramble,
  onBackToOverview,
  detailMode,
  onToggleDetailMode,
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
  // Touch regime (<768px) — the same gate the shell and every other touch
  // surface uses. Drives which container the actions list opens in.
  const isTouch = useIsTouch();
  const [actionsOpen, setActionsOpen] = useState(false);

  // Whether a re-analysis is meaningful (per-move data, 3×3, no live job to
  // race) and whether the scramble can be re-solved are the shared rules in
  // `solveActions` — the same ones the row menu and the App handler use. Only
  // the retry's availability is needed here as well: the desktop button is the
  // one action the panel shows outside the list.
  const retryAvailable = Boolean(onRetryScramble) && canRetryScramble(solve);
  const handleReanalyze = useCallback(async () => {
    if (!onReanalyze || isReanalyzing) return;
    setIsReanalyzing(true);
    try {
      await onReanalyze();
    } finally {
      setIsReanalyzing(false);
    }
  }, [onReanalyze, isReanalyzing]);

  // Every action a solve offers, from the ONE declaration in `solveActions`
  // (which the solve list's context menu renders too). Each surface then takes
  // what belongs to it: the desktop overflow here, the bottom sheet on touch.
  const actionGroups = useMemo(
    () =>
      buildSolveActionGroups({
        t,
        solve,
        detailMode,
        isReanalyzing,
        // A pending live job must not be re-run over; only this panel knows
        // whether the analysis it is showing is still the transient one.
        liveSolveId: isLive ? solve.id : null,
        handlers: {
          onRetryScramble: onRetryScramble ? () => onRetryScramble() : undefined,
          onReanalyze: onReanalyze ? handleReanalyze : undefined,
          onToggleDetailMode,
          onMoveSolve,
          onAssignSolve,
          onDeleteSolve,
        },
      }),
    [
      t,
      solve,
      detailMode,
      isReanalyzing,
      isLive,
      onRetryScramble,
      onReanalyze,
      handleReanalyze,
      onToggleDetailMode,
      onMoveSolve,
      onAssignSolve,
      onDeleteSolve,
    ],
  );
  const menuGroups = useMemo(() => actionsForSurface(actionGroups, "menu"), [actionGroups]);
  const sheetGroups = useMemo(() => actionsForSurface(actionGroups, "sheet"), [actionGroups]);

  // Touch: haptic, close the sheet, then run the action — the sheet must not
  // stay open behind the dialog it just opened (same order as MobileMoreSheet).
  const runAction = useCallback((item: SolveActionItem) => {
    hapticTap();
    setActionsOpen(false);
    window.setTimeout(item.onSelect, 150);
  }, []);

  // Stable solve object for the ReplaySection (avoids unnecessary re-creates).
  const replaySolve = useMemo(
    () => (solve.analysis ? solve : { ...solve, analysis: m ?? undefined }),
    [solve, m],
  );

  // topSections keeps the leading blocks shared by both layouts; only the
  // replay is repositioned between normal and detail mode.
  const topSections = (
    <>
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
          <SolveMetaRow
            solve={solve}
            onCyclePenalty={cyclePenalty}
            onAssignCube={onAssignSolve ? () => onAssignSolve(solve.id) : undefined}
          />
        </div>
        {/* Actions. Desktop shows exactly one of them — the one you reach for
            while READING the solve (re-solve this scramble); everything
            administrative lives in the overflow menu, the same three entries
            the row's context menu already offers (move / assign / delete) plus
            the analysis-only one. Touch (<768px) shows the ⋯ alone and the same
            list — retry first — in the bottom sheet below. The rule that keeps
            this header from re-saturating: a new action never joins the
            identity row above; it belongs here. */}
        <div className="flex items-center gap-1">
          {!isTouch && onRetryScramble ? (
            <Tooltip>
              {/* The hover lives on the wrapper: a disabled <button> carries
                  `pointer-events-none`, so its own `title` could never surface
                  the reason the action is off. */}
              <TooltipTrigger asChild>
                <span className={cn("inline-flex", !retryAvailable && "cursor-not-allowed")}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRetryScramble}
                    disabled={!retryAvailable}
                    className="h-7 gap-1 px-2.5 text-xs"
                  >
                    <RefreshCw className="size-3" />
                    {t("analysis.retryScramble")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {retryAvailable
                  ? t("analysis.retryScrambleTooltip")
                  : t("analysis.retryUnavailable")}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {isTouch ? (
            <>
              {/* Touch (<768px): the same list, opened as a BOTTOM SHEET — the
                  app's own pattern for an action list (see MobileMoreSheet),
                  with the haptic the rest of the touch UI gives. The desktop
                  menu is an icon-anchored popup: on a phone it renders as a
                  portaled sheet that has to fight the solve-detail overlay it
                  opens from, which is exactly the class of bug the shell
                  comments warn about (see MainLayout's z-60 notes). Following
                  the touch convention removes the question. */}
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setActionsOpen(true);
                }}
                aria-label={t("analysis.solveActions")}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink max-lg:size-10"
              >
                <MoreHorizontal className="size-4" />
              </button>
              <Drawer open={actionsOpen} onOpenChange={setActionsOpen}>
                <DrawerContent className="flex max-h-[80vh] flex-col rounded-t-2xl border-line bg-surface p-0 pb-safe text-ink focus:outline-none">
                  <DrawerHeader className="shrink-0 border-b border-line px-5 py-3.5 text-left">
                    <DrawerTitle className="text-sm font-semibold text-ink">
                      {t("analysis.solveActions")}
                    </DrawerTitle>
                  </DrawerHeader>
                  {/* `min-h-0 flex-1 overflow-y-auto` is required: the sheet
                      caps at 80vh and a non-scrolling flex child would be
                      clipped instead of reachable. */}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                    {sheetGroups.map((group, groupIndex) => (
                      <div
                        key={group[0].id}
                        className={cn(
                          "flex flex-col",
                          groupIndex > 0 && "mt-2 border-t border-line/60 pt-2",
                        )}
                      >
                        {group.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={item.disabled}
                            onClick={() => runAction(item)}
                            className={cn(
                              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors active:bg-surface-2",
                              item.destructive ? "text-dnf" : "text-ink",
                              item.disabled
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "size-4 shrink-0",
                                item.destructive ? "text-dnf" : "text-ink-3",
                                item.busy && "animate-spin",
                              )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span>{item.label}</span>
                              {/* A disabled row states its reason here: a
                                  sheet has no hover, so a tooltip cannot
                                  explain the greying out. */}
                              {item.hint ? (
                                <span className="text-[0.65rem] leading-tight text-ink-3">
                                  {item.hint}
                                </span>
                              ) : null}
                            </span>
                            {item.checked ? (
                              <Check className="size-4 text-ink-3" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </DrawerContent>
              </Drawer>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("analysis.solveActions")}
                  title={t("analysis.solveActions")}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink max-lg:size-10"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">                    {menuGroups.map((group, groupIndex) => (
                  <Fragment key={group[0].id}>
                    {/* Detail mode is a view preference, so it travels with
                        the other view-level controls and keeps its check. */}
                    {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
                    {group.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        variant={item.destructive ? "destructive" : "default"}
                        disabled={item.disabled}
                        className="text-xs"
                        onClick={item.onSelect}
                      >
                        <item.icon className={cn("size-3.5", item.busy && "animate-spin")} />
                        {item.label}
                        {item.checked ? (
                          <Check className="ml-auto size-3.5 text-ink-3" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

    </>
  );

  // The replay lives in both layouts, positioned differently: in normal mode
  // it flows in the single column (topSections → replay → analysisSections);
  // in detail mode it becomes the pinned large left column.
  const replay = (
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
  );

  const analysisSections = m ? (
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

          {/* ── CFOP Detection Table (Standalone Panel, matching reconstructions) ── */}
          {m.cfop && (
            <DetectionSection
              metrics={m}
              solve={solve}
              onSeekToMove={seekToMove}
            />
          )}

          {/* ── Method-specific details ─────────────────────────────────── */}
          {m.cfop && <CfopDetailsSection metrics={m} />}
          {m.roux && <RouxDetailsSection metrics={m} />}

          {/* ── Rotations & efficiency ──────────────────────────────────── */}
          <RotEfficiencySection metrics={m} />
    </>
  ) : (
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
  );

  // ── Layouts ─────────────────────────────────────────────────────────────
  // Normal  : single column  topSections → replay → analysisSections.
  // Detail  : replay pinned large & sticky on the left; scrollable right
  //           column with the rest of the content (reconstruction-style).
  return (
    <div
      className={cn(
        detailMode
          ? "flex min-h-0 flex-col gap-4 lg:h-full lg:flex-row lg:overflow-hidden lg:px-1 lg:pb-4"
          : "flex flex-col gap-4 px-1 pb-4",
        className,
      )}
    >
      {detailMode ? (
        <>
          {/* Left — replay pinned large & sticky, like reconstructions */}
          <div className="flex min-h-75 w-full shrink-0 flex-col sm:min-h-95 lg:min-h-0 lg:w-7/12 lg:max-w-200 lg:flex-none">
            {/* Horizontal/detail: the replay column is 100% transparent on
                desktop — the glass engine matches class SUBSTRINGS, so
                `max-lg:bg-surface` would re-frost the whole column at every
                size; [data-replay-flat] forces transparency at lg+ (the cube
                floats on the page; only the ReplaySection controls panel
                keeps its glass). Mobile (<lg) gets a card. */}
            <div
              data-replay-flat
              className="flex flex-col max-lg:rounded-xl max-lg:border max-lg:border-line max-lg:bg-surface max-lg:p-3 sm:max-lg:p-4 max-lg:shadow-xs lg:min-h-0 lg:flex-1 lg:border-r lg:border-line/60"
            >
              <ReplaySection
                ref={replayRef}
                solve={replaySolve}
                size="large"
                collapsible={false}
                showHeader={false}
                flat
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
                className="h-full w-full min-h-0 border-0 p-0 bg-transparent shadow-none"
              />
            </div>
          </div>

          {/* Right — scrollable content column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-1 pb-4">
              {topSections}
              {analysisSections}
            </div>
          </div>
        </>
      ) : (
        <>
          {topSections}
          {replay}
          {analysisSections}
        </>
      )}
    </div>
  );
}

// ─── Identity row ──────────────────────────────────────────────────────────

/**
 * What the solve IS — penalty · method · source · cube — not what you can do to
 * it; the actions live in their own zone next to this row.
 *
 * The four read as ONE quiet rail of monochrome metadata in the theme's own ink
 * tokens, separated by a hairline dot, because they are the same kind of thing:
 * small facts printed under a large number. Two of them can be acted on without
 * a permanent control (the penalty cycles on click, the cube re-attributes) and
 * both announce themselves on hover — a bordered pill per fact is what made
 * this row compete with the time it was describing.
 *
 * Colour is spent only where it carries information: `+2` and `DNF` tint their
 * label, a clean solve stays neutral (a permanent green "OK" pill is
 * decoration, not data). The source used to be a hue-coded dot — raw Tailwind
 * 400 greens and violets, outside the theme's palette, so a custom theme could
 * not reach them — that only repeated what the words already said; its icon
 * says more and costs nothing.
 *
 * The cube keeps the row's one chip, because it is the only fact that names an
 * object the app cannot infer, and the way back to re-attributing the solve.
 */
function SolveMetaRow({
  solve,
  onCyclePenalty,
  onAssignCube,
}: {
  solve: Solve;
  onCyclePenalty: () => void;
  onAssignCube?: () => void;
}) {
  const { t } = useTranslation("insights");
  const factClass = "text-[0.6rem] font-medium uppercase tracking-wide text-ink-3";

  const SourceIcon =
    solve.source === "smart" ? Bluetooth : solve.source === "virtual" ? Box : Keyboard;
  const sourceLabel =
    solve.source === "smart"
      ? t("analysis.smartCube")
      : solve.source === "virtual"
        ? t("analysis.virtualCube")
        : t("analysis.manual");

  const facts: ReactNode[] = [
    <Tooltip key="penalty">
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onCyclePenalty}
          className={cn(
            "-mx-1 cursor-pointer rounded px-1 transition-colors hover:bg-surface-2",
            factClass,
            solve.penalty === "DNF" ? "text-dnf" : solve.penalty === "+2" ? "text-plus2" : null,
          )}
        >
          {solve.penalty === "none" ? t("common.clean") : solve.penalty}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("analysis.cyclePenalty")}</TooltipContent>
    </Tooltip>,
  ];
  if (solve.method) {
    facts.push(
      <span key="method" className={factClass}>
        {solve.method}
      </span>,
    );
  }
  facts.push(
    <span key="source" className={cn(factClass, "flex items-center gap-1")}>
      <SourceIcon aria-hidden="true" className="size-2.5 shrink-0" />
      {sourceLabel}
    </span>,
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {facts.map((fact, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden="true" className="select-none text-ink-3/30">
              ·
            </span>
          ) : null}
          {fact}
        </Fragment>
      ))}
      <CubeBadge label={solve.cubeLabel} onClick={onAssignCube} />
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

  const { totalMs, moveTicks, moveVisualMs, tpsSamples, pauseMarks } = timeline;
  const width = 600; // SVG internal coordinate base for TPS curve

  // ── 1. Continuous Phase Segments (Cover [0, totalMs] with 0 gaps) ─────────
  const continuousPhases = useMemo(() => {
    if (!timeline.stageSegments || timeline.stageSegments.length === 0) return [];
    const raw = timeline.stageSegments;
    return raw.map((seg, i) => {
      const startMs = i === 0 ? 0 : seg.startMs;
      const nextStart = i + 1 < raw.length ? raw[i + 1].startMs : totalMs;
      const endMs = Math.max(startMs, nextStart);
      const durationMs = Math.max(0, endMs - startMs);
      const color =
        seg.phaseName === "OLL"
          ? "#D97706"
          : seg.phaseName === "Cross"
            ? "#3B82F6"
            : phaseColorHex(seg.phaseName, i);
      return {
        phaseName: seg.phaseName,
        startMs,
        endMs,
        durationMs,
        moveCount: seg.moveCount,
        tps: seg.tps,
        color,
      };
    });
  }, [timeline.stageSegments, totalMs]);

  // ── 2. F2L pairs sub-divide the F2L phase bar (High-contrast emerald gradient) ───
  const hasPairs = (pairSegments?.length ?? 0) > 0;

  const continuousPairs = useMemo(() => {
    if (!hasPairs || !pairSegments || pairSegments.length === 0) return [];
    const f2lSeg = continuousPhases.find((p) => p.phaseName === "F2L");
    const f2lStartMs = f2lSeg ? f2lSeg.startMs : (pairSegments[0]?.startMs ?? 0);
    const f2lEndMs = f2lSeg ? f2lSeg.endMs : (pairSegments[pairSegments.length - 1]?.endMs ?? totalMs);

    return pairSegments.map((p, i, arr) => {
      const startMs = i === 0 ? f2lStartMs : Math.max(f2lStartMs, p.startMs);
      const nextStart = i + 1 < arr.length ? Math.max(startMs, arr[i + 1].startMs) : f2lEndMs;
      const endMs = Math.min(f2lEndMs, Math.max(startMs, nextStart));
      const durationMs = Math.max(0, endMs - startMs);
      return {
        ...p,
        startMs,
        endMs,
        durationMs,
        color: pairColor(p.pairNumber),
      };
    });
  }, [hasPairs, pairSegments, continuousPhases, totalMs]);

  // TPS scale: data-driven ceiling rounded up to a sensible tick.
  const maxTps = useMemo(() => {
    const max = Math.max(...tpsSamples.map((s) => s.tps), 0);
    if (max <= 0) return 5;
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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || totalMs <= 0 || !onSeekToMove || moveTicks.length === 0) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const clickMs = Math.max(0, Math.min(totalMs, ratio * totalMs));

      // Find closest move to click
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < moveTicks.length; i++) {
        const diff = Math.abs(moveTicks[i].offsetMs - clickMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      onSeekToMove(closestIdx);
    },
    [totalMs, onSeekToMove, moveTicks],
  );

  // Replay playhead x percentage
  const replayPct = useMemo(() => {
    if (replayPositionMs == null || totalMs <= 0) return null;
    const ms =
      replayMoveIdx != null &&
      replayMoveIdx >= 0 &&
      replayMoveIdx < moveVisualMs.length &&
      moveVisualMs[replayMoveIdx] > 0
        ? moveVisualMs[replayMoveIdx]
        : replayPositionMs;
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  }, [replayPositionMs, replayMoveIdx, moveVisualMs, totalMs]);

  const hoverPct = useMemo(() => {
    if (hoverMs == null || totalMs <= 0) return null;
    return Math.max(0, Math.min(100, (hoverMs / totalMs) * 100));
  }, [hoverMs, totalMs]);

  // Smoothed TPS Path (using cubic Bezier smoothing) for 32px height
  const TPS_HEIGHT = 32;
  const tpsPath = useMemo(() => {
    if (tpsSamples.length < 2) return "";
    const points = tpsSamples.map((s) => ({
      x: xForMs(s.offsetMs),
      y: TPS_HEIGHT - (s.tps / maxTps) * (TPS_HEIGHT - 4) - 2,
    }));

    if (points.length === 2) {
      return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
    }

    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }, [tpsSamples, xForMs, maxTps]);

  const tpsAreaPath = useMemo(() => {
    if (tpsPath === "") return "";
    const lastX = xForMs(tpsSamples[tpsSamples.length - 1]?.offsetMs ?? totalMs);
    return `${tpsPath} L${lastX.toFixed(1)},${TPS_HEIGHT} L0,${TPS_HEIGHT} Z`;
  }, [tpsPath, tpsSamples, xForMs, totalMs]);

  // Total pause time for the eyebrow
  const totalPauseMs = useMemo(
    () => pauseMarks.reduce((s, p) => s + p.durationMs, 0),
    [pauseMarks],
  );
  const meanPauseMs = pauseMarks.length > 0 ? totalPauseMs / pauseMarks.length : 0;

  // ── Per-move velocity mini-map ─────────────────────────────────────────
  // One cell per move, colored by its instantaneous speed (inverse of the
  // gap to the next move). Read as a TPS "heat strip" synced to the replay
  // playhead (which sweeps this container).
  const perMoveTps = useMemo(() => {
    if (moveTicks.length < 2) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < moveTicks.length; i++) {
      const cur = moveVisualMs[i] ?? 0;
      const next = moveVisualMs[i + 1] ?? (moveVisualMs.length > 1 ? moveVisualMs[moveVisualMs.length - 1] + (moveVisualMs[moveVisualMs.length - 1] - moveVisualMs[moveVisualMs.length - 2]) : cur + 100);
      const gapMs = Math.max(1, next - cur);
      out.push(1000 / gapMs);
    }
    return out;
  }, [moveTicks, moveVisualMs]);
  const perMoveMax = useMemo(() => {
    const m = Math.max(...perMoveTps, 0);
    return m > 0 ? m : 5;
  }, [perMoveTps]);
  const tpsHeat = useCallback(
    (tps: number): string => {
      const r = Math.max(0, Math.min(1, tps / perMoveMax));
      if (r < 0.4) return "#EF4444"; // slow
      if (r < 0.7) return "#F59E0B"; // medium
      return "#22C55E"; // fast
    },
    [perMoveMax],
  );
  const hasMiniMap = moveTicks.length >= 2 && perMoveTps.length === moveTicks.length;

  const xTickFracs = [0, 0.25, 0.5, 0.75, 1];
  const meanTpsY = TPS_HEIGHT - (Math.min(meanTps, maxTps) / maxTps) * (TPS_HEIGHT - 4) - 2;

  const segHighlight = (phaseName?: string): "active" | "dim" | "normal" => {
    if (hoveredPhase === null) return "normal";
    return phaseName === hoveredPhase ? "active" : "dim";
  };

  const categoryLabel = (cat: string): string => {
    switch (cat) {
      case "recognition":
        return t("analysis.pauseCatRecognition");
      case "mid-algorithm":
        return t("analysis.pauseCatMidAlgorithm");
      case "mid-phase":
        return t("analysis.pauseCatMidPhase");
      default:
        // Legacy persisted categories (pre-0.3.0): "transition" / "pre-algorithm".
        return cat;
    }
  };

  const pauseCauseLabel = (pm: { probableCause?: string; phase?: string }): string => {
    const cause = pm.probableCause ?? "";
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
        if (cause.endsWith(" hesitation")) {
          return t("analysis.pauseCauseHesitation", {
            phase: cause.slice(0, -" hesitation".length),
          });
        }
        if (cause.endsWith(" recognition")) {
          return t("analysis.pauseCauseRecognition", {
            phase: cause.slice(0, -" recognition".length),
          });
        }
        return cause || `${pm.phase ?? "Solve"} pause`;
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
        {/* Chart row: Left labels column + Main Track Canvas */}
        <div className="flex items-stretch gap-2">
          {/* Left Y-axis labels perfectly aligned with each track */}
          <div className="flex shrink-0 flex-col gap-1.5 select-none text-right font-mono" style={{ width: 38 }}>
            {/* Row 1: TPS */}
            <div className="flex h-8 flex-col justify-between py-0.5 pr-1">
              <span className="text-[0.52rem] font-bold text-ink-3/70 leading-none">
                TPS {maxTps.toFixed(0)}
              </span>
              <span className="text-[0.5rem] font-medium text-ink-3/40 leading-none">
                0
              </span>
            </div>
            {/* Row 2: Phase bar label */}
            <div className="flex h-6.5 items-center justify-end pr-1">
              <span className="text-[0.52rem] font-bold tracking-wider text-ink-3/60">
                PHASE
              </span>
            </div>
            {/* Row 3: Pause lane label */}
            <div className="flex h-2 items-center justify-end pr-1">
              <span className="text-[0.48rem] font-bold tracking-wider text-ink-3/60 leading-none">
                PAUSE
              </span>
            </div>
            {/* Row 4: Velocity mini-map label */}
            {hasMiniMap && (
              <div className="flex h-2.5 items-center justify-end pr-1">
                <span className="text-[0.46rem] font-bold tracking-wider text-ink-3/40 leading-none">
                  VEL
                </span>
              </div>
            )}
          </div>

          {/* Main timeline track container */}
          <div
            ref={containerRef}
            className="relative flex-1 flex flex-col gap-1.5 select-none cursor-crosshair"
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            onClick={handleClick}
          >
            {/* 1. TPS Chart Area (SVG only for curves/lines, zero text) */}
            <div className="relative h-8 w-full overflow-hidden border-b border-line/40">
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${TPS_HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-0 pointer-events-none overflow-visible"
              >
                <defs>
                  <linearGradient id="tps-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                {/* Vertical time gridlines */}
                {xTickFracs.map((f, i) => (
                  <line
                    key={`gx-${i}`}
                    x1={f * width}
                    y1={0}
                    x2={f * width}
                    y2={TPS_HEIGHT}
                    stroke="var(--ink-3)"
                    strokeWidth={0.5}
                    strokeOpacity={0.12}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* TPS area fill & path */}
                {tpsAreaPath && <path d={tpsAreaPath} fill="url(#tps-gradient)" />}
                {tpsPath && (
                  <path
                    d={tpsPath}
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Mean TPS dashed line */}
                {meanTps > 0 && (
                  <line
                    x1={0}
                    y1={meanTpsY}
                    x2={width}
                    y2={meanTpsY}
                    stroke="var(--ready, #22C55E)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Move tick marks on baseline */}
              {moveVisualMs.map((visMs, i) => {
                const leftPct = totalMs > 0 ? (visMs / totalMs) * 100 : 0;
                return (
                  <div
                    key={moveTicks[i]?.index ?? i}
                    className="absolute bottom-0 w-px h-0.75 bg-ink-3/40 pointer-events-none"
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}
            </div>

            {/* 2. Main Phase Bar (Pure HTML Flex, Sharp Square Rectangles, Crisp Proportional Typography) */}
            <div className="relative h-6.5 w-full flex overflow-hidden border border-line/70 bg-surface-2">
              {continuousPhases.map((phase, pIdx) => {
                const isF2LDivided = phase.phaseName === "F2L" && hasPairs;
                const phaseWidthPct = totalMs > 0 ? (phase.durationMs / totalMs) * 100 : 0;
                const isLastPhase = pIdx === continuousPhases.length - 1;
                const hl = segHighlight(phase.phaseName);

                if (isF2LDivided) {
                  return (
                    <div
                      key="f2l-container"
                      className="h-full flex"
                      style={{ width: `${phaseWidthPct}%` }}
                    >
                      {continuousPairs.map((pair, pairIdx) => {
                        const pairWidthPct = phase.durationMs > 0 ? (pair.durationMs / phase.durationMs) * 100 : 25;
                        const pairHl = segHighlight("F2L");
                        const opacity = pairHl === "dim" ? 0.35 : pairHl === "active" ? 1.0 : 0.95;
                        const seekable = !!onSeekToMove && pair.moveStartIndex >= 0;
                        const isLastPair = pairIdx === continuousPairs.length - 1;

                        return (
                          <HoverCard key={`pair-${pair.pairNumber}`} openDelay={150} closeDelay={100}>
                            <HoverCardTrigger asChild>
                              <div
                                className={cn(
                                  "h-full relative flex items-center justify-center transition-opacity",
                                  !isLastPair && "border-r border-black/15",
                                  isLastPair && !isLastPhase && "border-r border-black/15",
                                  seekable && "cursor-pointer",
                                )}
                                style={{
                                  width: `${pairWidthPct}%`,
                                  backgroundColor: pair.color,
                                  opacity,
                                }}
                                onMouseEnter={() => onHoverPhase("F2L")}
                                onMouseLeave={() => onHoverPhase(null)}
                                onClick={seekable ? (e) => { e.stopPropagation(); onSeekToMove!(pair.moveStartIndex); } : undefined}
                              >
                                <span className="truncate px-1 font-sans text-[0.68rem] font-bold uppercase tracking-wider text-white select-none antialiased">
                                  {pair.slot ?? `P${pair.pairNumber}`}
                                </span>
                              </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" align="center" sideOffset={8} className="w-64 p-3 text-xs shadow-lg">
                              <div className="flex items-center gap-2">
                                <span className="inline-block size-2.5 shrink-0" style={{ background: pair.color }} />
                                <span className="font-semibold text-ink">
                                  {t("analysis.pair", { number: pair.pairNumber })}
                                </span>
                                {pair.slot && (
                                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[0.58rem] font-bold text-ink-2">
                                    {pair.slot}
                                  </span>
                                )}
                                {seekable && (
                                  <span className="ml-auto text-[0.58rem] font-medium text-phase-indigo">
                                    {t("analysis.pairSeekHint")}
                                  </span>
                                )}
                              </div>
                              {pair.caseName && (
                                <div className="mt-1.5 flex items-baseline gap-2">
                                  <span className="text-[0.74rem] font-medium text-ink-2">
                                    {pair.caseName}
                                  </span>
                                  {pair.caseNumber && (
                                    <span className="font-mono text-[0.58rem] text-ink-3">
                                      {pair.caseNumber}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="mt-2 flex items-baseline justify-between border-t border-line/40 pt-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    {t("analysis.phaseTime")}
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {formatTime(pair.durationMs)}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    {t("analysis.phaseMoves")}
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {pair.moves}m
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                                    TPS
                                  </span>
                                  <span className="nums text-sm font-semibold text-ink">
                                    {pair.tps.toFixed(1)}
                                  </span>
                                </div>
                                {pair.recognitionMs > 50 && (
                                  <div className="flex flex-col">
                                    <span className="text-[0.58rem] uppercase tracking-wider text-caution">
                                      {t("analysis.pairRecognition")}
                                    </span>
                                    <span className="nums text-sm font-semibold text-caution">
                                      +{formatTime(pair.recognitionMs)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      })}
                    </div>
                  );
                }

                const opacity = hl === "dim" ? 0.35 : hl === "active" ? 1.0 : 0.95;

                return (
                  <HoverCard key={`phase-${phase.phaseName}`} openDelay={150} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div
                        className={cn(
                          "h-full relative flex items-center justify-center transition-opacity cursor-pointer",
                          !isLastPhase && "border-r border-black/15",
                        )}
                        style={{
                          width: `${phaseWidthPct}%`,
                          backgroundColor: phase.color,
                          opacity,
                        }}
                        onMouseEnter={() => onHoverPhase(phase.phaseName)}
                        onMouseLeave={() => onHoverPhase(null)}
                      >
                        <span className="truncate px-1 font-sans text-[0.68rem] font-bold uppercase tracking-wider text-white select-none antialiased">
                          {phase.phaseName}
                        </span>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" sideOffset={8} className="w-56 p-3 text-xs shadow-lg">
                      <div className="flex items-center gap-2">
                        <span className="inline-block size-2.5 shrink-0" style={{ background: phase.color }} />
                        <span className="font-semibold text-ink">{phase.phaseName}</span>
                        <span className="ml-auto nums text-[0.65rem] text-ink-3">
                          {Math.round((phase.durationMs / totalMs) * 100)}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between border-t border-line/40 pt-2">
                        <div className="flex flex-col">
                          <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                            {t("analysis.phaseTime")}
                          </span>
                          <span className="nums text-sm font-semibold text-ink">
                            {formatTime(phase.durationMs)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                            {t("analysis.phaseMoves")}
                          </span>
                          <span className="nums text-sm font-semibold text-ink">
                            {phase.moveCount}m
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.58rem] uppercase tracking-wider text-ink-3">
                            TPS
                          </span>
                          <span className="nums text-sm font-semibold text-ink">
                            {phase.tps.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>

            {/* 3. Pause Lane (HTML, Sleek Minimalist Track, Flat Square Blocks) */}
            <div className="relative h-2 w-full bg-surface-2/60 border border-line/40 overflow-hidden">
              {pauseMarks.map((pm, i) => {
                const leftPct = totalMs > 0 ? (pm.startMs / totalMs) * 100 : 0;
                const widthPct = totalMs > 0 ? (pm.durationMs / totalMs) * 100 : 0;
                const isRecog = pm.category === "recognition";
                const catColor = isRecog ? "#8B5CF6" : "#F59E0B";
                const isLong = pm.durationMs >= 500;
                const vsMean =
                  meanPauseMs > 0 ? ((pm.durationMs - meanPauseMs) / meanPauseMs) * 100 : 0;

                const startIdx = pm.startIndex ?? 0;
                const endIdx = pm.endIndex ?? 0;
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

                return (
                  <HoverCard key={`pause-${i}`} openDelay={150} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div
                        className="absolute top-0 bottom-0 transition-opacity cursor-help"
                        style={{
                          left: `${leftPct}%`,
                          width: `max(${widthPct}%, 2px)`,
                          backgroundColor: catColor,
                          opacity: isLong ? 0.95 : 0.8,
                        }}
                        onMouseEnter={() => onHoverPhase(pm.phase ?? null)}
                        onMouseLeave={() => onHoverPhase(null)}
                      />
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" sideOffset={6} className="w-72 p-3 text-xs shadow-lg">
                      <div className="flex items-center gap-2">
                        <span className="inline-block size-2.5 shrink-0" style={{ background: catColor }} />
                        <span className="font-semibold text-ink">{pauseCauseLabel(pm)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[0.6rem] text-ink-3">
                        <span
                          className="rounded px-1.5 py-0.5 font-medium uppercase tracking-wide"
                          style={{ background: `${catColor}22`, color: catColor }}
                        >
                          {categoryLabel(pm.category)}
                        </span>
                        <span className="uppercase tracking-wide font-medium">{pm.phase}</span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2 border-t border-line/40 pt-2">
                        <span className="nums text-base font-bold text-ink">
                          {formatTime(pm.durationMs)}
                        </span>
                        {meanPauseMs > 0 && (
                          <span
                            className={cn(
                              "nums text-[0.65rem] font-semibold",
                              vsMean > 20 ? "text-dnf" : vsMean < -20 ? "text-ready" : "text-ink-3",
                            )}
                          >
                            {vsMean > 0 ? "+" : ""}
                            {t("analysis.vsAvg", { pct: Math.round(vsMean) })}
                          </span>
                        )}
                      </div>
                      {(before.length > 0 || after.length > 0) && (
                        <div className="mt-2 border-t border-line/40 pt-1.5">
                          <span className="text-[0.58rem] uppercase tracking-wide text-ink-3 font-semibold">
                            {t("analysis.adjacentMoves")}
                          </span>
                          <div className="mt-1 flex items-center gap-1.5 font-mono text-[0.68rem]">
                            {before.map((m, j) => (
                              <span key={`b-${j}`} className="text-ink-3">
                                {m.label}
                              </span>
                            ))}
                            <span className="font-bold text-dnf">⏸</span>
                            {after.map((m, j) => (
                              <span key={`a-${j}`} className="font-semibold text-ink">
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
            </div>

            {/* 3.5 Velocity mini-map — per-move TPS heat strip */}
            {hasMiniMap && (
              <div className="relative h-2.5 w-full flex overflow-hidden rounded-sm bg-surface-2/60 border border-line/40">
                {perMoveTps.map((t, i) => (
                  <div
                    key={`vel-${i}`}
                    className="h-full transition-colors"
                    style={{ width: `${100 / moveTicks.length}%`, backgroundColor: tpsHeat(t) }}
                    title={`${moveTicks[i]?.label ?? ""} · ${t.toFixed(1)} TPS`}
                  />
                ))}
              </div>
            )}

            {/* 4. Playhead and Hover Scrubber Vertical Lines */}
            {hoverPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-ink pointer-events-none opacity-60 z-20"
                style={{ left: `${hoverPct}%` }}
              />
            )}
            {replayPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 pointer-events-none z-20 shadow-[0_0_4px_rgba(59,130,246,0.8)]"
                style={{ left: `${replayPct}%` }}
              />
            )}
          </div>
        </div>

        {/* X-axis time labels (HTML) */}
        <div className="relative mt-1 select-none" style={{ height: 14, marginLeft: 46 }}>
          {xTickFracs.map((f, i) => (
            <span
              key={`xt-${i}`}
              className="absolute nums text-[0.58rem] font-medium leading-none text-ink-3/75"
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

      {/* Legend — Sharp square dots, clean typography */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line/40 pt-2.5 text-[0.6rem] text-ink-3">
        {continuousPhases.map((phase) => {
          const isF2LDivided = phase.phaseName === "F2L" && hasPairs;
          return (
            <button
              key={phase.phaseName}
              type="button"
              className={cn(
                "flex items-center gap-1.5 transition-opacity hover:opacity-100",
                hoveredPhase && hoveredPhase !== phase.phaseName ? "opacity-40" : "opacity-90",
              )}
              onMouseEnter={() => onHoverPhase(phase.phaseName)}
              onMouseLeave={() => onHoverPhase(null)}
            >
              {isF2LDivided ? (
                <span className="flex gap-0.5">
                  {continuousPairs.map((pair) => (
                    <span
                      key={pair.pairNumber}
                      className="inline-block size-2"
                      style={{ background: pair.color }}
                    />
                  ))}
                </span>
              ) : (
                <span
                  className="inline-block size-2"
                  style={{ background: phase.color }}
                />
              )}
              <span className="font-medium text-ink-2">{phase.phaseName}</span>
            </button>
          );
        })}

        {pauseMarks.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="inline-block size-2 bg-[#8B5CF6]" title="Recognition" />
              <span className="inline-block size-2 bg-[#F59E0B]" title="Hesitation / Search" />
            </span>
            <span className="font-medium text-ink-2">
              {t("analysis.pausesLegend", {
                count: pauseMarks.length,
                time: formatTime(totalPauseMs),
              })}
            </span>
          </span>
        )}

        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3.5 bg-[#6366F1]" />
          <span className="font-medium text-ink-2">TPS</span>
        </span>

        {meanTps > 0 && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0 w-3.5 border-t border-dashed"
              style={{ borderColor: "var(--ready, #22C55E)", borderWidth: 1 }}
            />
            <span className="font-medium text-ink-2">
              {t("analysis.avgLegend", { tps: meanTps.toFixed(1) })}
            </span>
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

function CfopDetailsSection({ metrics }: { metrics: SolveMetrics }) {
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
    </div>
  );
}

// ─── Detection Table (Standalone Panel, matching reconstructions) ──────────

const CASE_GRID_CONTAINER =
  "grid min-w-[36rem] grid-cols-[5.5rem_minmax(6.5rem,max-content)_minmax(0,1fr)_4.25rem_3.25rem_2.25rem] sm:grid-cols-[6.5rem_minmax(7.5rem,max-content)_minmax(0,1fr)_4.75rem_3.5rem_2.5rem]";
const CASE_ROW_GRID = "grid grid-cols-subgrid col-span-6";

function DetectionSection({
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
  const warnings = report?.warnings ?? [];
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
    <div className="rounded-lg border border-line bg-surface overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:py-3.5">
        <SectionHeader
          title={t("analysis.detectionTitle", { defaultValue: "Detection" })}
          eyebrow={t("analysis.detectionEyebrow", { defaultValue: "CFOP" })}
        />
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <CfopMiniBar
            crossMoves={cfop.crossMoves}
            f2lMoves={f2lMoves}
            ollMoves={ollPhase?.moveCount ?? 0}
            pllMoves={pllPhase?.moveCount ?? 0}
            totalMoves={metrics.totalMoves}
          />
          <WarningsBadge warnings={warnings} />
          <CoherenceBadge coherent={report?.finalStateSolved ?? true} />
          <span className="nums text-xs text-ink-3">
            {metrics.totalMoves} moves
          </span>
        </div>
      </div>

      {/* ── Outer 5-Column Table Grid with horizontal scroll guard ── */}
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
            <span className="text-right whitespace-nowrap">#</span>
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
            <CountCell count={crossNotation?.length ?? 0} />
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
                  {(pair.recognitionMs ?? pair.pauseBeforeMs ?? 0) > 50 && (
                    <span className="ml-1 text-caution/70">
                      +{formatTime(pair.recognitionMs ?? pair.pauseBeforeMs ?? 0)}
                    </span>
                  )}
                </span>
                <span className="nums text-right text-xs font-medium text-ink">
                  {pair.tps.toFixed(1)}
                </span>
                <CountCell count={pair.moves} />
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
              <CountCell count={ollPhase?.moveCount ?? 0} />
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
              <CountCell count={pllPhase?.moveCount ?? 0} />
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
  // The year is shown only when the solve is not from the current one: imports
  // reach back years, and "vie, 11 sept" would read as this September.
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    ...yearWhenNeeded(ts),
    hour: "2-digit",
    minute: "2-digit",
  });
}
