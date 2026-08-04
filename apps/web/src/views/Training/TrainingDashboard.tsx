"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { METHODS, SUBSETS } from "@cubeforge/algorithm-db";
import { AlgorithmDrillView } from "./AlgorithmDrillView";
import { AlgorithmRecognizeView } from "./AlgorithmRecognizeView";
import { PhaseStatsView } from "./PhaseStatsView";
import { FullSolveView } from "./FullSolveView";
import { SRSReviewView } from "./SRSReviewView";
import { SRSInsightsView } from "./SRSInsightsView";
import { PlainPracticeView } from "./PlainPracticeView";
import { BlindPracticeView } from "./BlindPracticeView";
import { CrossTrainerView } from "./CrossTrainerView";
import { LSESubPhaseView } from "./LSESubPhaseView";
import { EODetectView } from "./EODetectView";
import { EOEfficiencyView } from "./EOEfficiencyView";
import { useTrainingProgress } from "@/hooks/useTrainingProgress";
import type { PuzzleCategory } from "@/types";
import type { PhaseStatsRecord, PhasePracticeType } from "@cubeforge/training";
import { EXERCISE_IDS } from "@cubeforge/training";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import {
  FlatDashboard,
  getPhasesForMethod,
} from "./components/DashboardSections";

/* ──────────────────────────────────────────────────────────────────────────
   Flat Dashboard lives in ./components/DashboardSections
   ─────────────────────────────────────────────────────────────────────── */

interface DrillViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface PracticeViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
  phaseType: PhasePracticeType;
  modeId: string;
}

interface RecognizeViewState {
  methodId: string;
  phaseId: string;
  subsetId: string;
}

interface StatsViewState {
  methodId: string;
  phaseId: string;
  phaseName: string;
}

interface FullSolveViewState {
  methodId: string;
}

/* ──────────────────────────────────────────────────────────────────────────
   Top-level dashboard (flat: method tabs → exercise cards → sub-views)
   ─────────────────────────────────────────────────────────────────────── */

export interface TrainingDashboardProps {
  preset?: { subsetId: string; caseId: string } | null;
  onPresetConsumed?: () => void;
  puzzle?: PuzzleCategory;
  onPuzzleChange?: (puzzle: PuzzleCategory) => void;
}

