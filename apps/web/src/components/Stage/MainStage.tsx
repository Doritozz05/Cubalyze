"use client";

import { useState } from "react";
import { InsightsDashboard } from "@/components/Insights/InsightsDashboard";
import { PracticeDashboard } from "@/views/Practice/PracticeDashboard";
import { TrainingDashboard } from "@/views/Training/TrainingDashboard";
import { UltraSkillTreeView } from "@/views/SkillTree/UltraSkillTreeView";
import { ProfileView } from "@/views/Profile/ProfileView";
import type { ViewId } from "@/components/Layout/sidebar.constants";
import type { Penalty, PuzzleCategory, Solve } from "@/types";
import { effectiveTime, normalizePenalty } from "@/types";
import { puzzleCategoryToType } from "@/utils/puzzleUtils";
import type { SolveMetrics } from "@cubeforge/types";
import type { SessionMeta } from "@/hooks/usePersistentSession";

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
    );
  }

  if (activeView === "practice") {
    return (
      <PracticeDashboard
        onPracticeCase={(subsetId, caseId) => {
          setTrainingPreset({ subsetId, caseId });
          onNavigate("training");
        }}
      />
    );
  }

  if (activeView === "training") {
    return (
      <TrainingDashboard
        preset={trainingPreset}
        onPresetConsumed={() => setTrainingPreset(null)}
        puzzle={puzzle}
        onPuzzleChange={onPuzzleChange}
      />
    );
  }

  if (activeView === "skill-tree") {
    return <UltraSkillTreeView onNavigate={(view) => onNavigate(view as ViewId)} />;
  }

  if (activeView === "profile") {
    return <ProfileView onNavigate={onNavigate} onOpenSettings={onOpenSettings} />;
  }

  // timer
  return <>{timerStage}</>;
}
