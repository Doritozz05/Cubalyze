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
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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
} from "@cubeforge/analysis-engine";
import {
  CASE_RENDER_GRAY,
  getSeedData,
  getSubset,
  resolveVisualizationStyleForSubset,
  type AlgorithmCase,
} from "@cubeforge/algorithm-db";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { isRotation, tokenize } from "@cubeforge/math-core";
import { Global3DSnapshotService } from "@/services/Global3DSnapshotService";
import { FACE_HEX } from "@/components/Insights/atoms/faceColors";
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

// ─── Mini case cube (3D snapshot, recolored to the solve's colors) ──────────

/**
 * Order a pair's two colors for the canonical FR mini-case render, as the
 * pair is seen from outside the cube: the L sticker goes LEFT (FL/BL —
 * orange-left/green-right, the mirror of FR instead of a duplicate), else
 * the F sticker (FR — green-left/red-right), else the B sticker (BR —
 * blue-left/red-right), else R (side-cross slots). Mirrors are always
 * distinct — never two pairs that both look green-left.
 *
 * The engine's `leftColor`/`rightColor` (read from the ACTUAL sticker
 * faces in the detection frame — scheme-applied, rotation independent)
 * replace this whenever present; this is the defensive fallback for
 * unreadable completion states, applied to the canonical slot letters.
 */
function orderPairColors(
  a: string | undefined,
  b: string | undefined,
): [string | undefined, string | undefined] {
  if (a == null || b == null) return [a, b];
  const pair = [a, b];
  const left = pair.includes("L")
    ? "L"
    : pair.includes("F")
      ? "F"
      : pair.includes("B")
        ? "B"
        : pair.includes("R")
          ? "R"
          : a;
  const right = pair.find((c) => c !== left) ?? b;
  return [left, right];
}

/** Sticker-color override for the mini cube: the reconstruction's REAL
 *  colors — cross color on the bottom (D), the pair's LEFT color on the
 *  front (F), its RIGHT color on the right (R) — with the top, back and
 *  left faces neutral. The engine paints every sticker by its LOCAL cubie
 *  face, so the pair pieces (DFR corner = D/F/R stickers, FR edge = F/R
 *  stickers) always show exactly cross + pair colors wherever the case
 *  places them; the F2L mask grays everything that is not the pair. The
 *  case geometry is the canonical setup, untouched. `left` and `right`
 *  arrive ALREADY ordered (from the engine's sticker read, or the
 *  orderPairColors fallback) — no rotation logic here. */
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

/** Tiny 3D snapshot of a case (shared offscreen WebGL engine + cache). */
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
        // WebGL unavailable — the row keeps showing names + color chips.
      });
    return () => {
      alive = false;
    };
  }, [service, caseData, slotIndex, stickerColors]);

  if (!url) {
    return (
      <span
        className="block size-10 shrink-0 animate-pulse rounded-md border border-line bg-surface-2/40"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className="pointer-events-none size-10 shrink-0 rounded-md border border-line bg-surface-2/40 object-contain"
    />
  );
}

// Grid layout: parent wrapper defines the shared 4-column tracks so all rows
// align to the same column widths (the Case column uses max-content across all
// rows so the Moves column forms a perfectly straight vertical baseline).
const GRID_CONTAINER = "grid grid-cols-[7.5rem_minmax(5rem,max-content)_1fr_2.75rem]";
const ROW_GRID = "grid grid-cols-subgrid col-span-4";
const ROW = "items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2";
const ROW_LINE = "border-b border-line";

/** Moves column: every token rendered identically (face moves and
 *  rotations alike), sized/colored exactly like the phase titles so the
 *  algorithm reads as strong as its label. Wraps naturally when reaching
 *  the # column. */
function MovesSeq({ tokens }: { tokens: string[] | null }) {
  if (!tokens || tokens.length === 0) {
    return <span className="text-[0.74rem] text-ink-3">—</span>;
  }
  return (
    <span className="min-w-0 wrap-break-word whitespace-normal font-mono text-[0.74rem] font-medium text-ink leading-relaxed">
      {tokens.join(" ")}
    </span>
  );
}

function CountCell({ count }: { count: number }) {
  return <span className="nums text-right text-xs text-ink-2 whitespace-nowrap">{count}</span>;
}

/**
 * CSS rotation (degrees) that turns the canonical 2D case diagram so it
 * matches the angle the solver held the cube. `aufFace` is the sticker on
 * the U face that sat at the solver's F position when the case was
 * detected; rotating the diagram to bring that sticker to the bottom (F)
 * reproduces the solver's exact view.
 *
 * The diagram's U face is laid out B / L·U·R / F (F at the bottom). A CSS
 * `rotate(θ)` turns clockwise, so bringing the R sticker down needs 90°,
 * B needs 180°, L needs 270°. F (or no AUF) needs no rotation.
 */
function aufRotationDeg(aufFace?: string): number {
  switch (aufFace) {
    case "R":
      return 90;
    case "B":
      return 180;
    case "L":
      return 270;
    default:
      return 0; // 'F' or unknown — already facing the solver
  }
}

