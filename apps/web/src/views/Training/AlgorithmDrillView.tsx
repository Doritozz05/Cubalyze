"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  METHODS,
  SUBSETS,
  getSeedData,
  getChildSubsets,
  resolveVisualizationStyleForSubset,
  resolveAlgorithmDiagramRotation,
} from "@cubeforge/algorithm-db";
import type { AlgorithmCase, VisualizationStyle } from "@cubeforge/algorithm-db";
import { useCaseAlgorithms, getAlgorithmsForCase } from "@/hooks/useCaseAlgorithms";
import { CaseDiagram } from "@/views/Algorithms/components/CaseDiagram";
import { Case2x2Diagram } from "@/views/Algorithms/components/Case2x2Diagram";
import { Case3DDiagram } from "@/views/Algorithms/components/Case3DDiagram";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { ScrambleDisplay } from "@/components/Scramble/ScrambleDisplay";
import { TimerContainer } from "@/components/Timer/TimerContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HintContext } from "@/components/Timer/hintFor";
import { useDrillSmartCube } from "@/hooks/useDrillSmartCube";
import { useOrientation } from "@/hooks/useOrientation";
import { generateRandomSetup, EXERCISE_IDS } from "@cubeforge/training";
import { MiniCube3DPanel } from "@/components/Cube3D/MiniCube3DPanel";
import {
  TrainingBreadcrumb,
  VerdictOverlay,
  StatChip,
  TouchAside,
} from "./components";
import { useTrainingEngine } from "@/hooks/useTrainingEngine";
import type { AlgorithmProgressRecord } from "@cubeforge/training";
import {
  Eye,
  EyeOff,
  SkipForward,
  Shuffle,
  Target,
  Clock,
  Flame,
  RotateCcw,
  Lock,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type DrillMode = "single" | "random" | "sequential" | "weakness";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────── */

function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const s = ms / 1000;
  return s < 10 ? s.toFixed(2) : s < 60 ? s.toFixed(2) : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

function calculateTps(moves: string[], ms: number): string {
  if (ms <= 0 || moves.length === 0) return "--";
  return ((moves.length / (ms / 1000))).toFixed(1);
}

const DRILL_MODE_IDS = ["single", "random", "sequential", "weakness"] as const;

/** Drill mode id → i18n keys (labels + tooltip descriptions). */
const DRILL_MODE_KEYS = {
  single: { label: "drill.modes.single.label", description: "drill.modes.single.description" },
  random: { label: "drill.modes.random.label", description: "drill.modes.random.description" },
  sequential: { label: "drill.modes.sequential.label", description: "drill.modes.sequential.description" },
  weakness: { label: "drill.modes.weakness.label", description: "drill.modes.weakness.description" },
} as const;

/** Face letter → i18n key for the orientation indicator color name (WCA). */
const FACE_COLOR_KEYS = {
  U: "drill.faceColors.U",
  R: "drill.faceColors.R",
  F: "drill.faceColors.F",
  D: "drill.faceColors.D",
  L: "drill.faceColors.L",
  B: "drill.faceColors.B",
} as const;
type FaceKey = keyof typeof FACE_COLOR_KEYS;

/* ──────────────────────────────────────────────────────────────────────────
   Main Component
   ─────────────────────────────────────────────────────────────────────── */

export interface AlgorithmDrillViewProps {
  methodId: string;
  phaseId: string;
  subsetId: string;
  onBack: () => void;
  preselectedCaseId?: string | null;
}

export function AlgorithmDrillView({
  methodId, phaseId: _phaseId, subsetId, onBack, preselectedCaseId,
}: AlgorithmDrillViewProps) {
  const { t } = useTranslation("training");
  void _phaseId; // reserved for future: stores attempts with phase context
  // ── Data ─────────────────────────────────────────────────────────────
  const { cases: allCases } = useMemo(() => getSeedData(), []);
  const subset = useMemo(() => SUBSETS.find((s) => s.id === subsetId), [subsetId]);
  const method = useMemo(() => METHODS.find((m) => m.id === methodId), [methodId]);

  const childSubsetIds = useMemo(() => {
    const children = getChildSubsets(subsetId);
    return new Set(children.map((c) => c.id));
  }, [subsetId]);

  const subsetCases = useMemo(
    () =>
      allCases
        .filter((c) => c.subsetId === subsetId || childSubsetIds.has(c.subsetId))
        .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, undefined, { numeric: true })),
    [allCases, subsetId, childSubsetIds],
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [drillMode, setDrillMode] = useState<DrillMode>("single");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(preselectedCaseId ?? null);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [revealIfFail, setRevealIfFail] = useState(false);
  const [seqIndex, setSeqIndex] = useState(0);
  const [currentSetup, setCurrentSetup] = useState("");
  const [setupVersion, setSetupVersion] = useState(0);

  // ── Orientation (remaps scramble display to match cube orientation) ──
  const { remapScramble, orientation } = useOrientation();

  // ── Smart cube connection, tracked before the engine so the persisted
  //    session records smartCubeUsed=true once a cube is linked. ──
  const [smartCubeConnected, setSmartCubeConnected] = useState(false);

  // ── Training engine: session state machine + drill timer + DB + session ─
  const engineApi = useTrainingEngine({
    preset: {
      exerciseId: EXERCISE_IDS.drill(subsetId),
      methodId,
      phaseId: _phaseId as string,
      subsetId,
    },
    smartCubeUsed: smartCubeConnected,
  });
  const {
    sessionState,
    phase,
    time,
    stoppedTime,
    press,
    release,
    reset,
    timerEngine,
    ready,
    getSubsetProgress,
    sessionId,
    beginAttempt,
    submitVerdict,
    skip: skipAttempt,
  } = engineApi;

  // ── Smart Cube wiring (BLE + scramble validation + auto-arm) ───────────
  const drillSmartCube = useDrillSmartCube({
    engine: timerEngine,
    setupScramble: currentSetup,
  });

  useEffect(() => {
    if (drillSmartCube.smartCubeConnected !== smartCubeConnected) {
      setSmartCubeConnected(drillSmartCube.smartCubeConnected);
    }
  }, [drillSmartCube.smartCubeConnected, smartCubeConnected]);

  // ── Visualization style (yellow-gray for OLL, full-color for PLL, etc.) ─
  const visualizationStyle = useMemo<VisualizationStyle>(() => {
    return resolveVisualizationStyleForSubset(subset?.name);
  }, [subset]);

  // ── Timer hint context (controls TimerDisplay hint text) ─────────────
  const scrambleDisplay = useStore(
    preferencesStore,
    (s) => s.scrambleDisplay,
  );
  const scrambleVerificationRaw = useStore(
    preferencesStore,
    (s) => s.scrambleVerification,
  );
  const scrambleVerification = scrambleDisplay && scrambleVerificationRaw;
  const hasSmartCube = drillSmartCube.smartCubeConnected;
  const drillHintCtx = useMemo<HintContext>(() => ({
    smartCube: hasSmartCube,
    scrambleVerif: hasSmartCube && scrambleVerification,
    inspection: false,
    isScrambled: drillSmartCube.validation.isScrambled,
  }), [hasSmartCube, scrambleVerification, drillSmartCube.validation.isScrambled]);

  // ── Real progress from DB ──────────────────────────────────────────────
  const [progressMap, setProgressMap] = useState<Map<string, AlgorithmProgressRecord>>(new Map());

  useEffect(() => {
    if (!ready) return;
    getSubsetProgress(subsetId).then((records) => {
      const map = new Map<string, AlgorithmProgressRecord>();
      for (const r of records) {
        map.set(r.algorithmId, r);
      }
      setProgressMap(map);
    });
  }, [ready, subsetId, getSubsetProgress]);

  // Helper for per-case progress with zero fallback
  const getProgress = useCallback((caseId: string): { mastery: number; bestTimeMs: number; attempts: number } => {
    const p = progressMap.get(caseId);
    return { mastery: p?.mastery ?? 0, bestTimeMs: p?.bestTimeMs ?? 0, attempts: p?.totalAttempts ?? 0 };
  }, [progressMap]);

  // ── Derived data ─────────────────────────────────────────────────────
  const selectedCase = useMemo(
    () => (selectedCaseId ? subsetCases.find((c) => c.id === selectedCaseId) ?? null : null),
    [selectedCaseId, subsetCases],
  );
  // ── Ordered algorithms for the selected case (seed + custom, ordered) ──
  const { primaryAlgorithm: defaultAlgorithm } = useCaseAlgorithms(selectedCaseId);

  const weaknessOrdered = useMemo(() => {
    return [...subsetCases].sort((a, b) => {
      return getProgress(a.id).mastery - getProgress(b.id).mastery;
    });
  }, [subsetCases, getProgress]);

  const masteredCount = useMemo(
    () => subsetCases.filter((c) => getProgress(c.id).mastery >= 90).length,
    [subsetCases, getProgress],
  );

  // Attempts accumulate in the session machine (engine attempts with verdicts).
  const attempts = sessionState.attempts;
  // Verdict overlay shows while the drill timer is stopped with a captured time.
  const showVerdict = phase === "stopped" && stoppedTime > 0;

  const correctAttempts = attempts.filter((a) => a.verdict === "correct");
  const streak = useMemo(() => {
    let s = 0;
    for (let i = attempts.length - 1; i >= 0; i--) {
      if (attempts[i].verdict === "correct") s++; else break;
    }
    return s;
  }, [attempts]);

  const avgTime = useMemo(() => {
    const valid = attempts.filter((a) => a.verdict === "correct");
    if (valid.length === 0) return 0;
    return valid.reduce((sum, a) => sum + a.timeMs, 0) / valid.length;
  }, [attempts]);

  // ── Case navigation & mode change ─────────────────────────────────────
  const selectNextCase = useCallback(() => {
    if (subsetCases.length === 0) return;
    if (drillMode === "sequential") {
      const next = (seqIndex + 1) % subsetCases.length;
      setSeqIndex(next);
      setSelectedCaseId(subsetCases[next].id);
    } else if (drillMode === "random") {
      const idx = Math.floor(Math.random() * subsetCases.length);
      setSelectedCaseId(subsetCases[idx].id);
    } else if (drillMode === "weakness") {
      setSelectedCaseId(weaknessOrdered[0].id);
    }
    // single: keep same case
  }, [drillMode, subsetCases, seqIndex, weaknessOrdered]);

  const handleModeChange = useCallback(
    (newMode: DrillMode) => {
      setDrillMode(newMode);
      if (subsetCases.length > 0) {
        if (newMode === "random") {
          const idx = Math.floor(Math.random() * subsetCases.length);
          setSelectedCaseId(subsetCases[idx].id);
        } else if (newMode === "sequential") {
          setSeqIndex(0);
          setSelectedCaseId(subsetCases[0].id);
        } else if (newMode === "weakness" && weaknessOrdered.length > 0) {
          setSelectedCaseId(weaknessOrdered[0].id);
        }
      }
    },
    [subsetCases, weaknessOrdered],
  );

  // Auto-select initial case on load or when drillMode is random and nothing is selected
  useEffect(() => {
    if (!selectedCaseId && subsetCases.length > 0) {
      if (drillMode === "random") {
        const idx = Math.floor(Math.random() * subsetCases.length);
        setSelectedCaseId(subsetCases[idx].id);
      } else {
        setSelectedCaseId(subsetCases[0].id);
      }
    }
  }, [selectedCaseId, subsetCases, drillMode]);

  // ── Random setup generation (when case or setupVersion changes) ──────
  useEffect(() => {
    let setup = "";
    if (defaultAlgorithm?.moves) {
      setup = generateRandomSetup(
        defaultAlgorithm.moves,
        "Y",
        selectedCase?.puzzleType ?? "333",
        selectedCase?.setupScramble,
      ) || selectedCase?.setupScramble || "";
    }
    setCurrentSetup(setup);
    if (setup && selectedCase) {
      beginAttempt(setup, selectedCase.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId, defaultAlgorithm?.id, setupVersion]);

  // ── Verdict handlers ──────────────────────────────────────────────────
  const recordAttempt = useCallback(
    (correct: boolean) => {
      if (!selectedCase || !defaultAlgorithm) return;
      if (!correct && revealIfFail) setShowAlgorithm(true);

      void submitVerdict({
        verdict: correct ? "correct" : "incorrect",
        playMode: hasSmartCube ? "smart-cube" : "manual",
        caseId: selectedCase.id,
        scramble: currentSetup,
        timeMs: stoppedTime,
        metricKind: "execution",
        sessionId: sessionId ?? undefined,
      }).catch((err) => {
        console.error("[DrillView] Failed to persist attempt:", err);
      });
    },
    [selectedCase, defaultAlgorithm, revealIfFail, stoppedTime, submitVerdict, hasSmartCube, currentSetup, sessionId],
  );

  const handleMarkCorrect = useCallback(() => {
    recordAttempt(true);
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [recordAttempt, reset, selectNextCase]);

  const handleMarkIncorrect = useCallback(() => {
    recordAttempt(false);
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [recordAttempt, reset, selectNextCase]);

  const handleSkip = useCallback(() => {
    skipAttempt();
    reset();
    setSetupVersion((v) => v + 1);
    selectNextCase();
  }, [skipAttempt, reset, selectNextCase]);

  // ── Orientation-adapted display scramble (matches user's cube) ─────────
  const displaySetup = remapScramble(currentSetup);

  // ── Orientation indicator: which color is on U (top) and F (front) ────
  const topColor = t(FACE_COLOR_KEYS[orientation.faceMap['U'] as FaceKey] ?? "drill.faceColors.U");
  const frontColor = t(FACE_COLOR_KEYS[orientation.faceMap['F'] as FaceKey] ?? "drill.faceColors.F");

  // ── Algorithm text ────────────────────────────────────────────────────
  const algoText = defaultAlgorithm?.moves.join(" ") ?? "";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative flex-1 min-h-0 w-full h-full">
      <div className="absolute inset-0 flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <DrillHeader
          methodName={method?.name ?? "?"}
          subsetName={subset?.name ?? "?"}
          drillMode={drillMode}
          onModeChange={handleModeChange}
          masteredCount={masteredCount}
          onBack={onBack}
          smartCubeConnected={drillSmartCube.smartCubeConnected}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden lg:flex-row px-4 sm:px-6 lg:px-8 pb-4">
          {/* Left: Active drill area */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 min-w-0">
            {/* Case info bar (compact) */}
            <div className="shrink-0 flex items-center gap-3 px-1">
              <span className="nums text-[0.85rem] font-semibold text-ink">{selectedCase?.caseNumber ?? "--"}</span>
              {selectedCase?.name && selectedCase.name !== selectedCase.caseNumber && (
                <span className="text-[0.7rem] text-ink-2">{selectedCase.name}</span>
              )}
              {hasSmartCube && (
                <span className="text-[0.55rem] text-ink-3/60 ml-auto flex items-center gap-1.5">
                  <span className="flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-phase-yellow" />
                    {topColor}
                  </span>
                  <span className="text-ink-3/30">·</span>
                  <span className="flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-phase-green" />
                    {frontColor}
                  </span>
                </span>
              )}
            </div>

            {/* Row: Case diagram (left) + Setup scramble (right) */}
            <div className="shrink-0 flex items-stretch gap-4 rounded-xl border border-line bg-surface p-4">
              {/* Left: Case diagram */}
              <div className="shrink-0 flex items-center justify-center">
                {selectedCase && (selectedCase.diagramType === "3d-isometric" || selectedCase.diagramType === "3d") ? (
                  <Case3DDiagram caseData={selectedCase} algorithm={defaultAlgorithm} className="w-28 sm:w-36" />
                ) : selectedCase && (selectedCase.diagramType === "2d-top" || selectedCase.diagram2D) ? (
                  selectedCase.puzzleType === '222' ? (
                    <Case2x2Diagram
                      faceletColors={selectedCase.diagram2D?.faceletColors}
                      setupScramble={selectedCase.setupScramble}
                      moves={undefined}
                      style={visualizationStyle}
                      rotation={resolveAlgorithmDiagramRotation(defaultAlgorithm)}
                      className="w-28 sm:w-36"
                    />
                  ) : (
                    <CaseDiagram
                      arrows={selectedCase.diagram2D?.arrows}
                      setupScramble={selectedCase.setupScramble}
                      moves={undefined}
                      style={visualizationStyle}
                      rotation={resolveAlgorithmDiagramRotation(defaultAlgorithm)}
                      className="w-28 sm:w-36"
                    />
                  )
                ) : selectedCase?.setupScramble ? (
                  <Case3DDiagram caseData={selectedCase} className="w-28 sm:w-36" />
                ) : (
                  <div className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center rounded-lg bg-surface-2">
                    <span className="text-ink-3/40 text-[0.6rem]">{t("noDiagram")}</span>
                  </div>
                )}
              </div>

              {/* Right: Setup scramble with ScrambleDisplay (same component as practice timer, compact) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                {currentSetup ? (
                  <ScrambleDisplay
                    scramble={currentSetup}
                    displayScramble={displaySetup}
                    smartCubeConnected={hasSmartCube}
                    states={hasSmartCube ? drillSmartCube.validation.states : undefined}
                    currentIndex={hasSmartCube ? drillSmartCube.validation.currentIndex : 0}
                    errorMoves={hasSmartCube ? drillSmartCube.validation.displayErrorMoves : []}
                    pendingHalfDouble={hasSmartCube ? drillSmartCube.validation.pendingHalfDouble : false}
                    isScrambled={hasSmartCube ? drillSmartCube.validation.isScrambled : false}
                    needsReset={hasSmartCube ? drillSmartCube.validation.needsReset : false}
                    awaitingSolve={hasSmartCube ? drillSmartCube.validation.awaitingSolve : false}
                  />
                ) : (
                  <p className="nums text-[0.85rem] text-ink-3/40 italic px-1">{t("drill.selectCaseToGenerateSetup")}</p>
                )}
              </div>
            </div>

            {/* Algorithm section — hidden by default, compact */}
            <div className="shrink-0 rounded-xl border border-line/60 bg-surface-2/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-3">{t("drill.algorithm")}</span>
                  {showAlgorithm && (
                    <span className="nums text-[0.65rem] text-ink-2/80 truncate max-w-75">
                      {algoText || t("drill.noAlgorithm")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[0.58rem] text-ink-3 cursor-pointer select-none">
                    <input type="checkbox" checked={revealIfFail} onChange={(e) => setRevealIfFail(e.target.checked)} className="size-3 rounded border-line accent-ink" />
                    {t("drill.revealIfFail")}
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowAlgorithm((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-medium transition-colors bg-surface-2 text-ink-3 hover:text-ink hover:bg-line"
                      >
                        {showAlgorithm ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        {showAlgorithm ? t("drill.hide") : t("drill.show")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {showAlgorithm ? t("drill.hideAlgorithm") : t("drill.showAlgorithm")}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              {!showAlgorithm && (
                <p className="text-[0.6rem] text-ink-3/40 italic flex items-center gap-1.5 mt-1">
                  <Lock className="size-3" /> {t("drill.algorithmHidden")}
                </p>
              )}
            </div>

            {/* Timer area with verdict overlay */}
            <div className="flex-1 min-h-44 rounded-xl border border-line bg-surface relative overflow-hidden">
              {/* Verdict overlay */}
              <AnimatePresence>
                {showVerdict && (
                  <VerdictOverlay
                    timeDisplay={formatTime(stoppedTime)}
                    tpsDisplay={calculateTps(defaultAlgorithm?.moves ?? [], stoppedTime)}
                    onCorrect={handleMarkCorrect}
                    onIncorrect={handleMarkIncorrect}
                    onSkip={handleSkip}
                  />
                )}
              </AnimatePresence>

              {/* TimerContainer — Training drill mode (compact responsive sizing) */}
              <TimerContainer
                phase={phase}
                time={time}
                lastTime={null}
                hintCtx={drillHintCtx}
                onPress={press}
                onRelease={release}
                className="h-full min-h-0 py-3"
                timerClassName="text-[clamp(2.25rem,6vw,4.25rem)]"
              />
            </div>
          </div>

          {/* Right: Sidebar */}
          <TouchAside title={t("drill.casesAndStats")} className="flex min-h-0 flex-col gap-4 lg:w-80 lg:shrink-0 overflow-hidden">
            {/* Mini 3D Cube Panel — only when smart cube is connected */}
            {hasSmartCube && (
              <MiniCube3DPanel className="shrink-0" />
            )}

            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-line bg-surface flex flex-col">
              {drillMode === "single" && (
                <CaseSelectorPanel cases={subsetCases} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} getProgress={getProgress} />
              )}
              {drillMode === "random" && (
                <RandomModePanel cases={subsetCases} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} getProgress={getProgress} />
              )}
              {drillMode === "sequential" && (
                <SequentialModePanel cases={subsetCases} currentIndex={seqIndex} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} getProgress={getProgress} />
              )}
              {drillMode === "weakness" && (
                <WeaknessModePanel cases={weaknessOrdered} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} getProgress={getProgress} />
              )}
            </div>

            <SessionStatsPanel totalAttempts={attempts.length} correctCount={correctAttempts.length} streak={streak} avgTime={avgTime} />
          </TouchAside>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drill Header
   ─────────────────────────────────────────────────────────────────────── */

function DrillHeader({
  methodName, subsetName, drillMode, onModeChange, masteredCount, onBack, smartCubeConnected,
}: {
  methodName: string; subsetName: string; drillMode: DrillMode; onModeChange: (m: DrillMode) => void;
  masteredCount: number; onBack: () => void; smartCubeConnected: boolean;
}) {
  const { t } = useTranslation("training");
  return (
    <header className="flex flex-col gap-2.5 shrink-0 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="flex items-center gap-3">
        <TrainingBreadcrumb onBack={onBack} segments={[
          { label: methodName },
          { label: subsetName },
          { label: t("drill.title"), isCurrent: true },
        ]} />
        <span className="nums text-[0.62rem] text-ink-3 ml-auto">{t("drill.masteredCount", { count: masteredCount })}</span>
        {smartCubeConnected && (
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold bg-phase-blue text-white">
            {t("practice.smartCube")}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {DRILL_MODE_IDS.map((id) => {
          const keys = DRILL_MODE_KEYS[id];
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button onClick={() => onModeChange(id)}
                  className={cn("relative rounded-md px-3 py-1.5 text-[0.68rem] font-medium transition-colors max-lg:h-10 max-lg:min-w-16 max-lg:px-3.5",
                    drillMode === id ? "bg-ink text-surface" : "text-ink-3 hover:text-ink hover:bg-surface-2")}>
                  {t(keys.label)}
                  {drillMode === id && <motion.div layoutId="drill-mode-active" className="absolute inset-0 rounded-md bg-ink -z-10" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t(keys.description)}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Sidebar panels
   ─────────────────────────────────────────────────────────────────────── */

type ProgressHelper = (id: string) => { mastery: number; bestTimeMs: number; attempts: number };

function CaseSelectorPanel({ cases, selectedCaseId, onSelectCase, getProgress }: {
  cases: AlgorithmCase[]; selectedCaseId: string | null; onSelectCase: (id: string) => void; getProgress: ProgressHelper;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="p-3 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2 px-1 shrink-0">
        <h4 className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-3">{t("drill.selectCase")}</h4>
        <span className="nums text-[0.62rem] text-ink-3/70 font-medium">{t("drill.casesCount", { count: cases.length })}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto p-1 min-h-0 flex-1">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          const progress = getProgress(c.id);
          const caseAlg = getAlgorithmsForCase(c.id)[0];
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all duration-150 outline-none cursor-pointer",
                isSelected
                  ? "border-ink bg-surface-2 ring-1 ring-ink/20 shadow-xs"
                  : "border-line bg-surface hover:border-ink/20 hover:bg-surface-2/60")}>
              <div className="flex items-center justify-between">
                <span className="nums text-[0.78rem] font-bold text-ink">{c.caseNumber}</span>
                <span className="nums text-[0.6rem] font-semibold text-ink-3">{progress.mastery}%</span>
              </div>
              {caseAlg && <span className="nums text-[0.58rem] font-medium text-ink-2/80 truncate leading-tight">{caseAlg.moves.join(" ")}</span>}
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-0.5">
                <div className={cn("h-full rounded-full transition-all duration-300", progress.mastery >= 90 ? "bg-ready" : progress.mastery >= 60 ? "bg-caution" : "bg-hold")} style={{ width: `${progress.mastery}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RandomModePanel({ cases, selectedCaseId, onSelectCase, getProgress }: {
  cases: AlgorithmCase[]; selectedCaseId: string | null; onSelectCase: (id: string) => void; getProgress: ProgressHelper;
}) {
  const { t } = useTranslation("training");
  const selected = cases.find((c) => c.id === selectedCaseId);
  const progress = selected ? getProgress(selected.id) : null;
  return (
    <div className="p-3 flex flex-col items-center gap-4 h-full justify-center">
      <Shuffle className="size-8 text-ink-3/40" />
      <div className="text-center">
        <p className="text-[0.72rem] font-medium text-ink">{selected?.caseNumber ?? "—"}</p>
        <p className="text-[0.62rem] text-ink-3">{selected?.name ?? t("drill.noCase")}</p>
      </div>
      {progress && (
        <div className="flex items-center gap-3 text-[0.62rem] text-ink-3">
          <span>{t("drill.masteryLabel", { pct: progress.mastery })}</span><span>{t("drill.bestLabel", { time: formatTime(progress.bestTimeMs) })}</span>
        </div>
      )}
      <button onClick={() => { const idx = Math.floor(Math.random() * cases.length); onSelectCase(cases[idx].id); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-[0.7rem] font-medium text-ink hover:border-ink/15 hover:bg-surface-2 transition-colors">
        <SkipForward className="size-3.5" />{t("drill.nextRandomCase")}
      </button>
      <p className="text-[0.58rem] text-ink-3/60 text-center max-w-50">
        {/* name carries the trailing space so the ES/EN strings ("…{{count}} {{name}}casos…")
            render without a double space when name is empty. */}
        {t("drill.randomCaseHint", { count: cases.length, name: cases.length === 21 ? "PLL " : "" })}
      </p>
    </div>
  );
}

function SequentialModePanel({ cases, currentIndex, selectedCaseId, onSelectCase, getProgress }: {
  cases: AlgorithmCase[]; currentIndex: number; selectedCaseId: string | null; onSelectCase: (id: string) => void; getProgress: ProgressHelper;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="p-3 flex flex-col h-full min-h-0">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2 px-1 shrink-0">{t("recognize.progress")}</h4>
      <div className="mb-3 px-1 shrink-0">
        <div className="flex items-center justify-between text-[0.55rem] text-ink-3 mb-1">
          <span>{t("drill.caseOf", { current: currentIndex + 1, total: cases.length })}</span>
          <span>{Math.round(((currentIndex + 1) / cases.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full rounded-full bg-ink/60 transition-all duration-300" style={{ width: `${((currentIndex + 1) / cases.length) * 100}%` }} />
        </div>
      </div>
      <div className="space-y-0.5 overflow-y-auto p-1 min-h-0 flex-1">
        {cases.map((c, idx) => {
          const isCurrent = c.id === selectedCaseId;
          const isCompleted = idx < currentIndex;
          const progress = getProgress(c.id);
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer outline-none",
                isCurrent && "bg-surface-2 border border-ink/30 font-medium", !isCurrent && "hover:bg-surface-2/50")}>
              <span className={cn("nums text-[0.62rem] font-medium shrink-0 w-5", isCompleted ? "text-ready" : isCurrent ? "text-ink" : "text-ink-3")}>
                {isCompleted ? "✓" : idx + 1}
              </span>
              <span className={cn("text-[0.62rem] truncate flex-1", isCurrent ? "text-ink font-semibold" : "text-ink-3")}>
                {c.caseNumber}{c.name && c.name !== c.caseNumber ? ` ${c.name}` : ""}
              </span>
              <span className="nums text-[0.55rem] text-ink-3 shrink-0">{progress.mastery}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeaknessModePanel({ cases, selectedCaseId, onSelectCase, getProgress }: {
  cases: AlgorithmCase[]; selectedCaseId: string | null; onSelectCase: (id: string) => void; getProgress: ProgressHelper;
}) {
  const { t } = useTranslation("training");
  return (
    <div className="p-3 flex flex-col h-full min-h-0">
      <h4 className="text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-3 mb-2 px-1 shrink-0">{t("drill.weakestCasesFirst")}</h4>
      <p className="text-[0.58rem] text-ink-3/60 px-1 mb-2 shrink-0">{t("drill.weakestHint")}</p>
      <div className="space-y-1 overflow-y-auto p-1 min-h-0 flex-1">
        {cases.slice(0, 10).map((c, idx) => {
          const progress = getProgress(c.id);
          const isSelected = c.id === selectedCaseId;
          return (
            <button key={c.id} onClick={() => onSelectCase(c.id)}
              className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer outline-none",
                isSelected && "bg-surface-2 border border-ink/30 font-medium", !isSelected && "hover:bg-surface-2/50")}>
              <span className={cn("nums text-[0.58rem] font-medium shrink-0 w-4", idx < 3 ? "text-hold" : idx < 6 ? "text-caution" : "text-ink-3")}>{idx + 1}</span>
              <span className="text-[0.62rem] text-ink truncate flex-1">{c.caseNumber}{c.name && c.name !== c.caseNumber ? ` ${c.name}` : ""}</span>
              <span className={cn("nums text-[0.55rem] shrink-0", progress.mastery < 50 ? "text-hold" : progress.mastery < 75 ? "text-caution" : "text-ink-3")}>{progress.mastery}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Session Stats + Recent Attempts
   ─────────────────────────────────────────────────────────────────────── */

function SessionStatsPanel({ totalAttempts, correctCount, streak, avgTime }: {
  totalAttempts: number; correctCount: number; streak: number; avgTime: number;
}) {
  const { t } = useTranslation("training");
  const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
  return (
    <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
      <div className="grid grid-cols-2 gap-2">
        <StatChip icon={Target} label={t("drill.accuracy")} value={`${accuracy}%`} />
        <StatChip icon={Flame} label={t("practice.streak")} value={`${streak}`} />
        <StatChip icon={Clock} label={t("drill.avgTime")} value={avgTime > 0 ? formatTime(avgTime) : "--"} />
        <StatChip icon={RotateCcw} label={t("practice.attempts")} value={`${totalAttempts}`} />
      </div>
    </div>
  );
}