export function TrainingDashboard({
  preset,
  onPresetConsumed,
  puzzle: puzzleProp = "3x3",
  onPuzzleChange,
}: TrainingDashboardProps = {}) {
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleCategory>(puzzleProp);

  // Synchronize internal puzzle selection with header/app puzzle prop
  useEffect(() => {
    if (puzzleProp) {
      setSelectedPuzzle(puzzleProp);
    }
  }, [puzzleProp]);

  const targetPuzzleType = puzzleCategoryToType(selectedPuzzle);

  const puzzleMethods = useMemo(() => {
    return METHODS.filter((m) => (m.puzzleType ?? "3x3x3") === targetPuzzleType);
  }, [targetPuzzleType]);

  const [activeMethodId, setActiveMethodId] = useState<string>(() => puzzleMethods[0]?.id ?? METHODS[0]?.id ?? "");

  // Auto-switch activeMethodId when puzzle changes if current method is not compatible
  useEffect(() => {
    if (puzzleMethods.length > 0 && !puzzleMethods.some((m) => m.id === activeMethodId)) {
      setActiveMethodId(puzzleMethods[0].id);
    }
  }, [puzzleMethods, activeMethodId]);

  const handleSelectPuzzle = (p: PuzzleCategory) => {
    setSelectedPuzzle(p);
    onPuzzleChange?.(p);
    const newTargetType = puzzleCategoryToType(p);
    const newMethods = METHODS.filter((m) => (m.puzzleType ?? "3x3x3") === newTargetType);
    if (newMethods.length > 0) {
      setActiveMethodId(newMethods[0].id);
    }
  };

  // Sub-view routing (direct from exercise cards, no L2)
  const [drillView, setDrillView] = useState<DrillViewState | null>(null);
  const [practiceView, setPracticeView] = useState<PracticeViewState | null>(null);
  const [recognizeView, setRecognizeView] = useState<RecognizeViewState | null>(null);
  const [statsView, setStatsView] = useState<StatsViewState | null>(null);
  const [fullSolveView, setFullSolveView] = useState<FullSolveViewState | null>(null);
  const [reviewView, setReviewView] = useState<{ methodId?: string } | null>(null);
  const [insightsView, setInsightsView] = useState<{ methodId?: string } | null>(null);

  // Progress tracking
  const { ready: dbReady, getMethodMastery, getPhaseStats } = useTrainingProgress();
  const [methodMasteries, setMethodMasteries] = useState<Record<string, number>>({});
  const [phaseStatsMap, setPhaseStatsMap] = useState<Record<string, PhaseStatsRecord | null>>({});
  const [dueCount, setDueCount] = useState(0);
  const [masteriesKey, setMasteriesKey] = useState(0);

  // Load method masteries. Re-runs on `masteriesKey` bump so the tab percentages
  // reflect drills/recognize/review sessions the moment the user returns.
  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    async function load() {
      const masteries: Record<string, number> = {};
      for (const method of METHODS) {
        try {
          const m = await getMethodMastery(method.id);
          masteries[method.name] = m;
        } catch {
          masteries[method.name] = 0;
        }
      }
      if (!cancelled) setMethodMasteries(masteries);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dbReady, getMethodMastery, masteriesKey]);

  // Load real per-phase accuracy for the active method's Quick Summary —
  // replaces the old fabricated formula (mastery * 0.8 + sortOrder * 3).
  useEffect(() => {
    if (!dbReady || !activeMethodId) return;
    let cancelled = false;
    const method = METHODS.find((m) => m.id === activeMethodId);
    const phases = method ? getPhasesForMethod(method.name) : [];
    void Promise.all(
      phases.map((phase) => getPhaseStats(activeMethodId, phase.id).catch(() => null)),
    ).then((stats) => {
      if (cancelled) return;
      const map: Record<string, PhaseStatsRecord | null> = {};
      phases.forEach((phase, i) => { map[phase.id] = stats[i]; });
      setPhaseStatsMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [dbReady, activeMethodId, getPhaseStats, masteriesKey]);

  // The "N due for review" badge is derived from the live review queue
  // (ReviewQueueSection reports it) — single source of truth, never stale.
  const handleDueCountChange = useCallback((due: number) => setDueCount(due), []);

  // ── Algorithms → Training bridge ─────────────────────────────────────
  const [drillPresetCaseId, setDrillPresetCaseId] = useState<string | null>(
    () => preset?.caseId ?? null,
  );
  if (preset?.caseId && preset.caseId !== drillPresetCaseId) {
    setDrillPresetCaseId(preset.caseId);
  }

  const initialDrillView = useMemo(() => {
    if (!preset?.subsetId) return null;
    const subset = SUBSETS.find((s) => s.id === preset.subsetId);
    if (!subset) return null;
    return { methodId: subset.methodId, phaseId: "", subsetId: preset.subsetId };
  }, [preset?.subsetId]);

  useEffect(() => {
    if (preset?.subsetId) {
      const subset = SUBSETS.find((s) => s.id === preset.subsetId);
      if (subset) {
        setActiveMethodId(subset.methodId);
        const method = METHODS.find((m) => m.id === subset.methodId);
        if (method?.puzzleType === "2x2x2") {
          setSelectedPuzzle("2x2");
        } else if (method?.puzzleType === "3x3x3") {
          setSelectedPuzzle("3x3");
        }
      }
      onPresetConsumed?.();
    }
  }, [preset?.subsetId, onPresetConsumed]);

  useEffect(() => {
    if (initialDrillView && !drillView) {
      setDrillView(initialDrillView);
    }
  }, [initialDrillView, drillView]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleDrill = (methodId: string, phaseId: string, subsetId: string) => {
    setDrillView({ methodId, phaseId, subsetId });
  };

  const handleRecognize = (methodId: string, phaseId: string, subsetId: string) => {
    setRecognizeView({ methodId, phaseId, subsetId });
  };

  const handlePracticeMode = (methodId: string, phaseId: string, phaseName: string, phaseType: PhasePracticeType, mode: string) => {
    setPracticeView({ methodId, phaseId, phaseName, phaseType, modeId: mode });
  };

  const handleStats = (methodId: string, phaseId: string, phaseName: string) => {
    setStatsView({ methodId, phaseId, phaseName });
  };

  const handleFullSolve = (methodId: string) => {
    setFullSolveView({ methodId });
  };

  const handleStartReview = (methodId?: string) => {
    setReviewView({ methodId });
  };

  const handleOpenInsights = (methodId?: string) => {
    setInsightsView(methodId ? { methodId } : {});
  };

  const handleBackFromSubView = () => {
    setDrillView(null);
    setPracticeView(null);
    setRecognizeView(null);
    setStatsView(null);
    setFullSolveView(null);
    setReviewView(null);
    setInsightsView(null);
    // Refresh the method mastery tabs after any drill/recognize/review session.
    setMasteriesKey((k) => k + 1);
  };

  // ── L3 Sub-views ────────────────────────────────────────────────────

  if (drillView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmDrillView
            methodId={drillView.methodId}
            phaseId={drillView.phaseId}
            subsetId={drillView.subsetId}
            onBack={handleBackFromSubView}
            preselectedCaseId={drillPresetCaseId}
          />
        </div>
      </div>
    );
  }

  if (recognizeView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <AlgorithmRecognizeView
            methodId={recognizeView.methodId}
            phaseId={recognizeView.phaseId}
            subsetId={recognizeView.subsetId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (statsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <PhaseStatsView
            methodId={statsView.methodId}
            phaseId={statsView.phaseId}
            phaseName={statsView.phaseName}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (fullSolveView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <FullSolveView
            methodId={fullSolveView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (reviewView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSReviewView
            methodId={reviewView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (insightsView) {
    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          <SRSInsightsView
            methodId={insightsView.methodId}
            onBack={handleBackFromSubView}
          />
        </div>
      </div>
    );
  }

  if (practiceView) {
    const { methodId, phaseId, phaseName, phaseType, modeId } = practiceView;
    const props = { methodId, phaseId, phaseName, onBack: handleBackFromSubView };

    return (
      <div className="relative flex-1 min-h-0 w-full">
        <div className="absolute inset-0 flex flex-col">
          {/* Generic: plain + speed-vs-eff (S/E persists its own exercise id) */}
          {modeId === "plain" && <PlainPracticeView {...props} />}
          {modeId === "speed-vs-eff" && (
            <PlainPracticeView
              {...props}
              exerciseLabel="Speed vs Efficiency"
              exerciseId={EXERCISE_IDS.speedEfficiency(methodId, phaseId)}
            />
          )}
          {/* Generic: blind */}
          {modeId === "blind" && <BlindPracticeView {...props} />}

          {/* Cross-specific */}
          {phaseType === "cross" && (modeId === "optimal" || modeId === "cn") && (
            <CrossTrainerView {...props} />
          )}

          {/* LSE-specific */}
          {phaseType === "lse" && (modeId === "eo" || modeId === "ulur" || modeId === "mslice") && (
            <LSESubPhaseView {...props} subPhase={modeId} />
          )}

          {/* EO-specific */}
          {phaseType === "eo" && modeId === "detect" && <EODetectView {...props} />}
          {phaseType === "eo" && modeId === "efficiency" && <EOEfficiencyView {...props} />}
        </div>
      </div>
    );
  }

  // ── Flat Dashboard ─────────────────────────────────────────────────

  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 flex flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FlatDashboard
          selectedPuzzle={selectedPuzzle}
          onSelectPuzzle={handleSelectPuzzle}
          puzzleMethods={puzzleMethods}
          activeMethodId={activeMethodId}
          onSelectMethod={setActiveMethodId}
          methodMasteries={methodMasteries}
          phaseStatsMap={phaseStatsMap}
          onDrill={handleDrill}
          onRecognize={handleRecognize}
          onPracticeMode={handlePracticeMode}
          onStats={handleStats}
          onFullSolve={handleFullSolve}
          onStartReview={handleStartReview}
          onOpenInsights={handleOpenInsights}
          onDueCountChange={handleDueCountChange}
          dueCount={dueCount}
          dbReady={dbReady}
        />
      </div>
    </div>
  );
}
