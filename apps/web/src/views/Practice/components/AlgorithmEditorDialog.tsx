"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  Plus,
  Camera,
  ChevronsUpDown,
  GripVertical,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Case3DCanvas } from "./Case3DDiagram";
import { CaseDiagram } from "./CaseDiagram";
import { Case2x2Diagram } from "./Case2x2Diagram";
import type { Cube3DEngine } from "@cubeforge/cube-3d-engine";
import {
  expandWideMoves,
} from "@cubeforge/math-core";
import {
  computeMoveMetricsFromString,
  resolveAlgorithmViewPreferences,
  resolveCaseVisualizationStyle,
} from "@cubeforge/algorithm-db";
import type {
  Algorithm,
  AlgorithmCase,
  AlgorithmViewPreferences,
  VisualizationStyle,
} from "@cubeforge/algorithm-db";
import { algorithmStore } from "@cubeforge/state";
import { getAlgorithmsForCase } from "@/hooks/useCaseAlgorithms";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AlgorithmEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** The case this algorithm belongs to. */
  caseData: AlgorithmCase;
  /** Existing custom algorithm to edit (if editing). */
  existingAlgorithm?: Algorithm | null;
}

type Difficulty = "beginner" | "intermediate" | "advanced";

interface CapturedOrientation {
  theta: number;
  phi: number;
  radius: number;
}

// ─── Diagram variant detection ──────────────────────────────────────────

interface DiagramVariant {
  type: "3d-3x3" | "3d-2x2" | "2d-3x3" | "2d-2x2";
  style: VisualizationStyle;
}

