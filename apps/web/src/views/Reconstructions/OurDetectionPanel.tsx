"use client";

/**
 * OurDetectionPanel — Fase 3.
 *
 * Runs the headless `analyzeSolveText` API on a reconstruction record (the
 * SAME setup + inspection + solution the ReplayEngine consumes) and renders
 * OUR state-based detection next to the reconstructor's raw phases:
 *
 *   - cross type (plain / xcross / xxcross) + cross color
 *   - per-pair F2L slots with colors, auf and premade flags
 *   - OLL / PLL with skip detection
 *   - coherence (finalSolved) + detection warnings
 *
 * Moves are displayed in the SOLVER frame (remapped through the synthetic
 * orientation timeline), so they read exactly as the reconstructor wrote them
 * and compare 1:1 with the raw text — the same dynamic notation the replay
 * shows.
 */
import { useMemo } from "react";
import {
  CheckCircle2,
  Eye,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/Insights/atoms";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  analyzeSolveText,
  type SolveReconstruction,
} from "@cubeforge/analysis-engine";
import {
  MoveTransformer,
  OrientationTable,
  getOrientationAtIndex,
} from "@cubeforge/math-core";
import type { CubeFace, CubeMoveDirection } from "@cubeforge/types";
import {
  FACE_HEX,
  colorName,
} from "@/components/Insights/SolveAnalysisPanel";
import type { ReconFullRecord } from "./reconData";

// ─── Solver-frame remap ────────────────────────────────────────────────────

/**
 * Remap a cube-frame move token to the solver frame using the orientation
 * active at `globalIndex` of the move stream. Falls back to the token as-is
 * when no timeline exists (no rotations → frames coincide).
 */
function remapToken(
  token: string,
  timeline: [number, number][] | undefined,
  globalIndex: number,
): string {
  const face = token[0] as CubeFace;
  let direction: CubeMoveDirection = 1;
  if (token.includes("'")) direction = -1;
  else if (token.includes("2")) direction = 2;
  const oi = getOrientationAtIndex(timeline, globalIndex);
  const entry = OrientationTable.ENTRIES[oi] ?? OrientationTable.IDENTITY;
  return MoveTransformer.toDisplayNotation(
    { face, direction, cubeTimestamp: 0, hostTimestamp: 0 },
    entry,
  );
}

/**
 * Remap a phase's moves to the solver frame. Each move gets its REAL global
 * index (`baseIndex + k`), where `baseIndex` is the phase's `startIndex` from
 * the detection report — not a running cursor, so it stays correct even when
 * phases are non-contiguous (late cross, capped pairs, degenerate solves).
 */
function remapPhase(
  tokens: string[],
  timeline: [number, number][] | undefined,
  baseIndex: number,
): string[] {
  return tokens.map((t, k) => remapToken(t, timeline, baseIndex + k));
}

/** Leading U moves (AUF-style) at the start of a move list. */
function leadingU(moves: string[]): string[] {
  const auf: string[] = [];
  for (const m of moves) {
    if (m[0] === "U") auf.push(m);
    else break;
  }
  return auf;
}

// ─── Color chip ────────────────────────────────────────────────────────────

function FaceChip({ face }: { face: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-block size-2.5 rounded-sm ring-1 ring-black/30 cursor-help"
          style={{ background: FACE_HEX[face] ?? "#6b7280" }}
        />
      </TooltipTrigger>
      <TooltipContent side="top">{colorName(face)}</TooltipContent>
    </Tooltip>
  );
}

// ─── Phase dot colors (matches the raw Steps table) ────────────────────────

const DOT: Record<string, string> = {
  cross: "bg-phase-blue-500",
  f2l: "bg-phase-emerald",
  oll: "bg-phase-amber",
  pll: "bg-phase-violet",
};

