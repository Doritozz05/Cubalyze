"use client";

/**
 * OurDetectionPanel — State-based CFOP Detection Table.
 *
 * Runs the headless `analyzeSolveText` API on a reconstruction record and
 * renders OUR state-based detection next to the reconstructor's raw phases,
 * matching the clean 4-column Table structure (Phase | Case | Moves | #):
 *
 *   - Orientation row: inspection rotations + colors on U and F after the grip
 *   - Cross row: cross type (plain / xcross / xxcross) + cross color
 *   - F2L pair rows: slot name, pair colors, 3D mini case preview, moves and count
 *   - OLL / PLL rows: 2D case diagram (rotated to solver's AUF), moves and skip status
 *   - Coherence (finalSolved) + detection warnings
 *   - Interleaved rotations & standalone slices
 *   - Click-to-seek: clicking any row seeks the 3D replay to the exact state before that phase
 *
 * The case-table cells (CaseMiniCube, LastLayerCaseCell, MovesSeq, CountCell,
 * CfopMiniBar) and their helpers live in the SHARED `@/components/Cases`
 * module — the same table renders for smart/virtual solve analysis.
 */
import { useMemo, type KeyboardEvent } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  SectionHeader,
  FaceChip,
  CoherenceBadge,
  WarningsBadge,
  SkippedBadge,
} from "@/components/Insights/atoms";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  analyzeSolveText,
  type SolveReconstruction,
} from "@cubalyze/analysis-engine";
import { getSeedData, type AlgorithmCase } from "@cubalyze/algorithm-db";
import { isRotation, tokenize } from "@cubalyze/math-core";
import type { ReconFullRecord } from "./reconData";
import {
  CaseMiniCube,
  LastLayerCaseCell,
  MovesSeq,
  CountCell,
  CfopMiniBar,
  leadingU,
  interleave,
  orderPairColors,
  pairStickerColors,
  GRID_CONTAINER,
  ROW_GRID,
  ROW,
  ROW_LINE,
} from "@/components/Cases";

// ─── Main Component ─────────────────────────────────────────────────────────

