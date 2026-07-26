"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCube3D } from "@/hooks/useCube3D";
import { CaseStateGenerator } from "@cubeforge/algorithm-db";
import { getSkinStyle } from "@cubeforge/cube-3d-engine";
import type { AlgorithmCase, Algorithm } from "@cubeforge/algorithm-db";

export interface Case3DPanelProps {
  caseData: AlgorithmCase;
  algorithms: Algorithm[];
  onClose: () => void;
  onPracticeCase?: (subsetId: string, caseId: string) => void;
  className?: string;
}

/**
 * F2L subset IDs — used to reliably detect F2L cases regardless of
 * the `category` field (Advanced F2L uses categories like "Trapped Corner").
 */
const F2L_SUBSET_IDS = new Set([
  "00000000-0000-4000-9000-000000000003", // Basic F2L
  "00000000-0000-4000-9000-000000000004", // Advanced F2L
]);

/**
 * Slot labels + Y-axis rotation angles (in radians).
 *
 * The model root is rotated around the world-Y axis so the target slot
 * appears in the front-right (FR = +Z / +X) viewing position.
 *
 * Cubing cube rotations → Three.js Y rotation:
 *   y   = CW from above = -π/2 (negative Y in right-handed coords)
 *   y'  = CCW from above = +π/2
 *   y2  = 180°           = π
 */
const SLOT_LABELS = [
  { id: 0, key: "FR", name: "Front Right", modelYRot: 0 },
  { id: 1, key: "FL", name: "Front Left", modelYRot: Math.PI / 2 },
  { id: 2, key: "BL", name: "Back Left", modelYRot: Math.PI },
  { id: 3, key: "BR", name: "Back Right", modelYRot: -Math.PI / 2 },
];

/** Gray color used for U-layer stickers in F2L visualization. */
const F2L_GRAY = "#808080";

/**
 * Build a style that swaps U ↔ D colors so the 3D cube shows yellow on
 * top (standard CFOP solving orientation) while keeping the default skin.
 */
function buildF2LSkinStyle() {
  const base = getSkinStyle("default");
  return {
    ...base,
    stickerColors: {
      ...base.stickerColors,
      U: base.stickerColors.D, // yellow on top
      D: base.stickerColors.U, // white on bottom
      R: base.stickerColors.L, // orange on right (when Green is front & Yellow is top)
      L: base.stickerColors.R, // red on left
    },
  };
}

