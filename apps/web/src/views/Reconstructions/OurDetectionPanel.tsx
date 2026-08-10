"use client";

/**
 * OurDetectionPanel — Fase 3.
 *
 * Runs the headless `analyzeSolveText` API on a reconstruction record (the
 * SAME setup + inspection + solution the ReplayEngine consumes) and renders
 * OUR state-based detection next to the reconstructor's raw phases, in the
 * Table shape (Phase | Case | Moves | #):
 *
 *   - Orientation row: inspection rotations + colors on U and F after the grip
 *   - cross type (plain / xcross / xxcross) + cross color
 *   - per-pair F2L slots with colors and auf
 *   - OLL / PLL with skip detection
 *   - coherence (finalSolved) + detection warnings
 *   - rotations are shown interleaved in the moves column of their phase
 *     (never counted in the # column), exactly as the reconstructor writes them
 *
 * Moves arrive from `analyzeSolveText` in the SOLVER's raw notation (wide
 * moves as written: r', u2, … — one token per timeline entry), so they read
 * exactly as the reconstructor wrote them and compare 1:1 with the raw text.
 * Rotations are interleaved back at their entry position. Slot labels and
 * pair colors sit with the phase: the slot chip below the phase name, colors
 * to its right.
 */
import { useMemo } from "react";
import { Eye, RotateCcw } from "lucide-react";
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
import { isRotation, tokenize } from "@cubeforge/math-core";
import type { ReconFullRecord } from "./reconData";

// ─── Moves arrive in the solver's raw notation (one token per entry) ──────

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
  if (moves.length === 0) return []; // a skipped phase owns no moves
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

// Grid: Phase | Case | Moves | # — same template as the raw Steps table,
// so both panels align visually. Every data row carries a full-strength
// bottom border (like the one under the header).
const ROW_GRID = "grid grid-cols-[7.5rem_6.5rem_1fr_2.75rem]";
const ROW = "items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2";
const ROW_LINE = "border-b border-line";

/** Moves column: every token rendered identically (face moves and
 *  rotations alike), sized/colored exactly like the phase titles so the
 *  algorithm reads as strong as its label. */
function MovesSeq({ tokens }: { tokens: string[] | null }) {
  if (!tokens || tokens.length === 0) {
    return <span className="text-[0.74rem] text-ink-3">—</span>;
  }
  return (
    <span className="min-w-0 truncate font-mono text-[0.74rem] font-medium text-ink">
      {tokens.join(" ")}
    </span>
  );
}

