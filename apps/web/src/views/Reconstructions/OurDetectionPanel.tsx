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
 */
import { useEffect, useMemo, useState, type KeyboardEvent, useCallback } from "react";
import { Eye, RotateCcw, Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
} from "@cubeforge/analysis-engine";
import {
  CASE_RENDER_GRAY,
  getSeedData,
  getSubset,
  resolveVisualizationStyleForSubset,
  type AlgorithmCase,
} from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { isRotation, orderPairFaces, tokenize } from "@cubeforge/math-core";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";
import { FACE_HEX } from "@/components/Insights/atoms/faceColors";
import type { ReconFullRecord } from "./reconData";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Leading U moves (AUF-style) at the start of a move list. */
function leadingU(moves: string[]): string[] {
  const auf: string[] = [];
  for (const m of moves) {
    if (m[0] === "U") auf.push(m);
    else break;
  }
  return auf;
}

/** Rotations of a phase, interleaved into the face moves at their position. */
function interleave(
  moves: string[],
  rots: { token: string; moveIndex: number }[],
  from: number,
): string[] {
  if (moves.length === 0) return [];
  const sorted = [...rots].sort((a, b) => a.moveIndex - b.moveIndex);
  if (sorted.length === 0) return moves;
  const out: string[] = [];
  let ri = 0;
  for (let k = 0; k < moves.length; k++) {
    while (ri < sorted.length && sorted[ri].moveIndex <= from + k)
      out.push(sorted[ri++].token);
    out.push(moves[k]);
  }
  while (ri < sorted.length) out.push(sorted[ri++].token);
  return out;
}

/** Order pair colors for canonical FR mini-case render */
function orderPairColors(
  a: string | undefined,
  b: string | undefined,
  crossColor?: string,
): [string | undefined, string | undefined] {
  if (a == null || b == null) return [a, b];
  return orderPairFaces(crossColor ?? "D", a, b);
}

function pairStickerColors(
  crossColor: string,
  leftColor: string,
  rightColor: string,
): Record<string, string> {
  return {
    U: CASE_RENDER_GRAY,
    D: FACE_HEX[crossColor] ?? crossColor,
    F: FACE_HEX[leftColor] ?? leftColor,
    R: FACE_HEX[rightColor] ?? rightColor,
    B: CASE_RENDER_GRAY,
    L: CASE_RENDER_GRAY,
  };
}

/** CSS rotation for AUF angle in 2D diagram */
function aufRotationDeg(aufFace?: string): number {
  switch (aufFace) {
    case "R":
      return 90;
    case "B":
      return 180;
    case "L":
      return 270;
    default:
      return 0;
  }
}

// ─── Table Grid Layout Constants ────────────────────────────────────────────

const GRID_CONTAINER =
  "grid min-w-[26rem] sm:min-w-0 grid-cols-[5.5rem_minmax(4.5rem,max-content)_1fr_2.25rem] sm:grid-cols-[6.5rem_minmax(5rem,max-content)_1fr_2.5rem] xl:grid-cols-[7.5rem_minmax(5.5rem,max-content)_1fr_2.75rem]";
const ROW_GRID = "grid grid-cols-subgrid col-span-4";
const ROW = "items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 transition-colors hover:bg-surface-2";
const ROW_LINE = "border-b border-line";

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Tiny 3D snapshot of an F2L case (shared offscreen WebGL engine + cache). */
function CaseMiniCube({
  caseData,
  slotIndex,
  stickerColors,
  alt,
}: {
  caseData: AlgorithmCase;
  slotIndex: number;
  stickerColors?: Record<string, string> | null;
  alt: string;
}) {
  const service = Global3DSnapshotService.getInstance();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    service
      .requestSnapshot(caseData, {
        selectedSlot: slotIndex,
        stickerColors: stickerColors ?? undefined,
      })
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        // WebGL unavailable fallback
      });
    return () => {
      alive = false;
    };
  }, [service, caseData, slotIndex, stickerColors]);

  if (!url) {
    return (
      <span
        className="block size-8 sm:size-10 shrink-0 animate-pulse rounded-md border border-line bg-surface-2/40"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className="pointer-events-none size-8 sm:size-10 shrink-0 rounded-md border border-line bg-surface-2/40 object-contain"
    />
  );
}