export function Case3DPanel({
  caseData,
  algorithms,
  onClose,
  onPracticeCase,
  className,
}: Case3DPanelProps) {
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const { canvasRef, containerRef, isReady, engineRef } = useCube3D({
    maxRecentMoves: 0,
  });

  // Track whether we've already locked the isometric camera angle
  const hasSetCameraRef = useRef(false);

  // ── Detect F2L reliably via subsetId (not category) ─────────────────
  const isF2L = F2L_SUBSET_IDS.has(caseData.subsetId);

  // Filter algorithms by selected slot
  const slotKey = SLOT_LABELS[selectedSlot]?.key ?? "FR";
  const slotAlgorithms = useMemo(() => {
    const matched = algorithms.filter(
      (a) => a.notes && a.notes.includes(`Slot: ${slotKey}`),
    );
    if (matched.length > 0) return matched;
    return algorithms;
  }, [algorithms, slotKey]);

  // ── Apply setup scramble + slot model rotation + F2L visual style ───
  useEffect(() => {
    if (!isReady || !engineRef.current) return;

    const engine = engineRef.current;
    const modelYRot = SLOT_LABELS[selectedSlot]?.modelYRot ?? 0;

    try {
      // 1. Force correct skin — swap U/D only for F2L (yellow on top)
      if (isF2L) {
        engine.updateStyle(buildF2LSkinStyle());
      } else {
        engine.updateStyle(getSkinStyle("default"));
      }

      // 2. Lock isometric camera angle (only once per mount)
      if (!hasSetCameraRef.current) {
        engine.sceneManager.setOrbitAngles(Math.PI / 4, Math.PI / 6);
        hasSetCameraRef.current = true;
      }

      // 3. Restore previous gray-out, then sync cube state from scramble.
      //    CRITICAL: use raw state (not createCleanState) to preserve
      //    corner/edge orientation for F2L cases with twisted/flipped pieces.
      engine.clearLayerGray();
      const rawState =
        CaseStateGenerator.generateFromScramble(caseData.setupScramble);
      const faceletString = CaseStateGenerator.toFaceletString(rawState);
      engine.syncFacelets(faceletString);

      // 4. Rotate model root to show target slot in FR position
      engine.rotateModelY(modelYRot);

      // 5. Apply full F2L masking (U-layer + target FR slot gray out, target pair + solved slots colored)
      if (isF2L) {
        engine.setF2LMaskGray(F2L_GRAY);
      }
    } catch {
      engine.resetCube();
    }
  }, [isReady, engineRef, caseData.setupScramble, caseData.subsetId, selectedSlot]);

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      engineRef.current?.clearLayerGray();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-surface", className)}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="nums text-[0.85rem] font-semibold text-ink">
            {caseData.caseNumber}
          </span>
          <span className="text-[0.75rem] text-ink-2">{caseData.name}</span>
          {caseData.category && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.6rem] font-medium text-ink-3">
              {caseData.category}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Slot Orientation Tabs */}
        <div>
          <label className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 block mb-1.5">
            Slot Orientation
          </label>
          <div className="grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface-2/40 p-1">
            {SLOT_LABELS.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                className={cn(
                  "py-1 text-[0.65rem] font-medium rounded transition-colors text-center",
                  selectedSlot === slot.id
                    ? "bg-surface text-ink font-semibold shadow-xs"
                    : "text-ink-3 hover:text-ink-2",
                )}
              >
                {slot.name}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Isometric Cube (fixed camera, no drag) */}
        <div className="flex flex-col items-center">
          <div
            ref={containerRef as React.RefObject<HTMLDivElement>}
            className="relative w-full max-w-60 aspect-square rounded-xl border border-line bg-surface-2/30 overflow-hidden shadow-xs"
          >
            <canvas
              ref={canvasRef as React.RefObject<HTMLCanvasElement>}
              className="absolute inset-0 h-full w-full outline-none"
            />
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                <span className="text-[0.6rem] text-ink-3/50 animate-pulse">
                  Initializing 3D View...
                </span>
              </div>
            )}
          </div>
          {caseData.setupScramble && (
            <div className="mt-2 text-center text-[0.65rem] text-ink-3">
              <span className="font-semibold text-ink-2">Setup:</span>{" "}
              {caseData.setupScramble}
            </div>
          )}
        </div>

        {/* Algorithms */}
        <div>
          <h4 className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2">
            Algorithms ({slotAlgorithms.length})
          </h4>
          <div className="space-y-2">
            {slotAlgorithms.map((alg) => (
              <div
                key={alg.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 transition-colors",
                  alg.isDefault
                    ? "border-ink/15 bg-surface-2"
                    : "border-line bg-surface hover:border-ink/10",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="nums flex flex-wrap gap-x-1.5 gap-y-0.5 text-[0.75rem] font-medium text-ink">
                    {alg.moves.map((move, i) => (
                      <span key={i}>{move}</span>
                    ))}
                  </div>
                  {alg.isDefault && (
                    <Check className="size-3.5 text-ready shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-3 text-[0.58rem] text-ink-3">
                  <span>HTM: {alg.moveCount.htm}</span>
                  <span>QTM: {alg.moveCount.qtm}</span>
                  {alg.moveCount.stm > 0 && (
                    <span>STM: {alg.moveCount.stm}</span>
                  )}
                  {alg.source && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="size-2.5" />
                      {alg.source}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practice button */}
        {onPracticeCase && (
          <button
            onClick={() => onPracticeCase(caseData.subsetId, caseData.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[0.72rem] font-semibold text-surface hover:bg-ink/90 transition-colors w-full justify-center"
          >
            Practice This Case
          </button>
        )}
      </div>
    </div>
  );
}
