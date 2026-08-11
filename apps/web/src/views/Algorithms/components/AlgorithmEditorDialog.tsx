"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import {
  X,
  Plus,
  Camera,
  ChevronsUpDown,
  GripVertical,
  RotateCcw,
  RotateCw,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  OrbitCamera,
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

type CapturedOrientation = OrbitCamera;

const DIFFICULTY_LABEL_KEYS = {
  beginner: "editor.difficultyBeginner",
  intermediate: "editor.difficultyIntermediate",
  advanced: "editor.difficultyAdvanced",
} as const;

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
  const { t } = useTranslation("algorithms");

  // ── Form state ───────────────────────────────────────────────────────
  const [notation, setNotation] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  const [capturedOrientation, setCapturedOrientation] =
    useState<CapturedOrientation | null>(null);
  const [rotation2D, setRotation2D] = useState(0);

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
    viewPreferences: capturedOrientation || rotation2D !== 0
      ? {
          ...(capturedOrientation ? { camera: capturedOrientation } : {}),
          ...(rotation2D !== 0 ? { diagramRotation: rotation2D } : {}),
        }
      : undefined,
  }), [seedAlgMoves, capturedOrientation, rotation2D]);

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
        if (
          viewPreferences.camera &&
          typeof viewPreferences.camera.theta === "number" &&
          typeof viewPreferences.camera.phi === "number" &&
          typeof viewPreferences.camera.radius === "number"
        ) {
          setCapturedOrientation({
            theta: viewPreferences.camera.theta,
            phi: viewPreferences.camera.phi,
            radius: viewPreferences.camera.radius,
          });
        } else {
          setCapturedOrientation(null);
        }
        if (viewPreferences.diagramRotation != null) {
          setRotation2D(viewPreferences.diagramRotation);
        } else {
          setRotation2D(0);
        }
      } else {
        setNotation("");
        setDifficulty("intermediate");
        setNotes("");
        setCapturedOrientation(null);
        setRotation2D(0);
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

  // ── 2D rotation nudges ───────────────────────────────────────────────
  const nudgeRotation = useCallback((delta: number) => {
    setRotation2D((prev) => normalizeDegrees(prev + delta));
  }, []);

  // ── 3D camera steps (exact 90° around Y) ────────────────────────────
  const rotate3DBy = useCallback((degrees: number) => {
    const engine = engineRef.current;
    if (!engine?.sceneManager) return;
    const pos = engine.sceneManager.camera.position;
    const radius = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    const theta = Math.atan2(pos.x, pos.z);
    const phi = Math.asin(Math.max(-1, Math.min(1, pos.y / radius)));
    engine.sceneManager.setOrbitAngles(
      theta + (degrees * Math.PI) / 180,
      phi,
      radius,
    );
  }, []);

  const resetIsometric = useCallback(() => {
    engineRef.current?.setIsometricView();
  }, []);

  // ── Save / Submit ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);

    try {
      const id = existingAlgorithm?.id ?? generateUuid();

      // Live auto-capture at save time
      let activeCamera = capturedOrientation;
      if (is3D && engineRef.current?.sceneManager?.camera) {
        activeCamera = cameraToSpherical(engineRef.current.sceneManager.camera.position);
      }

      const viewPreferences: AlgorithmViewPreferences = {
        ...(is3D && activeCamera ? { camera: activeCamera } : {}),
        ...(!is3D && rotation2D !== 0 ? { diagramRotation: rotation2D } : {}),
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
      toast.error(i18n.t("toast:algorithmSaveFailed"));
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
    is3D,
    capturedOrientation,
    rotation2D,
    onClose,
  ]);

  // ── Render ────────────────────────────────────────────────────────────
  const reduceMotion = useReducedMotion();
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
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.aside
            key="alg-editor-sheet"
            initial={reduceMotion ? false : { x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 420, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32 }}
            // w-105 (420px) overflows on screens <420px; below `sm` it becomes
            // a full-width sheet (no side border), >=640px stays w-105.
            // Desktop (>=1024px) is unchanged.
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-full flex-col border-l border-line bg-canvas shadow-2xl sm:w-105 max-sm:border-l-0"
            aria-label={
              existingAlgorithm
                ? t("editor.editAlgorithm")
                : t("addCustomAlgorithm")
            }
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 place-items-center rounded-md bg-ink text-surface">
                  <Plus className="size-3.5" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-ink leading-tight">
                    {existingAlgorithm
                      ? t("editor.editAlgorithm")
                      : t("addCustomAlgorithm")}
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
                aria-label={t("close")}
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
                    {t("editor.orientationPreview")}
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">
                    {is3D
                      ? t("editor.use90Buttons")
                      : t("editor.rotateToMatch")}
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
                      lockOrbit
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

                {/* Rotation controls */}
                {is3D ? (
                  /* 3D: exact ±90° steps + isometric reset */
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <button
                            onClick={() => rotate3DBy(-90)}
                            disabled={!engineReady}
                            className="inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-[0.6rem] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <RotateCcw className="size-3" />
                            −90°
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t("editor.rotateCCW")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <button
                            onClick={() => rotate3DBy(90)}
                            disabled={!engineReady}
                            className="inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-[0.6rem] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <RotateCw className="size-3" />
                            +90°
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t("editor.rotateCW")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <button
                            onClick={resetIsometric}
                            disabled={!engineReady}
                            className="inline-flex items-center gap-1 rounded border border-line px-2.5 py-1 text-[0.6rem] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <Focus className="size-3" />
                            ISO
                          </button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">{t("editor.resetIsometric")}</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  /* 2D: rotation nudge buttons */
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {[-90, 90, 180].map((delta) => (
                      <button
                        key={delta}
                        onClick={() => nudgeRotation(delta)}
                        className="rounded border border-line px-2 py-1 text-[0.6rem] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                      >
                        {delta > 0 ? `+${delta}°` : `${delta}°`}
                      </button>
                    ))}
                    <div className="ml-auto text-[0.6rem] font-mono text-ink-3">
                      {t("editor.rotation")}{" "}
                      <span className="font-semibold text-ink">{rotation2D}°</span>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Notation ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <ChevronsUpDown className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    {t("editor.algorithmNotation")}
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
                  placeholder={t("editor.notationPlaceholder")}
                  className="min-h-18 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2.5 font-mono text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                  autoFocus
                />
                <p className="mt-1.5 text-[0.58rem] text-ink-3/70">
                  {t("editor.notationHint")}
                </p>
              </section>

              {/* ── Difficulty ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <span className="block mb-2.5 text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                  {t("editor.difficulty")}
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
                      {t(DIFFICULTY_LABEL_KEYS[d])}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Notes ── */}
              <section className="rounded-lg border border-line bg-surface px-4 py-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="size-3.5 text-ink-3" />
                  <span className="text-[0.65rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                    {t("editor.notes")}
                  </span>
                  <span className="ml-auto text-[0.55rem] text-ink-3/50">
                    {t("editor.optional")}
                  </span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("editor.notesPlaceholder")}
                  className="min-h-13 w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:border-ink-2"
                />
              </section>

              {/* ── Setup scramble (read-only) ── */}
              {caseData.setupScramble && (
                <section className="px-1 py-0.5">
                  <span className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3">
                    Setup scramble:{" "}
                  </span>
                  <span className="font-mono text-[0.68rem] text-ink-2">
                    {caseData.setupScramble}
                  </span>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center gap-3 border-t border-line bg-canvas px-5 py-3.5 pb-safe max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <p className="min-w-0 flex-1 truncate text-[0.6rem] text-ink-3">
                {canSave
                  ? t("editor.readyToSave", { count: parsedMoves.length })
                  : t("editor.enterNotation")}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs"
                >
                  {t("editor.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="h-8 px-3 text-xs bg-ink text-surface shadow-xs hover:bg-ink/90 focus-visible:ring-ring"
                >
                  {saving
                    ? t("editor.saving")
                    : existingAlgorithm
                      ? t("editor.update")
                      : t("editor.addAlgorithm")}
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