function detectDiagramVariant(caseData: AlgorithmCase): DiagramVariant {
  const is2x2 = caseData.puzzleType === "2x2x2";
  const is3D =
    caseData.diagramType === "3d-isometric" ||
    caseData.diagramType === "3d";

  // 3D cases: F2L, some Ortega PBL, or fallback when no 2D diagram
  if (is3D || (!caseData.diagram2D && caseData.setupScramble)) {
    return { type: is2x2 ? "3d-2x2" : "3d-3x3", style: "full-color" };
  }

  // 2D cases: PLL, OLL, Ortega OLL, etc.
  const style: VisualizationStyle = resolveCaseVisualizationStyle(caseData);

  return {
    type: is2x2 ? "2d-2x2" : "2d-3x3",
    style,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function parseMoves(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  try {
    return expandWideMoves(trimmed);
  } catch {
    return trimmed.split(/\s+/).filter(Boolean);
  }
}

function generateUuid(): string {
  return (
    crypto.randomUUID?.() ??
    `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/** Convert camera cartesian position to spherical [theta, phi, radius]. */
function cameraToSpherical(
  pos: { x: number; y: number; z: number },
): CapturedOrientation {
  const radius = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
  const theta = Math.atan2(pos.x, pos.z);
  const phi = Math.asin(Math.max(-1, Math.min(1, pos.y / radius)));
  return { theta, phi, radius: Math.round(radius * 100) / 100 };
}

/** Normalize degrees to 0–360 range. */
function normalizeDegrees(d: number): number {
  return ((d % 360) + 360) % 360;
}

// ─── Component ──────────────────────────────────────────────────────────

export function AlgorithmEditorDialog({
  open,
  onClose,
  caseData,
  existingAlgorithm,
}: AlgorithmEditorDialogProps) {
  // ── Form state ───────────────────────────────────────────────────────
  const [notation, setNotation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  // ── Orientation / Rotation state ─────────────────────────────────────
  const [capturedOrientation, setCapturedOrientation] =
    useState<CapturedOrientation | null>(null);
  const [rotation2D, setRotation2D] = useState(0);
  const [capturedRotation2D, setCapturedRotation2D] = useState<number | null>(
    null,
  );

  // ── 3D Engine ref (populated by Case3DCanvas via onEngineReady) ─────
  const engineRef = useRef<Cube3DEngine | null>(null);

  // ── Diagram variant ──────────────────────────────────────────────────
  const variant = useMemo(() => detectDiagramVariant(caseData), [caseData]);
  const is3D = variant.type.startsWith("3d");
  const is2x2 = caseData.puzzleType === "2x2x2";

  // ── Seed algorithm moves are notation only; setupScramble remains canonical ──
  const seedAlgMoves = useMemo(
    () => getAlgorithmsForCase(caseData.id)[0]?.moves ?? [],
    [caseData.id],
  );

  const previewAlgorithm = useMemo<Pick<Algorithm, "moves" | "viewPreferences">>(() => ({
    moves: seedAlgMoves,
    viewPreferences: capturedOrientation || capturedRotation2D != null
      ? {
          ...(capturedOrientation ? { camera: capturedOrientation } : {}),
          ...(capturedRotation2D != null ? { diagramRotation: capturedRotation2D } : {}),
        }
      : undefined,
  }), [seedAlgMoves, capturedOrientation, capturedRotation2D]);

  // Stable callback for Case3DCanvas to avoid re-fire loops
  const handleEngineReady = useCallback((engine: Cube3DEngine) => {
    engineRef.current = engine;
    setEngineReady(true);
  }, []);

  // ── Reset form when opening ──────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (existingAlgorithm) {
        const viewPreferences = resolveAlgorithmViewPreferences(existingAlgorithm);
        setNotation(existingAlgorithm.moves.join(" "));
        setDifficulty(existingAlgorithm.difficulty);
        setNotes(existingAlgorithm.notes ?? "");
        // Restore the canonical view preferences. The resolver only falls
        // back to legacy fields for already-persisted historical records.
        if (viewPreferences.camera) {
          setCapturedOrientation(viewPreferences.camera);
        } else {
          setCapturedOrientation(null);
        }
        if (viewPreferences.diagramRotation != null) {
          setRotation2D(viewPreferences.diagramRotation);
          setCapturedRotation2D(viewPreferences.diagramRotation);
        } else {
          setRotation2D(0);
          setCapturedRotation2D(null);
        }
      } else {
        setNotation("");
        setDifficulty("intermediate");
        setNotes("");
        setCapturedOrientation(null);
        setRotation2D(0);
        setCapturedRotation2D(null);
      }
      setSaving(false);
      engineRef.current = null;
      setEngineReady(false);
    }
  }, [open, existingAlgorithm]);

  // ── Derived values ───────────────────────────────────────────────────
  const parsedMoves = useMemo(() => parseMoves(notation), [notation]);

  const moveCount = useMemo(
    () => computeMoveMetricsFromString(notation),
    [notation],
  );

  const canSave = parsedMoves.length > 0;

  // ── Capture 3D camera orientation ────────────────────────────────────
  const handleCaptureOrientation = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.sceneManager) {
      toast.error("3D cube not ready yet. Try again in a moment.");
      return;
    }

    const camera = engine.sceneManager.camera;
    if (!camera) {
      toast.error("Could not access camera. Try again.");
      return;
    }

    const spherical = cameraToSpherical(camera.position);
    setCapturedOrientation(spherical);
    toast.success("Orientation captured", {
      description: `θ: ${spherical.theta.toFixed(2)}  φ: ${spherical.phi.toFixed(2)}`,
    });
  }, []);

  // ── Capture 2D rotation ──────────────────────────────────────────────
  const handleCaptureRotation = useCallback(() => {
    setCapturedRotation2D(rotation2D);
    toast.success("Rotation captured", {
      description: `${rotation2D}°`,
    });
  }, [rotation2D]);

  // ── 2D rotation nudges ───────────────────────────────────────────────
  const nudgeRotation = useCallback((delta: number) => {
    setRotation2D((prev) => normalizeDegrees(prev + delta));
  }, []);

  // ── Save / Submit ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);

    try {
      const id = existingAlgorithm?.id ?? generateUuid();

      const viewPreferences: AlgorithmViewPreferences = {
        ...(capturedOrientation ? { camera: capturedOrientation } : {}),
        ...(capturedRotation2D != null ? { diagramRotation: capturedRotation2D } : {}),
        ...(existingAlgorithm?.viewPreferences?.preferredF2LSlot != null
          ? { preferredF2LSlot: existingAlgorithm.viewPreferences.preferredF2LSlot }
          : {}),
      };

      const alg: Algorithm = {
        id,
        caseId: caseData.id,
        moves: parsedMoves,
        moveCount,
        isDefault: false,
        isCustom: true,
        source: "user",
        difficulty,
        triggers: existingAlgorithm?.triggers ?? [],
        notes: notes.trim() || undefined,
        isMirror: false,
        isInverse: false,
        sortOrder: existingAlgorithm?.sortOrder ?? Date.now(),
        viewPreferences,
      };

      if (existingAlgorithm) {
        algorithmStore.getState().updateCustomAlgorithm(id, alg);
      } else {
        algorithmStore.getState().addCustomAlgorithm(alg);
      }

      onClose();
    } catch (err) {
      console.error("[AlgorithmEditorDialog] Failed to save:", err);
      toast.error("Failed to save algorithm");
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    existingAlgorithm,
    caseData.id,
    parsedMoves,
    moveCount,
    difficulty,
    notes,
    capturedOrientation,
    capturedRotation2D,
    onClose,
  ]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="alg-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.aside
            key="alg-editor-sheet"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[420px] flex-col border-l border-line bg-canvas shadow-2xl"
            aria-label={
              existingAlgorithm ? "Edit algorithm" : "Add custom algorithm"
            }
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded-md bg-accent-cyan text-surface">
                  <Plus className="size-3.5" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-ink leading-tight">
                    {existingAlgorithm
                      ? "Edit algorithm"
                      : "Add custom algorithm"}
                  </span>
                  <span className="block text-[0.6rem] text-ink-3">
                    {caseData.caseNumber}
                    {caseData.name &&
                    caseData.name !== caseData.caseNumber
                      ? ` — ${caseData.name}`
                      : ""}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
              {/* ── Orientation Preview ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Orientation preview
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">
                    {is3D ? "Drag to rotate" : "Rotate to match your view"}
                  </span>
                </div>

                {/* Diagram — clones the actual panel view */}
                <div
                  className="relative w-full rounded-md border border-line bg-canvas overflow-hidden"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {is3D ? (
                    <Case3DCanvas
                      caseData={caseData}
                      algorithm={is3D ? previewAlgorithm : undefined}
                      selectedSlot={previewAlgorithm.viewPreferences?.preferredF2LSlot ?? 0}
                      className="w-full h-full"
                      order={is2x2 ? 2 : 3}
                      onEngineReady={handleEngineReady}
                    />
                  ) : variant.type === "2d-2x2" ? (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <Case2x2Diagram
                        faceletColors={caseData.diagram2D?.faceletColors}
                        setupScramble={caseData.setupScramble}
                        moves={seedAlgMoves}
                        style={variant.style}
                        rotation={rotation2D}
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <CaseDiagram
                        arrows={caseData.diagram2D?.arrows}
                        setupScramble={caseData.setupScramble}
                        moves={seedAlgMoves}
                        style={variant.style}
                        rotation={rotation2D}
                      />
                    </div>
                  )}
                </div>

                {/* Rotation controls + capture */}
                {is3D ? (
                  /* 3D: capture button only (drag handles rotation) */
                  <div className="flex items-center gap-2 mt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCaptureOrientation}
                      disabled={!engineReady}
                      className="h-7 gap-1.5 px-2.5 text-[0.62rem] text-ink-3 hover:text-ink"
                    >
                      <Camera className="size-3" />
                      Capture orientation
                    </Button>
                    {capturedOrientation && (
                      <>
                        <span className="text-[0.55rem] text-accent-cyan font-mono">
                          θ: {capturedOrientation.theta.toFixed(2)} φ:{" "}
                          {capturedOrientation.phi.toFixed(2)}
                        </span>
                        <span className="size-1.5 rounded-full bg-accent-cyan" />
                      </>
                    )}
                  </div>
                ) : (
                  /* 2D: rotation slider + nudge buttons + capture */
                  <div className="mt-2.5 space-y-2">
                    {/* Slider */}
                    <div className="flex items-center gap-2">
                      <RotateCcw className="size-3 text-ink-3 shrink-0" />
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={rotation2D}
                        onChange={(e) =>
                          setRotation2D(Number(e.target.value))
                        }
                        className="h-1.5 w-full appearance-none rounded-full bg-surface-2 accent-accent-cyan cursor-pointer"
                        aria-label="Diagram rotation"
                      />
                      <RotateCw className="size-3 text-ink-3 shrink-0" />
                    </div>
                    {/* Nudge buttons + capture + indicator */}
                    <div className="flex items-center gap-1.5">
                      {[-90, 90, 180].map((delta) => (
                        <button
                          key={delta}
                          onClick={() => nudgeRotation(delta)}
                          className="rounded border border-line px-1.5 py-0.5 text-[0.55rem] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                        >
                          {delta > 0 ? `+${delta}°` : `${delta}°`}
                        </button>
                      ))}
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCaptureRotation}
                        className="h-7 gap-1.5 px-2.5 text-[0.62rem] text-ink-3 hover:text-ink"
                      >
                        <Camera className="size-3" />
                        Capture
                      </Button>
                      {capturedRotation2D != null && (
                        <>
                          <span className="text-[0.55rem] text-accent-cyan font-mono">
                            {capturedRotation2D}°
                          </span>
                          <span className="size-1.5 rounded-full bg-accent-cyan" />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ── Notation ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <ChevronsUpDown className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Algorithm notation
                  </span>
                  {parsedMoves.length > 0 && (
                    <span className="ml-auto nums text-[0.6rem] text-ink-3">
                      HTM: {moveCount.htm} · QTM: {moveCount.qtm}
                      {moveCount.stm > 0 && <> · STM: {moveCount.stm}</>}
                    </span>
                  )}
                </div>
                <textarea
                  value={notation}
                  onChange={(e) => setNotation(e.target.value)}
                  placeholder="e.g. R U R' U' R' F R2 U' R' U' R U R' F'"
                  className="min-h-[72px] w-full resize-none rounded-md border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-accent-cyan/60 focus:ring-1 focus:ring-accent-cyan/20"
                  autoFocus
                />
                <p className="mt-1.5 text-[0.58rem] text-ink-3/70">
                  Use standard cube notation. Wide moves (r, u, f) and slice
                  moves (M, S, E) are supported.
                </p>
              </section>

              {/* ── Difficulty ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <span className="block mb-2.5 text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                  Difficulty
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    ["beginner", "intermediate", "advanced"] as Difficulty[]
                  ).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "rounded-md px-2 py-2 text-xs font-medium capitalize transition-all",
                        difficulty === d
                          ? "bg-ink text-surface shadow-sm"
                          : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-surface-2/80",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Notes ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    Notes
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">
                    optional
                  </span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. use left index push for the F'"
                  className="min-h-[52px] w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                />
              </section>

              {/* ── Setup scramble (read-only) ── */}
              {caseData.setupScramble && (
                <section className="rounded-lg border border-line bg-surface-2/40 px-4 py-3">
                  <span className="block mb-1.5 text-[0.6rem] uppercase tracking-[0.14em] text-ink-3 font-medium">
                    Case setup scramble
                  </span>
                  <p className="nums text-[0.68rem] text-ink-2/80">
                    {caseData.setupScramble}
                  </p>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-line bg-canvas px-5 py-3.5">
              <p className="text-[0.6rem] text-ink-3">
                {canSave
                  ? `${parsedMoves.length} move${parsedMoves.length !== 1 ? "s" : ""} — ready to save`
                  : "Enter algorithm notation above"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="h-8 text-xs bg-accent-cyan text-surface hover:bg-accent-cyan/85"
                >
                  {saving
                    ? "Saving…"
                    : existingAlgorithm
                      ? "Update"
                      : "Add algorithm"}
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