/**
 * The detected last-layer case rendered as a 2D diagram rotated to the
 * solver's exact AUF angle, with the case name/number underneath.
 */
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
        className="size-10 shrink-0 rounded-md border border-line bg-surface-2/40"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.74rem] font-medium text-ink">
          {detectedCase.caseName}
        </span>
        <span className="mt-0.5 text-[0.56rem] text-ink-3">
          {detectedCase.caseNumber}
        </span>
      </span>
    </span>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function OurDetectionPanel({
  record,
  onSeekToMove,
}: {
  record: ReconFullRecord;
  /**
   * Clicking a phase row seeks the 3D replay to the state right before that
   * phase's first move (the last move of the previous phase applied). The
   * index is in replay-EVENT space (the `solve.moves` array the ReplaySection
   * consumes).
   */
  onSeekToMove?: (moveIndex: number) => void;
}) {
  const { t } = useTranslation("reconstructions");
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

  // Case lookup for the mini 3D cubes: seed cases indexed by caseNumber
  // (and name as a fallback), so a detectedCase can render its diagram.
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
    // analyzeSolveText throwing is a REGRESSION BUG in the API (it is built
    // to never throw on incoherent transcripts) — surface it, don't hide it.
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

  // ── Row → replay seek mapping ─────────────────────────────────────────────
  // Detection indices (phase startIndex, rotation/slice moveIndex) live in
  // TIMELINE-ENTRY space: one entry per FACE token — rotations and standalone
  // slices share the index of the move they precede (they never occupy an
  // entry). The replay `solve.moves` array is one event per written token
  // with rotations dropped (wides stay whole, slices keep their event). So
  // the number of replay events that have run when the phase at entry `S`
  // begins is exactly `S` face tokens + every slice pointing before `S`:
  //
  //   eventsBefore(S) = S + #{ slices with moveIndex < S }
  //
  // Seeking with `eventsBefore(S) - 1` applied leaves the cube at the last
  // move of the previous phase — OLL lands on the last F2L4 move, PLL on
  // the last OLL move, cross on the scrambled start.
  const solveSlicesAll = recon.slices ?? [];
  const eventsBeforeEntry = (entryIdx: number): number =>
    entryIdx +
    solveSlicesAll.filter((s) => s.moveIndex < entryIdx).length;
  const seekToEntry = (entryIdx: number) => {
    onSeekToMove?.(eventsBeforeEntry(entryIdx) - 1);
  };
  // Clickable rows (pointer + keyboard) — only when a seek handler exists.
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
  // Rows that can seek the replay (Cross, pairs, OLL, PLL) get a pointer
  // cursor when a seek handler is wired up.
  const seekRowCls = onSeekToMove ? " cursor-pointer" : "";

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <SectionHeader title={t("detection.title")} eyebrow={t("detection.eyebrow")} />
        <div className="flex items-center gap-2">
          <WarningsBadge warnings={warnings} />
          <CoherenceBadge coherent={recon.finalSolved} />
          <span className="nums text-xs text-ink-3">
            {t("detail.movesCount", { count: totalMoves })}
          </span>
        </div>
      </div>

      {/* ── Outer table grid container for subgrid alignment ── */}
      <div className={GRID_CONTAINER}>
        {/* ── Column headers ── */}
      <div
        className={cn(
          ROW_GRID,
          "items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-wider text-ink-3",
        )}
      >
        <span className="whitespace-nowrap">{t("detail.colPhase")}</span>
        <span className="whitespace-nowrap">{t("detail.colCase")}</span>
        <span className="whitespace-nowrap">{t("detail.colMoves")}</span>
        <span className="text-right whitespace-nowrap">#</span>
      </div>

      {/* ── Orientation row: up/front after grip (case) + inspection rot. ── */}
      <div className={cn(ROW_GRID, ROW, ROW_LINE)}>
        <span className="text-[0.74rem] font-medium text-ink whitespace-nowrap">{t("detection.orientation")}</span>
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

      {/* ── Cross ── */}
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

      {/* ── F2L pairs ── */}
      {pairs.map((p, i) => {
        // The pair's two colors ALREADY ordered for the canonical FR
        // mini-case render (LEFT of the image = render F face, RIGHT =
        // render R face): the engine's scheme-applied sticker read (real
        // physical colors, rotation independent) when present, else the
        // canonical slot letters ordered with the same L→F→R rule.
        const [leftColor, rightColor] =
          p.leftColor && p.rightColor
            ? [p.leftColor, p.rightColor]
            : orderPairColors(p.colors[0], p.colors[1]);
        const pairColors = [leftColor, rightColor];
        const stickerColors =
          crossColor && pairColors.every((c) => c != null)
            ? pairStickerColors(crossColor, leftColor!, rightColor!)
            : null;
        return (
        <div key={p.slot} className={cn(ROW_GRID, ROW, ROW_LINE, seekRowCls)} {...seekRowProps(p.from)}>
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
                  <span className="text-[0.74rem] font-medium text-ink">
                    {p.detectedCase.caseName}
                  </span>
                  <span className="mt-0.5 text-[0.56rem] text-ink-3">
                    {p.detectedCase.caseNumber}
                  </span>
                </>
              ) : (
                <span className="text-[0.64rem] text-ink-3/50">—</span>
              )}
            </span>
          </span>          <span className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <MovesSeq tokens={p.display} />
            {p.auf.length > 0 && (
              <span className="shrink-0 rounded border border-line bg-surface-2 px-1 py-0.5 font-mono text-[0.54rem] text-ink-3">
                {t("detection.auf", { moves: p.auf.join(" ") })}
              </span>
            )}
          </span>
          <CountCell count={p.moves.length} />
        </div>
        );
      })}

      {/* ── OLL / PLL ── */}
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

      {/* ── Footer: rotations + tps ── */}
      <div className="flex items-center gap-3 bg-surface-2/60 px-3 py-1.5 text-[0.6rem] text-ink-3">
        <span className="flex items-center gap-1">
          <RotateCcw className="size-3" />
          {t("detection.rotationCount", { count: recon.rotations.length })}
          {recon.rotations.length > 0 && (
            <span className="font-mono">
              ({recon.rotations.map((r) => r.token).join(" ")})
            </span>
          )}
        </span>
        {recon.tps != null && (
          <span className="nums">{t("detection.tps", { tps: recon.tps.toFixed(2) })}</span>
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