export function OurDetectionPanel({
  record,
  onSeekToMove,
}: {
  record: ReconFullRecord;
  /**
   * Clicking a phase row seeks the 3D replay to the state right before that
   * phase's first move (the last move of the previous phase applied).
   */
  onSeekToMove?: (moveIndex: number) => void;
}) {
  const { t } = useTranslation("reconstructions");

  const canDetect =
    record.methodGroup === "CFOP" && record.puzzle === "3x3";

  const result = useMemo(() => {
    if (!canDetect) return null;
    if (record.ourDetection !== undefined) return record.ourDetection;
    return analyzeSolveText({
      setup: record.scramble,
      inspection: record.recognition.inspection || undefined,
      solution: record.text,
      method: "CFOP",
      relaxedCross: true,
      totalTimeMs: record.time > 0 ? record.time * 1000 : undefined,
    });
  }, [canDetect, record]);

  const casesByNumber = useMemo(() => {
    const m = new Map<string, AlgorithmCase>();
    for (const c of getSeedData().cases) {
      if (!m.has(c.caseNumber)) m.set(c.caseNumber, c);
      if (c.name && !m.has(c.name)) m.set(c.name, c);
    }
    return m;
  }, []);

  const failed = result === null && canDetect;

  if (failed) {
    return (
      <div className="mt-4 rounded-lg border border-caution/40 bg-caution/5 px-3 py-2.5 text-[0.66rem] text-caution">
        {t("detection.apiError")}
      </div>
    );
  }

  if (!result) return null;
  const recon: SolveReconstruction = result.reconstruction;
  const report = result.timeline.detectionReport;
  const reportPhases = report?.phases ?? [];

  // ── Replay seek mapping ──
  const solveSlicesAll = recon.slices ?? [];
  const eventsBeforeEntry = (entryIdx: number): number =>
    entryIdx +
    solveSlicesAll.filter((s) => s.moveIndex < entryIdx).length;
  const seekToEntry = (entryIdx: number) => {
    onSeekToMove?.(eventsBeforeEntry(entryIdx) - 1);
  };

  const seekRowProps = (entryIdx: number) =>
    onSeekToMove
      ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => seekToEntry(entryIdx),
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            seekToEntry(entryIdx);
          }
        },
      }
      : {};

  const crossPhase = reportPhases.find((p) => p.phaseName === "Cross");
  const ollPhase = reportPhases.find((p) => p.phaseName === "OLL");
  const pllPhase = reportPhases.find((p) => p.phaseName === "PLL");
  const crossStart = crossPhase?.startIndex ?? 0;
  const crossEnd = crossPhase?.endIndex ?? crossStart + recon.cross.moves.length - 1;
  const crossMoves = recon.cross.moves;

  const inspectionRotationCount = tokenize(recon.inspection).filter(isRotation).length;
  const inspectionRotations = recon.rotations.slice(0, inspectionRotationCount);
  const solveRotations = recon.rotations.slice(inspectionRotationCount);
  const solveSlices = recon.slices ?? [];

  const interleavables = (
    rots: { token: string; moveIndex: number }[],
    from: number,
    to: number,
  ) => [
      ...rots.filter((r) => r.moveIndex >= from && r.moveIndex <= to),
      ...solveSlices.filter((s) => s.moveIndex >= from && s.moveIndex <= to),
    ];

  let pairStart = crossEnd + 1;
  const pairs = recon.pairs.map((p) => {
    const from = pairStart;
    const moves = p.moves;
    pairStart = p.completionIndex + 1;
    const auf = leadingU(moves);
    const rots = interleavables(
      solveRotations,
      from,
      from + moves.length - 1,
    );
    return { ...p, from, moves, auf, display: interleave(moves, rots, from) };
  });

  const ollMoves = recon.oll ? recon.oll.moves : null;
  const ollFrom = ollPhase?.startIndex ?? pairStart;
  const ollTo = ollPhase?.endIndex ?? (ollMoves ? ollFrom + ollMoves.length - 1 : ollFrom - 1);
  const ollRots = interleavables(solveRotations, ollFrom, ollTo);
  const ollDisplay = ollMoves ? interleave(ollMoves, ollRots, ollFrom) : null;

  const pllStart =
    pllPhase?.startIndex ?? (ollMoves ? pairStart + ollMoves.length : pairStart);
  const pllMoves = recon.pll ? recon.pll.moves : null;
  const pllTo = pllPhase?.endIndex ?? (pllMoves ? pllStart + pllMoves.length - 1 : pllStart - 1);
  const pllRots = interleavables(solveRotations, pllStart, pllTo);
  const pllDisplay = pllMoves ? interleave(pllMoves, pllRots, pllStart) : null;

  const crossRots = interleavables(solveRotations, crossStart, crossEnd);
  const crossDisplay = interleave(crossMoves, crossRots, crossStart);

  const totalMoves =
    crossMoves.length +
    pairs.reduce((n, p) => n + p.moves.length, 0) +
    (ollMoves?.length ?? 0) +
    (pllMoves?.length ?? 0);

  const f2lTotalMoves = pairs.reduce((n, p) => n + p.moves.length, 0);
  const f2lAvg = pairs.length > 0 ? (f2lTotalMoves / pairs.length).toFixed(1) : null;

  const crossColor = recon.crossColor;
  const isXCross = recon.cross.type !== "plain";
  const crossPairCount =
    recon.cross.type === "xxxcross"
      ? 3
      : recon.cross.type === "xxcross"
        ? 2
        : recon.cross.type === "xcross"
          ? 1
          : 0;

  const warnings = report?.warnings ?? [];
  const orient = recon.orientation;
  const inspectionTokens = inspectionRotations.map((r) => r.token);
  const seekRowCls = onSeekToMove ? " cursor-pointer" : "";

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 sm:py-2.5">
        <SectionHeader title={t("detection.title")} eyebrow={t("detection.eyebrow")} />
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <CfopMiniBar
            crossMoves={crossMoves.length}
            f2lMoves={f2lTotalMoves}
            ollMoves={ollMoves?.length ?? 0}
            pllMoves={pllMoves?.length ?? 0}
            totalMoves={totalMoves}
          />
          <WarningsBadge warnings={warnings} />
          <CoherenceBadge coherent={recon.finalSolved} />
          <span className="nums text-xs text-ink-3">
            {t("detail.movesCount", { count: totalMoves })}
          </span>
        </div>
      </div>

      {/* ── Outer 4-Column Table Grid with horizontal scroll guard ── */}
      <div className="overflow-x-auto overflow-y-hidden min-w-0 scrollbar-thin">
        <div className={GRID_CONTAINER}>
          {/* Column headers */}
          <div
            className={cn(
              ROW_GRID,
              "items-center gap-2 border-b border-line bg-surface-2/60 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[0.56rem] sm:text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3",
            )}
          >
            <span className="whitespace-nowrap">{t("detail.colPhase")}</span>
            <span className="whitespace-nowrap">{t("detail.colCase")}</span>
            <span className="whitespace-nowrap">{t("detail.colMoves")}</span>
            <span className="text-right whitespace-nowrap">#</span>
          </div>

          {/* ── Orientation Row ── */}
          <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
            <span className="text-[0.74rem] font-medium text-ink whitespace-nowrap">
              {t("detection.orientation")}
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {orient && (
                <>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-ink-3">
                    {t("detection.up")}
                  </span>
                  <FaceChip face={orient.up} />
                  <span className="ml-1 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-3">
                    {t("detection.front")}
                  </span>
                  <FaceChip face={orient.front} />
                </>
              )}
              {!orient && <span className="text-[0.64rem] text-ink-3">—</span>}
            </span>
            <MovesSeq tokens={inspectionTokens.length > 0 ? inspectionTokens : null} />
            <span className="nums text-right text-xs text-ink-3 whitespace-nowrap">—</span>
          </div>

          {/* ── Cross Row ── */}
          <div className={cn(ROW_GRID, ROW, ROW_LINE, seekRowCls)} {...seekRowProps(crossStart)}>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.74rem] font-medium text-ink">{t("detection.cross")}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {isXCross && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide cursor-help",
                          recon.cross.type !== "xcross"
                            ? "border border-caution/40 bg-caution/10 text-caution"
                            : "border border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
                        )}
                      >
                        {recon.cross.type}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {recon.cross.type === "pseudo xcross"
                        ? t("detection.xcrossPseudo")
                        : recon.cross.xcrossPair
                          ? t("detection.xcrossPair", { name: recon.cross.xcrossPair.name })
                          : t("detection.xcrossGeneric")}
                    </TooltipContent>
                  </Tooltip>
                )}
                {crossColor && <FaceChip face={crossColor} />}
              </span>
            </span>
            <span className="text-[0.64rem] text-ink-3/50">—</span>
            <MovesSeq tokens={crossDisplay} />
            <CountCell count={crossMoves.length} />
          </div>

          {/* ── F2L Pairs Rows ── */}
          {pairs.map((p, i) => {
            const [leftColor, rightColor] =
              p.leftColor && p.rightColor
                ? [p.leftColor, p.rightColor]
                : orderPairColors(p.colors[0], p.colors[1], crossColor ?? undefined);
            const pairColors = [leftColor, rightColor];
            const stickerColors =
              crossColor && pairColors.every((c) => c != null)
                ? pairStickerColors(crossColor, leftColor!, rightColor!)
                : null;

            return (
              <div key={p.slot || `f2l-${i}`} className={cn(ROW_GRID, ROW, ROW_LINE, seekRowCls)} {...seekRowProps(p.from)}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[0.74rem] font-medium text-ink">
                    {p.slot
                      ? t("detection.f2lPair", { count: crossPairCount + i + 1 })
                      : t("detection.f2l")}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {p.slot ? (
                      <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.56rem] font-medium text-ink-2">
                        {p.slot}
                      </span>
                    ) : (
                      <span className="text-[0.64rem] text-ink-3">
                        {t("detection.noPairSegmentation")}
                      </span>
                    )}
                    {pairColors.map((c) => c != null && <FaceChip key={c} face={c} />)}
                  </span>
                </span>

                <span className="flex min-w-0 items-center gap-2">
                  {p.detectedCase &&
                    (() => {
                      const caseData =
                        casesByNumber.get(p.detectedCase!.caseNumber) ??
                        casesByNumber.get(p.detectedCase!.caseName);
                      if (!caseData) return null;
                      return (
                        <CaseMiniCube
                          caseData={caseData}
                          slotIndex={0}
                          stickerColors={stickerColors}
                          alt={p.detectedCase!.caseName}
                        />
                      );
                    })()}
                  <span className="flex min-w-0 flex-col">
                    {p.detectedCase ? (
                      <>
                        <span className="text-[0.74rem] font-medium text-ink truncate">
                          {p.detectedCase.caseName}
                        </span>
                        <span className="mt-0.5 text-[0.56rem] text-ink-3 font-mono">
                          {p.detectedCase.caseNumber}
                        </span>
                      </>
                    ) : (
                      <span className="text-[0.64rem] text-ink-3/50">—</span>
                    )}
                  </span>
                </span>

                <MovesSeq tokens={p.display} aufMoves={p.auf} />
                <CountCell count={p.moves.length} />
              </div>
            );
          })}

          {/* ── OLL Row ── */}
          {recon.oll && (
            <div className={cn(ROW_GRID, ROW, ROW_LINE, seekRowCls)} {...seekRowProps(ollFrom)}>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.74rem] font-medium text-ink">{t("detection.oll")}</span>
                {recon.oll.skipped && <SkippedBadge className="mt-0.5 w-fit" />}
              </span>
              {recon.oll.detectedCase ? (
                <LastLayerCaseCell detectedCase={recon.oll.detectedCase} casesByNumber={casesByNumber} />
              ) : (
                <span className="text-[0.64rem] text-ink-3/50">—</span>
              )}
              <MovesSeq tokens={ollDisplay} />
              <CountCell count={ollMoves?.length ?? 0} />
            </div>
          )}

          {/* ── PLL Row ── */}
          {recon.pll && (
            <div className={cn(ROW_GRID, ROW, ROW_LINE, seekRowCls)} {...seekRowProps(pllStart)}>
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.74rem] font-medium text-ink">{t("detection.pll")}</span>
                {recon.pll.skipped && <SkippedBadge className="mt-0.5 w-fit" />}
              </span>
              {recon.pll.detectedCase ? (
                <LastLayerCaseCell detectedCase={recon.pll.detectedCase} casesByNumber={casesByNumber} />
              ) : (
                <span className="text-[0.64rem] text-ink-3/50">—</span>
              )}
              <MovesSeq tokens={pllDisplay} />
              <CountCell count={pllMoves?.length ?? 0} />
            </div>
          )}
        </div>
      </div>

      {/* ── Clean Understated Footer ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-surface-2/60 px-3 py-1.5 text-[0.58rem] sm:text-[0.6rem] text-ink-3 border-t border-line/60">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <span className="flex items-center gap-1">
            <RotateCcw className="size-3" />
            {t("detection.rotationCount", { count: recon.rotations.length })}
            {recon.rotations.length > 0 && (
              <span className="font-mono">
                ({recon.rotations.map((r) => r.token).join(" ")})
              </span>
            )}
          </span>

          {f2lAvg && (
            <span className="nums text-ink-2 font-mono">
              {t("detection.f2lAvg", { avg: f2lAvg })}
            </span>
          )}

          {recon.tps != null && (
            <span className="nums">{t("detection.tps", { tps: recon.tps.toFixed(2) })}</span>
          )}
        </div>

        {recon.inspection && (
          <span className="flex items-center gap-1 font-mono">
            <Eye className="size-3" /> {recon.inspection}
          </span>
        )}
      </div>
    </div>
  );
}
