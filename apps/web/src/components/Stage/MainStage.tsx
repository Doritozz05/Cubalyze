"use client";

import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Penalty, PuzzleCategory, Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { SolveMetrics } from "@cubeforge/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";

// Heavy views are code-split: each loads its own chunk only when the user
// visits it, keeping the initial bundle (timer + shell) small. The timer
// stage stays eager — it is the landing screen users see first.
const InsightsDashboard = lazy(() =>
  import("@/components/Insights/InsightsDashboard").then((m) => ({ default: m.InsightsDashboard })),
);
const PracticeDashboard = lazy(() =>
  import("@/views/Practice/PracticeDashboard").then((m) => ({ default: m.PracticeDashboard })),
);
const TrainingDashboard = lazy(() =>
  import("@/views/Training/TrainingDashboard").then((m) => ({ default: m.TrainingDashboard })),
);
const UltraSkillTreeView = lazy(() =>
  import("@/views/SkillTree/UltraSkillTreeView").then((m) => ({ default: m.UltraSkillTreeView })),
);
const ProfileView = lazy(() =>
  import("@/views/Profile/ProfileView").then((m) => ({ default: m.ProfileView })),
);

/** Tiny fallback shown while a lazy view chunk downloads. */
function ViewFallback() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-ink-3" />
    </div>
  );
}

export interface MainStageProps {
  activeView: ViewId;
  sessionId: string | null;
  sessions: SessionMeta[];
  solves: Solve[];
  fetchSessionSolves: (sessionId: string) => Promise<Solve[]>;
  lastAnalysis: SolveMetrics | null;
  onUpdateSolve: (id: string, updates: { penalty?: Penalty; note?: string | null }) => void;
  onDeleteSolve: (id: string) => void;
  puzzle: PuzzleCategory;
  onPuzzleChange: (puzzle: PuzzleCategory) => void;
  onNavigate: (view: ViewId) => void;
  /** Opens Settings pre-selected to the profile section. */
  onOpenSettings: () => void;
  /** Rendered when `activeView === "timer"`. */
  timerStage: React.ReactNode;
}

/**
 * The stage switcher (extracted from App.tsx): renders the view that matches
 * the active nav item — Insights, Practice, Training, Skill Tree, Profile, or
 * the live timer stage. Owns the Algorithms → Training "Practice This Case"
 * bridge preset and the current-PB baseline used by the Insights dashboard.
 */
export function MainStage(props: MainStageProps) {
  const {
    activeView,
    sessionId,
    sessions,
    solves,
    fetchSessionSolves,
    lastAnalysis,
    onUpdateSolve,
    onDeleteSolve,
    puzzle,
    onPuzzleChange,
    onNavigate,
    onOpenSettings,
    timerStage,
  } = props;

  // Training preset for Algorithms → Training bridge: when the user clicks
  // "Practice This Case" from the Algorithms view, navigate to Training with
  // the case already loaded in AlgorithmDrillView.
  const [trainingPreset, setTrainingPreset] = useState<{
    subsetId: string;
    caseId: string;
  } | null>(null);

  // Current session PB for the active puzzle (used by the Insights dashboard).
  const currentPuzzleType = puzzleCategoryToType(puzzle);
  const puzzleSolves = solves.filter((s) => (s.puzzleType ?? "3x3x3") === currentPuzzleType);
  const validSolves = puzzleSolves.filter((s) => normalizePenalty(s.penalty) !== "DNF");
  const currentPB =
    validSolves.length > 0 ? Math.min(...validSolves.map((s) => effectiveTime(s))) : null;

  if (activeView === "insights") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <InsightsDashboard
          key={sessionId ?? "none"}
          solves={solves}
          sessions={sessions}
          fetchSessionSolves={fetchSessionSolves}
          activeSessionId={sessionId}
          pb={currentPB ?? undefined}
          pendingAnalysis={lastAnalysis}
          sessionId={sessionId}
          onUpdateSolve={onUpdateSolve}
          onDeleteSolve={onDeleteSolve}
        />
      </Suspense>
    );
  }

  if (activeView === "practice") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <PracticeDashboard
          onPracticeCase={(subsetId, caseId) => {
            setTrainingPreset({ subsetId, caseId });
            onNavigate("training");
          }}
        />
      </Suspense>
    );
  }

  if (activeView === "training") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <TrainingDashboard
          preset={trainingPreset}
          onPresetConsumed={() => setTrainingPreset(null)}
          puzzle={puzzle}
          onPuzzleChange={onPuzzleChange}
        />
      </Suspense>
    );
  }

  if (activeView === "skill-tree") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <UltraSkillTreeView onNavigate={(view) => onNavigate(view as ViewId)} />
      </Suspense>
    );
  }

  if (activeView === "profile") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <ProfileView onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      </Suspense>
    );
  }

  // timer
  return <>{timerStage}</>;
}