function CountCell({ count }: { count: number }) {
  return <span className="nums text-right text-xs text-ink-2">{count}</span>;
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function OurDetectionPanel({ record }: { record: ReconFullRecord }) {
  // Only CFOP on a 3×3 makes sense for the state-based CFOP detector.
  const canDetect =
    record.methodGroup === "CFOP" && record.puzzle === "3x3";

  const result = useMemo(() => {
    if (!canDetect) return null;
    // normalizeReconMoves already ran the analysis once at load (it also
    // fills the Cross STM / F2L / LL stat chips from the same result) — reuse
    // it so the chips and this table always agree. Fall back to computing for
    // records that were not normalized (defensive).
    if (record.ourDetection !== undefined) return record.ourDetection;
    return analyzeSolveText({
      setup: record.scramble,
      // The embedded "// Inspection" phase is handled/deduped by the API
      // itself, so we pass the baked field only when present.
      inspection: record.recognition.inspection || undefined,
      solution: record.text,
      method: "CFOP",
      // Same relaxed-cross mode as reconData's deriveReconStats — this is the
      // defensive fallback path and must agree with the shared analysis.
      relaxedCross: true,
      totalTimeMs: record.time > 0 ? record.time * 1000 : undefined,
    });
  }, [canDetect, record]);

  const failed = result === null && canDetect;

  if (failed) {
    // analyzeSolveText throwing is a REGRESSION BUG in the API (it is built
    // to never throw on incoherent transcripts) — surface it, don't hide it.
    return (
      <div className="mt-4 rounded-lg border border-caution/40 bg-caution/5 px-3 py-2.5 text-[0.66rem] text-caution">
        Our detection failed to analyze this solve (API error). This is a bug
        — the incoherence path is supposed to be handled internally.
      </div>
    );
  }

  if (!result) return null;
  const recon: SolveReconstruction = result.reconstruction;
  const report = result.timeline.detectionReport;
  const reportPhases = report?.phases ?? [];

  // Real global indices from the detection report (startIndex/endIndex are
  // timeline-entry indices, exactly the space of orientationTimeline). A
  // running cursor would misalign OLL/PLL when the cross completes late or
  // pairs get capped — these never do.
  const crossPhase = reportPhases.find((p) => p.phaseName === "Cross");
  const ollPhase = reportPhases.find((p) => p.phaseName === "OLL");
  const pllPhase = reportPhases.find((p) => p.phaseName === "PLL");
  const crossStart = crossPhase?.startIndex ?? 0;
  const crossEnd = crossPhase?.endIndex ?? crossStart + recon.cross.moves.length - 1;
  // Moves are already the SOLVER's raw notation (wides as written, one token
  // per timeline entry) — no remap needed.
  const crossMoves = recon.cross.moves;

  // Rotations are entry-indexed by the API (inspection ones first, always at
  // moveIndex 0). Slice the inspection ones off for the solve-phase rows.
  const inspectionRotationCount = tokenize(recon.inspection).filter(isRotation)
    .length;
  const inspectionRotations = recon.rotations.slice(0, inspectionRotationCount);
  const solveRotations = recon.rotations.slice(inspectionRotationCount);
  // Standalone slice moves (M/E/S) have no timeline entry; they are reported
  // with the entry index of the move they precede and interleaved exactly
  // like rotations so the algorithm reads 1:1 with the raw text.
  const solveSlices = recon.slices ?? [];
  const interleavables = (
    rots: { token: string; moveIndex: number }[],
    from: number,
    to: number,
  ) => [
    ...rots.filter((r) => r.moveIndex >= from && r.moveIndex <= to),
    ...solveSlices.filter((s) => s.moveIndex >= from && s.moveIndex <= to),
  ];

  // Pairs are contiguous: the first starts after the cross ends, each next
  // after the previous one completed (same segmentStart logic as buildPairs).
  let pairStart = crossEnd + 1;
  const pairs = recon.pairs.map((p) => {
    const from = pairStart;
    const moves = p.moves; // already the solver's raw notation
    pairStart = p.completionIndex + 1;
    const auf = leadingU(moves);
    // Rotation/slice range covers the DISPLAY span — the API extends the
    // last pair through the F2L end, so a rotation in that tail must stay
    // visible.
    const rots = interleavables(
      solveRotations,
      from,
      from + moves.length - 1,
    );
    return { ...p, moves, auf, display: interleave(moves, rots, from) };
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

  const crossColor = recon.crossColor;
  const isXCross = recon.cross.type !== "plain";
  // How many F2L pairs were already solved INSIDE the cross: the detected
  // F2L pairs then continue after them (xcross → pairs 2-4, xxcross → 3-4,
  // xxxcross → only the 4th), matching how the raw labels them.
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

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <SectionHeader title="Our detection" eyebrow="CFOP" />
        <div className="flex items-center gap-2">
          <WarningsBadge warnings={warnings} />
          <CoherenceBadge coherent={recon.finalSolved} />
          <span className="nums text-xs text-ink-3">{totalMoves} moves</span>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div
        className={cn(
          ROW_GRID,
          "items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3",
        )}
      >
        <span>Phase</span>
        <span>Case</span>
        <span>Moves</span>
        <span className="text-right">#</span>
      </div>

      {/* ── Orientation row: up/front after grip (case) + inspection rot. ── */}
      <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
        <span className="text-[0.74rem] font-medium text-ink">Orientation</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {orient && (
            <>
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-ink-3">
                up
              </span>
              <FaceChip face={orient.up} />
              <span className="ml-1 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-3">
                front
              </span>
              <FaceChip face={orient.front} />
            </>
          )}
          {!orient && <span className="text-[0.64rem] text-ink-3">—</span>}
        </span>
        <MovesSeq tokens={inspectionTokens.length > 0 ? inspectionTokens : null} />
        <span className="nums text-right text-xs text-ink-3">—</span>
      </div>

      {/* ── Cross ── */}
      <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.74rem] font-medium text-ink">Cross</span>
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
                    ? "The written cross block never contained a real cross (edges left misordered / partial — fixed inside the F2L pairs)"
                    : recon.cross.xcrossPair
                      ? `${recon.cross.xcrossPair.name} pair solved at cross completion`
                      : "An F2L pair was already solved at cross completion"}
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

      {/* ── F2L pairs ── */}
      {pairs.map((p, i) => (
        <div key={p.slot} className={cn(ROW_GRID, ROW, ROW_LINE)}>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.74rem] font-medium text-ink">
              {p.slot ? `F2L ${crossPairCount + i + 1}` : "F2L"}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5">
              {p.slot ? (
                <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.56rem] font-medium text-ink-2">
                  {p.slot}
                </span>
              ) : (
                <span className="text-[0.64rem] text-ink-3">
                  (no pair segmentation)
                </span>
              )}
              {p.colors.map((c) => (
                <FaceChip key={c} face={c} />
              ))}
            </span>
          </span>
          <span className="text-[0.64rem] text-ink-3/50">—</span>
          <span className="min-w-0">
            <MovesSeq tokens={p.display} />
            {p.auf.length > 0 && (
              <span className="ml-2 rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.54rem] text-ink-3">
                auf {p.auf.join(" ")}
              </span>
            )}
          </span>
          <CountCell count={p.moves.length} />
        </div>
      ))}

      {/* ── OLL / PLL ── */}
      {recon.oll && (
        <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.74rem] font-medium text-ink">OLL</span>
            {recon.oll.skipped && <SkippedBadge className="mt-0.5 w-fit" />}
          </span>
          <span className="text-[0.64rem] text-ink-3/50">—</span>
          <MovesSeq tokens={ollDisplay} />
          <CountCell count={ollMoves?.length ?? 0} />
        </div>
      )}
      {recon.pll && (
        <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
          <span className="flex min-w-0 flex-col">
            <span className="text-[0.74rem] font-medium text-ink">PLL</span>
            {recon.pll.skipped && <SkippedBadge className="mt-0.5 w-fit" />}
          </span>
          <span className="text-[0.64rem] text-ink-3/50">—</span>
          <MovesSeq tokens={pllDisplay} />
          <CountCell count={pllMoves?.length ?? 0} />
        </div>
      )}

      {/* ── Footer: rotations + tps ── */}
      <div className="flex items-center gap-3 bg-surface-2/60 px-3 py-1.5 text-[0.6rem] text-ink-3">
        <span className="flex items-center gap-1">
          <RotateCcw className="size-3" />
          {recon.rotations.length} rotation{recon.rotations.length !== 1 ? "s" : ""}
          {recon.rotations.length > 0 && (
            <span className="font-mono">
              ({recon.rotations.map((r) => r.token).join(" ")})
            </span>
          )}
        </span>
        {recon.tps != null && (
          <span className="nums">{recon.tps.toFixed(2)} tps</span>
        )}
        {recon.inspection && (
          <span className="flex items-center gap-1 font-mono">
            <Eye className="size-3" /> {recon.inspection}
          </span>
        )}
      </div>
    </div>
  );
}