function Dot({ kind }: { kind: keyof typeof DOT }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", DOT[kind])} />;
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function OurDetectionPanel({ record }: { record: ReconFullRecord }) {
  // Only CFOP on a 3×3 makes sense for the state-based CFOP detector.
  const canDetect =
    record.methodGroup === "CFOP" && record.puzzle === "3x3";

  const result = useMemo(() => {
    if (!canDetect) return null;
    return analyzeSolveText({
      setup: record.scramble,
      // The embedded "// Inspection" phase is handled/deduped by the API
      // itself, so we pass the baked field only when present.
      inspection: record.recognition.inspection || undefined,
      solution: record.text,
      method: "CFOP",
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
  const timeline = recon.orientationTimeline;
  const reportPhases = report?.phases ?? [];

  // Real global indices from the detection report (startIndex/endIndex are
  // timeline-entry indices, exactly the space of orientationTimeline). A
  // running cursor would misalign OLL/PLL when the cross completes late or
  // pairs get capped — these never do.
  const crossPhase = reportPhases.find((p) => p.phaseName === "Cross");
  const ollPhase = reportPhases.find((p) => p.phaseName === "OLL");
  const pllPhase = reportPhases.find((p) => p.phaseName === "PLL");
  const crossStart = crossPhase?.startIndex ?? 0;
  const crossMoves = remapPhase(recon.cross.moves, timeline, crossStart);

  // Pairs are contiguous: the first starts after the cross ends, each next
  // after the previous one completed (same segmentStart logic as buildPairs).
  let pairStart = (crossPhase?.endIndex ?? crossStart + crossMoves.length - 1) + 1;
  const pairs = recon.pairs.map((p) => {
    const moves = remapPhase(p.moves, timeline, pairStart);
    pairStart = p.completionIndex + 1;
    // Re-derive auf from the SOLVER-frame moves so the chip matches the
    // moves column (the API's auf is in cube frame).
    const auf = leadingU(moves);
    return { ...p, moves, auf };
  });

  const ollMoves =
    recon.oll && ollPhase?.startIndex != null
      ? remapPhase(recon.oll.moves, timeline, ollPhase.startIndex)
      : recon.oll
        ? remapPhase(recon.oll.moves, timeline, pairStart)
        : null;
  const pllStart =
    pllPhase?.startIndex ?? (ollMoves ? pairStart + ollMoves.length : pairStart);
  const pllMoves = recon.pll
    ? remapPhase(recon.pll.moves, timeline, pllStart)
    : null;

  const totalMoves =
    crossMoves.length +
    pairs.reduce((n, p) => n + p.moves.length, 0) +
    (ollMoves?.length ?? 0) +
    (pllMoves?.length ?? 0);

  const crossColor = recon.crossColor;
  const isXCross = recon.cross.type !== "plain";
  const warnings = report?.warnings ?? [];

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <SectionHeader title="Our detection" eyebrow="by cube state · CFOP" />
        <div className="flex items-center gap-2">
          {warnings.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 rounded border border-caution/40 bg-caution/10 px-1.5 py-0.5 text-[0.58rem] font-semibold text-caution">
                  <TriangleAlert className="size-3" />
                  {warnings.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <ul className="list-disc pl-4 font-mono text-[0.62rem]">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
          <span
            className={cn(
              "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.58rem] font-medium",
              recon.finalSolved
                ? "border-ready/40 bg-ready/10 text-ready"
                : "border-caution/40 bg-caution/10 text-caution",
            )}
          >
            {recon.finalSolved ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {recon.finalSolved ? "Coherent" : "Inconsistent"}
          </span>
          <span className="nums text-xs text-ink-3">{totalMoves} moves</span>
        </div>
      </div>

      {/* ── Cross ── */}
      <div className="grid grid-cols-[0.75rem_7.5rem_auto_1fr_2.75rem] items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2">
        <Dot kind="cross" />
        <span className="text-[0.74rem] font-medium text-ink">Cross</span>
        <span className="flex items-center gap-1.5">
          {isXCross && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide cursor-help",
                    recon.cross.type === "xxcross"
                      ? "border border-caution/40 bg-caution/10 text-caution"
                      : "border border-phase-violet/40 bg-phase-violet/10 text-phase-violet",
                  )}
                >
                  {recon.cross.type}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {recon.cross.xcrossPair
                  ? `${recon.cross.xcrossPair.name} pair solved at cross completion`
                  : "An F2L pair was already solved at cross completion"}
              </TooltipContent>
            </Tooltip>
          )}
          {crossColor && <FaceChip face={crossColor} />}
        </span>
        <span className="min-w-0 truncate font-mono text-[0.66rem] text-ink-2">
          {crossMoves.join(" ")}
        </span>
        <span className="nums text-right text-xs text-ink-2">
          {crossMoves.length}
        </span>
      </div>

      {/* ── F2L pairs ── */}
      {pairs.map((p, i) => (
        <div
          key={p.slot}
          className="grid grid-cols-[0.75rem_7.5rem_auto_1fr_2.75rem] items-center gap-2 border-t border-line/60 px-3 py-2 transition-colors hover:bg-surface-2"
        >
          <Dot kind="f2l" />
          <span className="text-[0.74rem] font-medium text-ink">
            F2L {i + 1}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[0.56rem] font-medium text-ink-2">
              {p.slot}
            </span>
            {p.colors.map((c) => (
              <FaceChip key={c} face={c} />
            ))}
            {p.premade && (
              <span className="rounded border border-ready/40 bg-ready/10 px-1 py-0.5 text-[0.54rem] font-semibold uppercase tracking-wide text-ready">
                premade
              </span>
            )}
            {p.auf.length > 0 && (
              <span className="rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.54rem] text-ink-3">
                auf {p.auf.join(" ")}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-mono text-[0.66rem] text-ink-2">
            {p.moves.join(" ")}
          </span>
          <span className="nums text-right text-xs text-ink-2">
            {p.moves.length}
          </span>
        </div>
      ))}

      {/* ── OLL / PLL ── */}
      {recon.oll && (
        <div className="grid grid-cols-[0.75rem_7.5rem_auto_1fr_2.75rem] items-center gap-2 border-t border-line/60 px-3 py-2 transition-colors hover:bg-surface-2">
          <Dot kind="oll" />
          <span className="text-[0.74rem] font-medium text-ink">OLL</span>
          <span className="flex items-center gap-1.5">
            {recon.oll.skipped && (
              <span className="rounded border border-ready/40 bg-ready/10 px-1 py-0.5 text-[0.54rem] font-semibold uppercase tracking-wide text-ready">
                skipped
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-mono text-[0.66rem] text-ink-2">
            {ollMoves?.join(" ")}
          </span>
          <span className="nums text-right text-xs text-ink-2">
            {ollMoves?.length ?? 0}
          </span>
        </div>
      )}
      {recon.pll && (
        <div className="grid grid-cols-[0.75rem_7.5rem_auto_1fr_2.75rem] items-center gap-2 border-t border-line/60 px-3 py-2 transition-colors hover:bg-surface-2">
          <Dot kind="pll" />
          <span className="text-[0.74rem] font-medium text-ink">PLL</span>
          <span className="flex items-center gap-1.5">
            {recon.pll.skipped && (
              <span className="rounded border border-ready/40 bg-ready/10 px-1 py-0.5 text-[0.54rem] font-semibold uppercase tracking-wide text-ready">
                skipped
              </span>
            )}
          </span>
          <span className="min-w-0 truncate font-mono text-[0.66rem] text-ink-2">
            {pllMoves?.join(" ")}
          </span>
          <span className="nums text-right text-xs text-ink-2">
            {pllMoves?.length ?? 0}
          </span>
        </div>
      )}

      {/* ── Footer: rotations + tps ── */}
      <div className="flex items-center gap-3 border-t border-line bg-surface-2/60 px-3 py-1.5 text-[0.6rem] text-ink-3">
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