/** Last layer 2D rotated case diagram */
function LastLayerCaseCell({
  detectedCase,
  casesByNumber,
}: {
  detectedCase: NonNullable<NonNullable<SolveReconstruction["oll"]>["detectedCase"]>;
  casesByNumber: Map<string, AlgorithmCase>;
}) {
  const caseData =
    casesByNumber.get(detectedCase.caseNumber) ??
    casesByNumber.get(detectedCase.caseName);
  if (!caseData) return null;
  const subset = getSubset(caseData.subsetId);
  const style = resolveVisualizationStyleForSubset(subset?.name);
  const rotation = aufRotationDeg(detectedCase.aufFace);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <CaseDiagram
        setupScramble={caseData.setupScramble}
        style={style}
        rotation={rotation}
        className="size-8 sm:size-10 shrink-0 rounded-md border border-line bg-surface-2/40"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.74rem] font-medium text-ink truncate">
          {detectedCase.caseName}
        </span>
        <span className="mt-0.5 text-[0.56rem] text-ink-3 font-mono">
          {detectedCase.caseNumber}
        </span>
      </span>
    </span>
  );
}

/** Clean Moves Sequence with subtle AUF pill and quiet copy */
function MovesSeq({
  tokens,
  aufMoves,
}: {
  tokens: string[] | null;
  aufMoves?: string[];
}) {
  const { t } = useTranslation("reconstructions");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!tokens || tokens.length === 0) return;
      try {
        await navigator.clipboard.writeText(tokens.join(" "));
        setCopied(true);
        toast.success(t("detection.copiedAlg"));
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable */
      }
    },
    [tokens, t],
  );

  if (!tokens || tokens.length === 0) {
    return <span className="text-[0.74rem] text-ink-3">—</span>;
  }

  return (
    <div className="group/seq flex min-w-0 items-center gap-2">
      <span className="min-w-0 wrap-break-word whitespace-normal font-mono text-[0.74rem] font-medium text-ink leading-relaxed">
        {tokens.join(" ")}
      </span>

      {aufMoves && aufMoves.length > 0 && (
        <span className="shrink-0 rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.54rem] text-ink-3">
          {t("detection.auf", { moves: aufMoves.join(" ") })}
        </span>
      )}

      <button
        type="button"
        onClick={handleCopy}
        title={t("detection.copyAlg")}
        aria-label={t("detection.copyAlg")}
        className="opacity-0 group-hover/seq:opacity-100 transition-opacity p-0.5 rounded text-ink-3 hover:text-ink hover:bg-surface-3 cursor-pointer shrink-0"
      >
        {copied ? (
          <Check className="size-3 text-ready" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}

function CountCell({ count }: { count: number }) {
  return <span className="nums text-right text-xs text-ink-2 tabular-nums whitespace-nowrap">{count}</span>;
}

/** Minimal CFOP distribution bar in the table header */
function CfopMiniBar({
  crossMoves,
  f2lMoves,
  ollMoves,
  pllMoves,
  totalMoves,
}: {
  crossMoves: number;
  f2lMoves: number;
  ollMoves: number;
  pllMoves: number;
  totalMoves: number;
}) {
  if (totalMoves <= 0) return null;
  const crossPct = (crossMoves / totalMoves) * 100;
  const f2lPct = (f2lMoves / totalMoves) * 100;
  const ollPct = (ollMoves / totalMoves) * 100;
  const pllPct = (pllMoves / totalMoves) * 100;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-surface-3 border border-line/60">
          <div style={{ width: `${crossPct}%` }} className="h-full bg-phase-blue" />
          <div style={{ width: `${f2lPct}%` }} className="h-full bg-phase-emerald" />
          <div style={{ width: `${ollPct}%` }} className="h-full bg-phase-amber" />
          <div style={{ width: `${pllPct}%` }} className="h-full bg-phase-violet" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-mono">
        <div>Cross: {crossMoves}m ({crossPct.toFixed(0)}%)</div>
        <div>F2L: {f2lMoves}m ({f2lPct.toFixed(0)}%)</div>
        <div>OLL: {ollMoves}m ({ollPct.toFixed(0)}%)</div>
        <div>PLL: {pllMoves}m ({pllPct.toFixed(0)}%)</div>
      </TooltipContent>
    </Tooltip>
  );
}

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

